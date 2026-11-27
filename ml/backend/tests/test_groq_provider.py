import base64
import io
import os
import unittest
from unittest.mock import patch

import httpx
from PIL import Image

from app.chat.stylist import GroqStylist
from app.chat.stylist import LLMUnavailable
from app.chat.stylist import create_stylist
from app.contracts.styling import Interpretation
from app.contracts.styling import Intent
from app.contracts.styling import Assessments


class GroqTransportTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {
            "GROQ_API_KEY": "private-test-key", "PHASE3_LLM_PROVIDER": "groq"}, clear=True)
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.stylist = create_stylist()

    def response(self, status=200, body=None, headers=None):
        if body is None:
            body = {"choices": [{"finish_reason": "stop", "message": {"content":
                Interpretation(intent=Intent(), needs_clarification=False).model_dump_json()}}]}
        return httpx.Response(status, json=body, headers=headers,
            request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions"))

    def test_explicit_provider_and_vision_payload(self):
        self.assertIsInstance(self.stylist, GroqStylist)
        self.assertEqual(self.stylist.assessment_batch_size, 6)
        with patch("app.chat.stylist.httpx.Client") as factory:
            post = factory.return_value.__enter__.return_value.post
            post.return_value = self.response()
            result = self.stylist.call(Interpretation, "instructions", {"message": "college fest"}, ["eA=="])
        self.assertIsInstance(result, Interpretation)
        args, kwargs = post.call_args
        self.assertEqual(args[0], "https://api.groq.com/openai/v1/chat/completions")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer private-test-key")
        body = kwargs["json"]
        self.assertEqual(body["model"], "qwen/qwen3.8-27b")
        self.assertEqual(body["response_format"]["json_schema"]["schema"], Interpretation.model_json_schema())
        self.assertEqual(body["messages"][1]["content"][1]["image_url"]["url"], "data:image/jpeg;base64,eA==")
        self.assertNotIn("private-test-key", str(body))

    def test_missing_key_and_image_limit_do_not_send(self):
        with patch("app.chat.stylist.httpx.Client") as factory:
            with self.assertRaisesRegex(LLMUnavailable, "three"):
                self.stylist.call(Interpretation, "", {}, ["eA=="] * 4)
            with patch.dict(os.environ, {"GROQ_API_KEY": ""}):
                with self.assertRaisesRegex(LLMUnavailable, "GROQ_API_KEY"):
                    self.stylist.call(Interpretation, "", {})
            factory.assert_not_called()

    def test_error_responses_are_sanitized_without_quota_retries(self):
        for status in (400, 401, 403, 404, 429, 503):
            with self.subTest(status=status), patch("app.chat.stylist.httpx.Client") as factory:
                post = factory.return_value.__enter__.return_value.post
                post.return_value = self.response(status, {"error": {"message": "tokens per day private-test-key"}}, {"retry-after": "60"})
                with self.assertRaises(LLMUnavailable) as caught:
                    self.stylist.call(Interpretation, "", {})
                self.assertNotIn("private-test-key", str(caught.exception))
                self.assertEqual(post.call_count, 1)
                if status == 429:
                    self.assertIn("60 seconds", str(caught.exception))

    def test_incomplete_and_schema_invalid_output_is_rejected(self):
        for body in ({}, {"choices": []}, {"choices": [{"finish_reason": "length"}]},
                     {"choices": [{"finish_reason": "stop", "message": {"content": "{}"}}]}):
            with self.subTest(body=body), patch("app.chat.stylist.httpx.Client") as factory:
                factory.return_value.__enter__.return_value.post.return_value = self.response(body=body)
                with self.assertRaises(LLMUnavailable):
                    self.stylist.call(Interpretation, "", {})

    def test_network_failure_is_sanitized(self):
        with patch("app.chat.stylist.httpx.Client") as factory:
            factory.return_value.__enter__.return_value.post.side_effect = httpx.ConnectError("private-test-key")
            with self.assertRaisesRegex(LLMUnavailable, "Could not reach Groq") as caught:
                self.stylist.call(Interpretation, "", {})
            self.assertNotIn("private-test-key", str(caught.exception))

    def test_short_cooldown_retries_only_the_current_request(self):
        with patch("app.chat.stylist.httpx.Client") as factory, patch("app.chat.stylist.time.sleep") as sleep:
            post = factory.return_value.__enter__.return_value.post
            post.side_effect = [self.response(429, {}, {"retry-after": "44"}), self.response()]
            self.assertIsInstance(self.stylist.call(Interpretation, "", {}), Interpretation)
            sleep.assert_called_once_with(44.5)
            self.assertEqual(post.call_count, 2)
            self.assertEqual(post.call_args_list[0], post.call_args_list[1])

    def test_repeated_rate_limit_is_bounded(self):
        with patch("app.chat.stylist.httpx.Client") as factory, patch("app.chat.stylist.time.sleep") as sleep:
            post = factory.return_value.__enter__.return_value.post
            post.return_value = self.response(429, {}, {"retry-after": "32"})
            with self.assertRaisesRegex(LLMUnavailable, "32 seconds"):
                self.stylist.call(Interpretation, "", {})
            self.assertEqual(post.call_count, 2)
            self.assertEqual(sleep.call_count, 1)

    def test_six_outfits_become_one_image_in_order(self):
        images = []
        for shade in range(6):
            buffer = io.BytesIO()
            Image.new("RGB", (120, 50), (shade * 40, 0, 0)).save(buffer, format="PNG")
            images.append(base64.b64encode(buffer.getvalue()).decode())
        with patch("app.chat.stylist.httpx.Client") as factory:
            post = factory.return_value.__enter__.return_value.post
            post.return_value = self.response(body={"choices": [{"finish_reason": "stop", "message": {
                "content": '{"assessments":[]}'}}]})
            self.stylist.call(Assessments, "one per candidate in matching order", {}, images)
        body = post.call_args.kwargs["json"]
        content = body["messages"][1]["content"]
        self.assertEqual(len(content), 2)
        self.assertIn("stacked vertically", body["messages"][0]["content"])
        packed = base64.b64decode(content[1]["image_url"]["url"].split(",", 1)[1])
        with Image.open(io.BytesIO(packed)) as sheet:
            self.assertEqual(sheet.size, (120, 300))
            self.assertLess(sheet.getpixel((50, 25))[0], sheet.getpixel((50, 275))[0])
