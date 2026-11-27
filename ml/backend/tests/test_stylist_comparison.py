import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import httpx

from scripts.compare_stylists import check, configuration_issue, evaluate, nvidia_catalog_issue, text_cases, write_reports
from app.contracts.styling import Interpretation
from app.contracts.styling import Intent
from app.contracts.styling import SelectionEvidence


class ComparisonTests(unittest.TestCase):
    def test_nvidia_catalogue_is_public_and_missing_model_never_sends_inference(self):
        calls = []
        def handle(request):
            calls.append(request)
            return httpx.Response(200, json={"data": [{"id": "google/gemma-4-31b-it"}]})
        with patch("scripts.compare_stylists.httpx.Client", return_value=httpx.Client(transport=httpx.MockTransport(handle))):
            self.assertIsNone(nvidia_catalog_issue("google/gemma-4-31b-it"))
        self.assertEqual(str(calls[0].url), "https://integrate.api.nvidia.com/v1/models")
        self.assertEqual(calls[0].method, "GET")
        self.assertNotIn("authorization", calls[0].headers)
        with patch.dict(os.environ, {"NVIDIA_API_KEY": "private-key"}), patch("scripts.compare_stylists.stylist_for") as factory:
            with patch("scripts.compare_stylists.httpx.Client", return_value=httpx.Client(transport=httpx.MockTransport(handle))):
                result = evaluate("nvidia", "qwen/qwen3.5-397b-a17b", text_cases(), True)
            self.assertEqual(result["status"], "not_run")
            self.assertEqual(result["requests"], 0)
            self.assertIn("absent", result["reason"])
            factory.assert_not_called()

    def test_nvidia_catalogue_failure_is_sanitized_and_provider_error_is_reported(self):
        for response in [httpx.Response(503, text="private-upstream-text"),
                         httpx.Response(200, json={"data": []}),
                         httpx.Response(200, json={"data": "private-upstream-text"}),
                         httpx.Response(200, content=b"not-json")]:
            with patch("scripts.compare_stylists.httpx.Client", return_value=httpx.Client(transport=httpx.MockTransport(lambda _: response))):
                reason = nvidia_catalog_issue("google/gemma-4-31b-it")
            self.assertIn("no inference sent", reason)
            self.assertNotIn("private-upstream-text", reason)
        result = {"provider": "nvidia", "model": "old-model", "status": "provider_error", "requests": 1,
                  "cases": [{"case": "general_request", "status": "error", "message": "Model unavailable (HTTP 410)"}]}
        with tempfile.TemporaryDirectory() as directory:
            write_reports(Path(directory), [result], 6)
            report = (Path(directory) / "REPORT.md").read_text()
            self.assertIn("Model unavailable (HTTP 410)", report)
            self.assertIn("Not measured", report)

    def test_unconfigured_or_dry_run_never_calls_provider(self):
        with patch.dict(os.environ, {}, clear=True), patch("scripts.compare_stylists.stylist_for") as factory:
            result = evaluate("gemini", "gemini-3.8-flash", text_cases(), True)
            self.assertEqual(result["status"], "not_run")
            factory.assert_not_called()
        with patch.dict(os.environ, {"GEMINI_API_KEY": "private-key"}), patch("scripts.compare_stylists.stylist_for") as factory:
            self.assertEqual(evaluate("gemini", "gemini-3.8-flash", text_cases(), False)["requests"], 0)
            factory.assert_not_called()

    def test_cost_guard_and_reports_never_invent_measurements(self):
        with patch.dict(os.environ, {"SILICONFLOW_API_KEY": "private-key", "SILICONFLOW_FREE_TEST_CONFIRMED": "0"}):
            self.assertIn("unconfirmed", configuration_issue("siliconflow"))
        result = {"provider": "gemini", "model": "gemini-3.8-flash", "status": "not_run", "requests": 0, "cases": [], "reason": "Missing credentials"}
        with tempfile.TemporaryDirectory() as directory:
            write_reports(Path(directory), [result], 6)
            report = (Path(directory) / "REPORT.md").read_text()
            self.assertIn("Not measured", report)
            self.assertNotIn("private-key", report)
            self.assertEqual(json.loads((Path(directory) / "results.json").read_text())["results"][0]["status"], "not_run")

    def test_constraint_checks_fail_for_invented_id_and_lost_constraints(self):
        case = text_cases()[1]
        bad = Interpretation(intent=Intent(required_ids=["not-owned"]), needs_clarification=False)
        self.assertFalse(check(case, bad)[0])
        good = Interpretation(intent=Intent(occasion="formal event", weather="cold rainy", required_ids=["navy-shirt"], excluded_ids=["white-tee"]),
            needs_clarification=False, selections=[SelectionEvidence(item_id="navy-shirt", action="require", quote="include my navy shirt"),
                                                SelectionEvidence(item_id="white-tee", action="exclude", quote="exclude the white T-shirt")])
        self.assertTrue(check(case, good)[0])
        good.intent.weather = None
        self.assertFalse(check(case, good)[0])
