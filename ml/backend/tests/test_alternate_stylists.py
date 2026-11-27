import json
import os
import unittest
from unittest.mock import patch

import httpx

from app.chat.alternate_providers import AlternateStylist
from app.chat.alternate_providers import compact_schema
from app.chat.stylist import LLMUnavailable
from app.chat.stylist import create_stylist
from app.contracts.styling import Interpretation
from app.contracts.styling import Intent


class AlternateStylistTests(unittest.TestCase):
    def test_compact_schema_preserves_title_fields_and_constraints(self):
        schema = {"title": "Display name", "type": "object", "properties": {
            "title": {"title": "Title", "type": "string", "minLength": 1}},
            "required": ["title"], "additionalProperties": False}
        compact = compact_schema(schema)
        self.assertNotIn("title", compact)
        self.assertEqual(compact["properties"]["title"], {"type": "string", "minLength": 1})
        self.assertEqual(compact["required"], ["title"])
        self.assertFalse(compact["additionalProperties"])
        self.assertIn("title", schema)

    def test_workers_cache_reuses_only_exact_successes_and_credentials(self):
        stylist = AlternateStylist("workers")
        value = Interpretation(intent=Intent(), needs_clarification=False)
        with patch.object(stylist, "_uncached_call", return_value=value) as call:
            stylist.call(Interpretation, "rules", {"message": "lunch"})
            cached = stylist.call(Interpretation, "rules", {"message": "lunch"})
            self.assertEqual(call.call_count, 1)
            cached.intent.occasion = "changed by caller"
            self.assertIsNone(stylist.call(Interpretation, "rules", {"message": "lunch"}).intent.occasion)
            stylist.call(Interpretation, "rules", {"message": "dinner"})
            stylist.call(Interpretation, "different rules", {"message": "lunch"})
            stylist.call(Interpretation, "rules", {"message": "lunch"}, ["different image bytes"])
            with patch.dict(os.environ, {"CLOUDFLARE_API_TOKEN": "other-private-key"}):
                stylist.call(Interpretation, "rules", {"message": "lunch"})
            self.assertEqual(call.call_count, 5)
        with patch.object(stylist, "_uncached_call", side_effect=LLMUnavailable("timeout")) as call:
            for _ in range(2):
                with self.assertRaises(LLMUnavailable):
                    stylist.call(Interpretation, "rules", {"message": "uncached failure"})
            self.assertEqual(call.call_count, 2)

    def setUp(self):
        environment = {"CLOUDFLARE_ACCOUNT_ID": "a" * 32, "CLOUDFLARE_API_TOKEN": "private-workers-key",
            "NVIDIA_API_KEY": "private-nvidia-key", "SILICONFLOW_API_KEY": "private-siliconflow-key", "SILICONFLOW_FREE_TEST_CONFIRMED": "1"}
        patcher = patch.dict(os.environ, environment, clear=True)
        patcher.start()
        self.addCleanup(patcher.stop)

    def response(self, **changes):
        value = Interpretation(intent=Intent(), needs_clarification=False).model_dump_json()
        result = {"choices": [{"finish_reason": "stop", "message": {"content": value}}], "model": "reported-model",
                  "usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30}}
        result.update(changes)
        return result

    def test_fixed_hosts_json_schema_vision_usage_and_no_secret_in_body(self):
        for provider, host in [("workers", "api.cloudflare.com"), ("nvidia", "integrate.api.nvidia.com"), ("siliconflow", "api.siliconflow.com")]:
            calls = []
            def handle(request):
                calls.append(request)
                return httpx.Response(200, json=self.response())
            client = httpx.Client(transport=httpx.MockTransport(handle))
            with patch("app.chat.alternate_providers.httpx.Client", return_value=client) as client_factory:
                stylist = AlternateStylist(provider)
                if provider == "nvidia":
                    self.assertIsNone(stylist.request_timeout)
                    stylist.request_timeout = 180
                result = stylist.call(Interpretation, "rules", {"message": "one outfit"}, ["eA=="])
            self.assertIsInstance(result, Interpretation)
            self.assertEqual(len(calls), 1)
            self.assertEqual(calls[0].url.host, host)
            self.assertEqual(client_factory.call_args.kwargs["timeout"].read, 180 if provider == "nvidia" else 120)
            body = json.loads(calls[0].content)
            if provider == "workers":
                self.assertNotIn("max_tokens", body)
                self.assertEqual(body["max_completion_tokens"], 4096)
                self.assertEqual(body["chat_template_kwargs"], {"enable_thinking": False})
            if provider == "nvidia":
                self.assertEqual(body["model"], "google/gemma-4-31b-it")
                self.assertNotIn("response_format", body)
                self.assertEqual(body["chat_template_kwargs"], {"enable_thinking": False})
            else:
                self.assertEqual(body["response_format"], {"type": "json_object"})
            self.assertEqual(body["messages"][1]["content"][1]["image_url"]["url"], "data:image/jpeg;base64,eA==")
            self.assertIn("JSON Schema", body["messages"][0]["content"])
            self.assertNotIn("private-", str(body))
            self.assertEqual(stylist.last_usage["total_tokens"], 30)
            self.assertEqual(stylist.last_returned_model, "reported-model")

    def test_errors_are_sanitized_without_retry(self):
        for code in [400, 401, 402, 403, 404, 410, 429, 503]:
            calls = []
            def handle(request):
                calls.append(request)
                return httpx.Response(code, text="private-nvidia-key upstream message")
            client = httpx.Client(transport=httpx.MockTransport(handle))
            with patch("app.chat.alternate_providers.httpx.Client", return_value=client):
                with self.assertRaises(LLMUnavailable) as caught:
                    AlternateStylist("nvidia").call(Interpretation, "", {})
            self.assertNotIn("private-nvidia-key", str(caught.exception))
            if code == 410:
                self.assertIn("catalogue", str(caught.exception))
            self.assertEqual(len(calls), 1)

    def test_missing_credentials_invalid_account_and_cost_guard_do_not_call(self):
        with patch("app.chat.alternate_providers.httpx.Client") as client:
            with patch.dict(os.environ, {"NVIDIA_API_KEY": ""}):
                with self.assertRaisesRegex(LLMUnavailable, "NVIDIA_API_KEY"):
                    AlternateStylist("nvidia").call(Interpretation, "", {})
            with patch.dict(os.environ, {"CLOUDFLARE_ACCOUNT_ID": "../../another-account"}):
                with self.assertRaisesRegex(LLMUnavailable, "CLOUDFLARE_ACCOUNT_ID"):
                    AlternateStylist("workers").call(Interpretation, "", {})
            with patch.dict(os.environ, {"SILICONFLOW_FREE_TEST_CONFIRMED": "0"}):
                with self.assertRaisesRegex(LLMUnavailable, "zero-cost"):
                    AlternateStylist("siliconflow").call(Interpretation, "", {})
            client.assert_not_called()

    def test_truncated_and_invalid_json_are_rejected(self):
        for response in [self.response(choices=[{"finish_reason": "length", "message": {"content": "{}"}}]),
                         self.response(choices=[{"finish_reason": "stop", "message": {"content": "not-json"}}])]:
            client = httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(200, json=response)))
            with patch("app.chat.alternate_providers.httpx.Client", return_value=client):
                with self.assertRaises(LLMUnavailable):
                    AlternateStylist("nvidia").call(Interpretation, "", {})

    def test_request_budget_stops_before_sending_and_provider_is_explicit(self):
        stylist = AlternateStylist("nvidia")
        stylist.request_limit = 0
        with patch("app.chat.alternate_providers.httpx.Client") as client:
            with self.assertRaisesRegex(LLMUnavailable, "budget"):
                stylist.call(Interpretation, "", {})
            client.assert_not_called()
        for provider in ["workers", "nvidia", "siliconflow"]:
            with patch.dict(os.environ, {"PHASE3_LLM_PROVIDER": provider}):
                self.assertIsInstance(create_stylist(), AlternateStylist)
        with patch.dict(os.environ, {"PHASE3_WORKERS_MODEL": "@cf/some-paid-model"}):
            with self.assertRaises(ValueError):
                AlternateStylist("workers")
