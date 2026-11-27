import base64
import json
import os
import unittest
from unittest.mock import patch

import httpx

from app.chat.stylist import GeminiStylist
from app.chat.stylist import LocalStylist
from app.chat.stylist import LLMUnavailable
from app.chat.stylist import create_stylist
from app.contracts.styling import Interpretation
from app.contracts.styling import Intent


class HostedTransportTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {"GEMINI_API_KEY": "test-secret", "PHASE3_LLM_PROVIDER": "gemini"}, clear=True)
        self.environment.start()
        self.stylist = GeminiStylist()

    def tearDown(self):
        self.environment.stop()

    def response(self, status=200, body=None):
        if body is None:
            content = Interpretation(intent=Intent(), needs_clarification=False).model_dump_json()
            body = {"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": content}]}}]}
        return httpx.Response(status, json=body, request=httpx.Request("POST", "https://generativelanguage.googleapis.com/test"))

    def test_structured_text_and_image_payload(self):
        encoded = base64.b64encode(b"fixture-image-bytes").decode()
        with patch("app.chat.stylist.httpx.Client") as factory:
            post = factory.return_value.__enter__.return_value.post
            post.return_value = self.response()
            value = self.stylist.call(Interpretation, "system instructions", {"message": "one outfit"}, [encoded])
        self.assertIsInstance(value, Interpretation)
        args, kwargs = post.call_args
        self.assertIn("gemini-3.6-flash:generateContent", args[0])
        self.assertNotIn("test-secret", args[0])
        self.assertEqual(kwargs["headers"]["x-goog-api-key"], "test-secret")
        body = kwargs["json"]
        schema = body["generationConfig"]["responseJsonSchema"]
        self.assertEqual(schema["properties"]["intent"], {"$ref": "#/$defs/Intent"})
        self.assertEqual(schema["required"], ["intent", "needs_clarification"])
        self.assertNotIn("maxItems", json.dumps(schema))
        self.assertEqual(Interpretation.model_json_schema()["properties"]["selections"]["maxItems"], 104)
        self.assertEqual(body["contents"][0]["parts"][1]["inlineData"]["data"], encoded)
        self.assertNotIn("test-secret", json.dumps(body))

    def test_missing_key_does_not_send(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}), patch("app.chat.stylist.httpx.Client") as factory:
            with self.assertRaises(LLMUnavailable):
                self.stylist.call(Interpretation, "", {})
            factory.assert_not_called()

    def test_quota_and_access_fail_closed(self):
        for status, description in [(429, "quota"), (402, "prepaid balance"), (401, "credentials"), (403, "credentials"),
                                    (400, "structured output"), (404, "configured model")]:
            with self.subTest(status=status), patch("app.chat.stylist.httpx.Client") as factory:
                post = factory.return_value.__enter__.return_value.post
                post.return_value = self.response(status, {})
                with self.assertRaises(LLMUnavailable) as caught:
                    self.stylist.call(Interpretation, "", {})
                self.assertEqual(post.call_count, 1)
                self.assertIn(description, str(caught.exception))
                self.assertNotIn("test-secret", str(caught.exception))

    def test_temporary_unavailability_retries_are_bounded(self):
        unavailable = self.response(503, {})
        with patch("app.chat.stylist.httpx.Client") as factory, patch("app.chat.stylist.time.sleep") as sleep:
            post = factory.return_value.__enter__.return_value.post
            post.side_effect = [unavailable, self.response()]
            self.assertIsInstance(self.stylist.call(Interpretation, "", {}), Interpretation)
            self.assertEqual(post.call_count, 2)
            self.assertEqual(sleep.call_count, 1)

            post.reset_mock()
            sleep.reset_mock()
            post.side_effect = [unavailable] * 3
            # A successful identical request is now cached; this transport case
            # intentionally uses a fresh adapter to exercise the HTTP failures.
            self.stylist = GeminiStylist()
            with self.assertRaisesRegex(LLMUnavailable, "HTTP 503 after two retries"):
                self.stylist.call(Interpretation, "", {})
            self.assertEqual(post.call_count, 3)
            self.assertEqual(sleep.call_count, 2)

    def test_gateway_errors_retry_and_vision_has_a_larger_timeout(self):
        for images, expected_read in [(None, 45), (["eA=="], 90)]:
            with patch("app.chat.stylist.httpx.Client") as factory, patch("app.chat.stylist.time.sleep"):
                post = factory.return_value.__enter__.return_value.post
                post.side_effect = [self.response(502, {}), self.response()]
                self.stylist.call(Interpretation, "", {}, images)
                self.assertEqual(post.call_count, 2)
                self.assertAlmostEqual(post.call_args.kwargs["timeout"].read, expected_read)

    def test_retry_budget_stops_before_another_request(self):
        with patch("app.chat.stylist.httpx.Client") as factory, patch("app.chat.stylist.time.sleep"), \
             patch("app.chat.stylist.time.monotonic", side_effect=[0, 0, 151]):
            post = factory.return_value.__enter__.return_value.post
            post.return_value = self.response(503, {})
            with self.assertRaisesRegex(LLMUnavailable, "request budget"):
                self.stylist.call(Interpretation, "", {})
            self.assertEqual(post.call_count, 1)

    def test_google_invalid_key_error_is_sanitized(self):
        body = {"error": {"message": "unexpected test-secret", "details": [{"reason": "API_KEY_INVALID"}]}}
        with patch("app.chat.stylist.httpx.Client") as factory:
            factory.return_value.__enter__.return_value.post.return_value = self.response(400, body)
            with self.assertRaisesRegex(LLMUnavailable, "rejected the API key") as caught:
                self.stylist.call(Interpretation, "", {})
        self.assertNotIn("test-secret", str(caught.exception))

    def test_daily_and_zero_quotas_do_not_retry(self):
        for limit, value, expected in [("RequestsPerDay", "20", "daily quota"), ("RequestsPerMinute", "0", "is zero")]:
            self.stylist = GeminiStylist()
            body = {"error": {"message": "private test-secret", "details": [
                {"@type": "type.googleapis.com/google.rpc.QuotaFailure", "violations": [{"quotaId": limit, "quotaValue": value}]},
                {"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "2s"}]}}
            with self.subTest(limit=limit), patch("app.chat.stylist.httpx.Client") as factory:
                post = factory.return_value.__enter__.return_value.post
                post.return_value = self.response(429, body)
                with self.assertRaisesRegex(LLMUnavailable, expected) as caught:
                    self.stylist.call(Interpretation, "", {})
                self.assertEqual(post.call_count, 1)
                self.assertNotIn("test-secret", str(caught.exception))

    def test_short_rate_limit_honours_retry_hint(self):
        body = {"error": {"details": [
            {"@type": "type.googleapis.com/google.rpc.QuotaFailure", "violations": [{"quotaId": "RequestsPerMinute", "quotaValue": "5"}]},
            {"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "2s"}]}}
        with patch("app.chat.stylist.httpx.Client") as factory, patch("app.chat.stylist.time.sleep") as sleep:
            post = factory.return_value.__enter__.return_value.post
            post.side_effect = [self.response(429, body), self.response()]
            self.assertIsInstance(self.stylist.call(Interpretation, "", {}), Interpretation)
            self.assertEqual(post.call_count, 2)
            self.assertGreaterEqual(sleep.call_args.args[0], 2)

    def test_long_retry_hint_is_shown_without_blocking(self):
        body = {"error": {"message": "private test-secret", "details": [
            {"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "90s"}]}}
        with patch("app.chat.stylist.httpx.Client") as factory:
            post = factory.return_value.__enter__.return_value.post
            post.return_value = self.response(429, body)
            with self.assertRaisesRegex(LLMUnavailable, "90 seconds") as caught:
                self.stylist.call(Interpretation, "", {})
            self.assertEqual(post.call_count, 1)
            self.assertNotIn("test-secret", str(caught.exception))

    def test_timeout_retries_once_and_identifies_the_stage(self):
        with patch("app.chat.stylist.httpx.Client") as factory, patch("app.chat.stylist.time.sleep"):
            post = factory.return_value.__enter__.return_value.post
            post.side_effect = [httpx.ConnectTimeout("test-secret"), self.response()]
            self.assertIsInstance(self.stylist.call(Interpretation, "", {}), Interpretation)
            self.assertEqual(post.call_count, 2)

            post.reset_mock()
            post.side_effect = [httpx.ReadTimeout("test-secret")] * 2
            with self.assertRaisesRegex(LLMUnavailable, r"outfit photo assessment \(ReadTimeout\)") as caught:
                self.stylist.call(Interpretation, "", {}, ["eA=="])
            self.assertEqual(post.call_count, 2)
            self.assertNotIn("test-secret", str(caught.exception))

    def test_transport_and_validation_errors_are_distinct_and_sanitized(self):
        invalid_output = {"candidates": [{"finishReason": "STOP", "content": {"parts": [
            {"text": '{"unexpected": "test-secret"}'},
        ]}}]}
        with patch("app.chat.stylist.httpx.Client") as factory:
            post = factory.return_value.__enter__.return_value.post
            post.side_effect = httpx.ConnectError("test-secret")
            with self.assertRaisesRegex(LLMUnavailable, r"Could not reach Gemini \(ConnectError\)") as caught:
                self.stylist.call(Interpretation, "", {})
            self.assertNotIn("test-secret", str(caught.exception))
            post.side_effect = None
            post.return_value = self.response(body=invalid_output)
            with self.assertRaisesRegex(LLMUnavailable, "did not match Interpretation") as caught:
                self.stylist.call(Interpretation, "", {})
            self.assertNotIn("test-secret", str(caught.exception))

    def test_filtered_truncated_and_malformed_responses(self):
        for body in [{}, {"candidates": []}, {"candidates": [{"finishReason": "MAX_TOKENS"}]},
                     {"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": "invalid JSON"}]}}]}]:
            with self.subTest(body=body), patch("app.chat.stylist.httpx.Client") as factory:
                factory.return_value.__enter__.return_value.post.return_value = self.response(body=body)
                with self.assertRaises(LLMUnavailable):
                    self.stylist.call(Interpretation, "", {})

    def test_thought_parts_are_not_parsed_as_output(self):
        value = Interpretation(intent=Intent(), needs_clarification=False).model_dump_json()
        body = {"candidates": [{"finishReason": "STOP", "content": {"parts": [
            {"thought": True, "text": "not the output"}, {"text": value}]}}]}
        with patch("app.chat.stylist.httpx.Client") as factory:
            factory.return_value.__enter__.return_value.post.return_value = self.response(body=body)
            self.assertIsInstance(self.stylist.call(Interpretation, "", {}), Interpretation)

    def test_provider_selection_is_explicit(self):
        self.assertIsInstance(create_stylist(), GeminiStylist)
        with patch.dict(os.environ, {"PHASE3_LLM_PROVIDER": "ollama"}):
            self.assertIsInstance(create_stylist(), LocalStylist)
        with patch.dict(os.environ, {"PHASE3_LLM_PROVIDER": "unknown"}):
            with self.assertRaises(ValueError):
                create_stylist()

    def test_missing_configuration_keeps_gemini_without_local_fallback(self):
        with patch.dict(os.environ, {}, clear=True):
            stylist = create_stylist()
            self.assertIsInstance(stylist, GeminiStylist)
            with self.assertRaisesRegex(LLMUnavailable, "GEMINI_API_KEY"):
                stylist.call(Interpretation, "", {})

    def test_model_id_cannot_redirect_key(self):
        with patch.dict(os.environ, {"PHASE3_GEMINI_MODEL": "https://example.com/steal"}):
            with self.assertRaises(ValueError):
                GeminiStylist()


if __name__ == "__main__":
    unittest.main()
