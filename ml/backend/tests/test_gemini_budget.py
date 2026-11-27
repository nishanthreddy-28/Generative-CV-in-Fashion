import json
import os
import time
import unittest
from unittest.mock import patch

import httpx

from app.chat.request_budget import GeminiBudget
from app.chat.request_budget import scope
from app.chat.request_budget import signature
from app.chat.stylist import GeminiStylist
from app.chat.stylist import LLMUnavailable
from app.contracts.styling import Interpretation
from app.contracts.styling import Intent
from app.contracts.styling import Assessments


class GeminiBudgetTests(unittest.TestCase):
    def setUp(self):
        environment = patch.dict(os.environ, {"GEMINI_API_KEY": "budget-test-secret", "PHASE3_GEMINI_MODEL": "gemini-3.6-flash"})
        environment.start()
        self.addCleanup(environment.stop)
        self.stylist = GeminiStylist()

    def response(self, status=200, body=None):
        if body is None:
            content = Interpretation(intent=Intent(), needs_clarification=False).model_dump_json()
            body = {"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": content}]}}]}
        return httpx.Response(status, json=body, request=httpx.Request("POST", "https://generativelanguage.googleapis.com/test"))

    def test_exact_repeat_returns_independent_validated_objects_without_http(self):
        with patch("app.chat.stylist.httpx.Client") as factory:
            post = factory.return_value.__enter__.return_value.post
            post.return_value = self.response()
            first = self.stylist.call(Interpretation, "rules", {"catalog": ["alice-shirt"]})
            first.intent.occasion = "mutated by caller"
            second = self.stylist.call(Interpretation, "rules", {"catalog": ["alice-shirt"]})
            self.assertIsNone(second.intent.occasion)
            self.assertEqual(post.call_count, 1)

    def test_changed_catalog_context_rules_images_model_and_credentials_miss(self):
        variants = [("rules", {"catalog": ["alice-shirt"]}, None),
                    ("rules", {"catalog": ["bob-shirt"]}, None),
                    ("rules", {"catalog": ["alice-shirt"], "occasion": "office"}, None),
                    ("new rules", {"catalog": ["alice-shirt"]}, None),
                    ("rules", {"catalog": ["alice-shirt"]}, ["eA=="]),
                    ("rules", {"catalog": ["alice-shirt"]}, ["eQ=="])]
        with patch("app.chat.stylist.httpx.Client") as factory:
            post = factory.return_value.__enter__.return_value.post
            post.return_value = self.response()
            for prompt, payload, images in variants:
                self.stylist.call(Interpretation, prompt, payload, images)
            self.stylist.model = "gemini-3.8-flash"
            self.stylist.call(Interpretation, *variants[0])
            with patch.dict(os.environ, {"GEMINI_API_KEY": "another-project-test-key"}):
                self.stylist.call(Interpretation, *variants[0])
            self.assertEqual(post.call_count, 8)

    def test_daily_quota_blocks_new_calls_but_allows_previously_cached_success(self):
        quota = {"error": {"details": [{"@type": "type.googleapis.com/google.rpc.QuotaFailure",
            "violations": [{"quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}]}}
        with patch("app.chat.stylist.httpx.Client") as factory:
            post = factory.return_value.__enter__.return_value.post
            post.side_effect = [self.response(), self.response(429, quota)]
            self.stylist.call(Interpretation, "", {"request": "cached"})
            with self.assertRaisesRegex(LLMUnavailable, "daily quota"):
                self.stylist.call(Interpretation, "", {"request": "new"})
            with self.assertRaisesRegex(LLMUnavailable, "daily quota"):
                self.stylist.call(Interpretation, "", {"request": "another"})
            self.assertIsInstance(self.stylist.call(Interpretation, "", {"request": "cached"}), Interpretation)
            self.assertEqual(post.call_count, 2)

    def test_cache_expiry_capacity_and_quota_reset(self):
        budget = GeminiBudget(capacity=2)
        budget.put("a", "first", 900)
        budget.put("b", "second", 900)
        self.assertEqual(budget.get("a"), "first")
        budget.put("c", "third", 900)
        self.assertIsNone(budget.get("b"))
        budget.put("expired", "old", -1)
        self.assertIsNone(budget.get("expired"))
        with patch("app.chat.request_budget.next_daily_reset", return_value=time.time() - 1):
            budget.block_daily("namespace", "daily quota")
        self.assertIsNone(budget.blocked("namespace"))

    def test_failed_requests_are_not_response_cached(self):
        with patch("app.chat.stylist.httpx.Client") as factory:
            post = factory.return_value.__enter__.return_value.post
            post.side_effect = [self.response(403, {}), self.response()]
            with self.assertRaises(LLMUnavailable):
                self.stylist.call(Interpretation, "", {})
            self.assertIsInstance(self.stylist.call(Interpretation, "", {}), Interpretation)
            self.assertEqual(post.call_count, 2)

    def test_missing_candidate_assessments_are_not_cached(self):
        with patch.object(self.stylist, "_uncached_call", return_value=Assessments(assessments=[])) as call:
            for _ in range(2):
                self.stylist.call(Assessments, "", {"candidates": [{"candidate_id": "outfit-a"}]}, ["eA=="])
        self.assertEqual(call.call_count, 2)

    def test_unsupported_item_selection_is_not_cached(self):
        result = Interpretation(intent=Intent(required_ids=["not-owned"]), needs_clarification=False)
        payload = {"message": "an outfit", "previous": Intent().model_dump(), "catalog": [], "last_outfit_ids": []}
        with patch.object(self.stylist, "_uncached_call", return_value=result) as call:
            for _ in range(2):
                self.stylist.call(Interpretation, "", payload)
        self.assertEqual(call.call_count, 2)

    def test_cache_keys_never_contain_raw_inputs_or_credentials(self):
        namespace = scope("gemini-3.6-flash", "budget-test-secret")
        identifier = signature(namespace, Interpretation, "private rules", {"private": "user text"}, ["eA=="])
        self.assertEqual(len(identifier), 64)
        self.assertNotIn("budget-test-secret", namespace)
        self.assertNotIn("user text", identifier)
