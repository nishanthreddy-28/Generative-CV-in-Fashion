import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image
from pydantic import ValidationError

from app.persistence import wardrobe as db
from app.api import styling as api
from app.persistence import conversations as store
from app.chat.stylist import LocalStylist
from app.chat.stylist import LLMUnavailable
from app.contracts.styling import Intent
from app.contracts.styling import Assessment
from app.contracts.styling import Interpretation
from app.contracts.styling import Assessments
from app.recommendations.scorer import ModelUnavailable
from app.recommendations.scorer import image_path
from app.recommendations.service import generate
from app.recommendations.service import outfit_id
from app.recommendations.service import recommend


def garment(id, slot):
    return {"id": id, "user_id": "alice", "created_at": "2026-11-03", "image_path": id + ".webp",
            "thumb_path": id + ".webp", "category": {"top": "Shirt", "bottom": "Jeans", "shoes": "Sneakers", "full": "Dress", "outer": "Jacket"}[slot],
            "slot": slot, "pattern": "solid", "formality": "casual", "season": "mild", "fit": "regular",
            "colors": json.dumps([{"name": "blue", "hex": "#0000ff", "share": 1.0}]),
            "embedding": bytes(3072), "confidence": 0.9, "margin": 0.1, "source": "model", "is_archived": 0}


class Scorer:
    version = "test-double"
    ready = True
    def score(self, candidates):
        return [0.5 for _ in candidates]


class Stylist:
    decision = "suitable"
    clarification = None
    last_message = ""
    def assess(self, intent, candidates):
        return {key: Assessment(candidate_id=key, decision=self.decision, reason="Blue garments in a complete outfit.") for key, _ in candidates}
    def interpret(self, message, previous, catalog, last_ids):
        self.last_message = message
        return Interpretation(intent=Intent(another="another" in message), needs_clarification=bool(self.clarification), clarification=self.clarification)


class EngineTests(unittest.TestCase):
    def test_count_sized_assessment_stops_on_success_and_continues_on_rejection(self):
        self.stylist.assessment_batch_matches_count = True
        self.stylist.assessment_batch_size = 3
        for reject_first in (False, True):
            checked = []
            def assess(intent, candidates):
                self.assertEqual(len(candidates), 1)
                key = candidates[0][0]
                checked.append(key)
                decision = "unsuitable" if reject_first and len(checked) == 1 else "suitable"
                return {key: Assessment(candidate_id=key, decision=decision, reason="Checked garment photos.")}
            with patch.object(self.stylist, "assess", side_effect=assess):
                result = recommend(self.items, Intent(count=1), self.scorer, self.stylist)
            self.assertEqual(result.status, "recommended")
            self.assertEqual(len(checked), 2 if reject_first else 1)
            self.assertEqual(result.outfits[0].id, checked[-1])

    def setUp(self):
        self.items = [garment("t", "top"), garment("b", "bottom"), garment("s", "shoes"), garment("d", "full"), garment("o", "outer")]
        self.scorer, self.stylist = Scorer(), Stylist()

    def test_complete_templates(self):
        candidates, issue = generate(self.items, Intent())
        self.assertIsNone(issue)
        self.assertEqual(len(candidates), 4)
        for candidate in candidates:
            slots = {i["slot"] for i in candidate}
            self.assertIn("shoes", slots)
            self.assertFalse("full" in slots and "top" in slots)

    def test_locked_and_excluded(self):
        candidates, _ = generate(self.items, Intent(required_ids=["t"], excluded_ids=["o"]))
        self.assertEqual(len(candidates), 1)
        self.assertEqual({i["id"] for i in candidates[0]}, {"t", "b", "s"})

    def test_required_outer(self):
        candidates, _ = generate(self.items, Intent(outerwear="required"))
        self.assertTrue(all(any(i["slot"] == "outer" for i in c) for c in candidates))

    def test_category_constraint_filters_before_ranking(self):
        tees = [dict(garment("tee1", "top"), category="T-Shirt"),
                dict(garment("tee2", "top"), category="T-Shirt")]
        candidates, issue = generate(self.items + tees, Intent(occasion="office", required_categories=["T-Shirt"]))
        self.assertIsNone(issue)
        self.assertTrue(candidates)
        self.assertEqual({i["id"] for c in candidates for i in c if i["slot"] == "top"}, {"tee1", "tee2"})
        self.assertTrue(all(any(i["category"] == "T-Shirt" for i in c) for c in candidates))
        self.assertTrue(generate(self.items, Intent(required_categories=["T-Shirt"]))[1])
        self.assertTrue(generate(self.items + tees, Intent(required_categories=["T-Shirt"], required_ids=["t"]))[1])

    def test_bad_id_and_incompatible_selection(self):
        for intent in [Intent(required_ids=["other_user_item"]), Intent(required_ids=["t", "d"])]:
            self.assertEqual(generate(self.items, intent)[0], [])
            self.assertIsNotNone(generate(self.items, intent)[1])

    def test_request_schema(self):
        for value in [{"count": 0}, {"count": 6}, {"required_ids": ["t"], "excluded_ids": ["t"]}, {"injected": True}]:
            with self.assertRaises(ValidationError):
                Intent(**value)

    def test_candidate_budget_requires_anchor(self):
        items = [garment(f"t{j}", "top") for j in range(30)] + [garment(f"b{j}", "bottom") for j in range(30)] + [garment(f"s{j}", "shoes") for j in range(30)]
        self.assertIsNotNone(generate(items, Intent())[1])
        self.assertIsNone(generate(items, Intent(required_ids=["t0"]))[1])

    def test_missing_shoes_no_match_before_inference(self):
        result = recommend([i for i in self.items if i["slot"] != "shoes"], Intent(), None, None)
        self.assertEqual(result.status, "no_match")

    def test_another_excludes_seen_outfits(self):
        candidates, _ = generate(self.items, Intent())
        seen = [outfit_id(c) for c in candidates]
        result = recommend(self.items, Intent(another=True), self.scorer, self.stylist, seen)
        self.assertEqual(result.status, "no_match")

    def test_another_changes_main_clothing_instead_of_only_jacket(self):
        items = [garment("t", "top"), garment("t2", "top"), garment("b", "bottom"),
                 garment("s", "shoes"), garment("o", "outer"), garment("o2", "outer")]
        result = recommend(items, Intent(another=True), self.scorer, self.stylist,
                           last_ids=["t", "b", "s", "o"])
        self.assertEqual(result.status, "recommended")
        self.assertIn("t2", {item.id for item in result.outfits[0].items})

    def test_another_does_not_break_locks_when_only_jackets_differ(self):
        items = [garment("t", "top"), garment("t2", "top"), garment("b", "bottom"),
                 garment("s", "shoes"), garment("o", "outer"), garment("o2", "outer")]
        with patch.object(self.stylist, "assess") as assess:
            result = recommend(items, Intent(another=True, required_ids=["t", "b"]), self.scorer, self.stylist,
                               last_ids=["t", "b", "s", "o"])
        self.assertEqual(result.status, "no_match")
        self.assertIn("Changing only a jacket or shoes", result.message)
        assess.assert_not_called()

    def test_seen_outfit_is_deprioritized_without_requiring_another(self):
        intent = Intent(outerwear="excluded")
        first = recommend(self.items, intent, self.scorer, self.stylist)
        second = recommend(self.items, intent, self.scorer, self.stylist,
                           previous=[first.outfits[0].id])
        self.assertEqual(second.status, "recommended")
        self.assertNotEqual(first.outfits[0].id, second.outfits[0].id)
        # Seen is a preference, not an exclusion when no alternative exists.
        only = [i for i in self.items if i["slot"] in {"top", "bottom", "shoes"}]
        initial = recommend(only, intent, self.scorer, self.stylist)
        repeated = recommend(only, intent, self.scorer, self.stylist, previous=[initial.outfits[0].id])
        self.assertEqual(repeated.status, "recommended")

    def test_finite_scores_and_unavailable(self):
        for exc in [ModelUnavailable("assets missing"), LLMUnavailable("offline")]:
            with patch.object(self.scorer, "score", side_effect=exc):
                self.assertEqual(recommend(self.items, Intent(), self.scorer, self.stylist).status, "unavailable")
        with patch.object(self.scorer, "score", return_value=[float("nan")] * 4):
            self.assertEqual(recommend(self.items, Intent(), self.scorer, self.stylist).status, "unavailable")

    def test_unknown_is_not_no_match(self):
        self.stylist.decision = "unknown"
        self.assertEqual(recommend(self.items, Intent(), self.scorer, self.stylist).status, "needs_clarification")

    def test_unsuitable_is_no_match(self):
        self.stylist.decision = "unsuitable"
        self.assertEqual(recommend(self.items, Intent(occasion="formal"), self.scorer, self.stylist).status, "no_match")

    def test_item_count_and_explanations(self):
        result = recommend(self.items, Intent(count=1), self.scorer, self.stylist)
        self.assertEqual(result.status, "recommended")
        self.assertEqual(len(result.outfits), 1)
        self.assertTrue(all(i.user_id == "alice" for i in result.outfits[0].items))

    def test_bad_metadata(self):
        self.items[0]["season"] = "invented"
        self.assertEqual(recommend(self.items, Intent(), self.scorer, self.stylist).status, "needs_clarification")

    def test_path_escape(self):
        with self.assertRaises(ModelUnavailable):
            image_path({"image_path": "../../../../secret"})


class APITests(unittest.TestCase):
    def setUp(self):
        gate=patch('app.pose.validation.validate_person'); gate.start(); self.addCleanup(gate.stop)
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.patches = [patch.object(db, "DB_PATH", self.root / "items.db"),
                        patch.object(store, "PATH", self.root / "conversations.db"),
                        patch.object(api, "scorer", Scorer()), patch.object(api, "stylist", Stylist())]
        for p in self.patches:
            p.start()
        api.app.dependency_overrides[api.current_user] = lambda: "alice"
        self.client_context = TestClient(api.app)
        self.client = self.client_context.__enter__()
        conn = db.get_conn()
        for id, slot in [("t", "top"), ("b", "bottom"), ("s", "shoes"), ("d", "full")]:
            row = garment(id, slot)
            conn.execute("INSERT INTO items (" + ",".join(row) + ") VALUES(" + ",".join("?" for _ in row) + ")", list(row.values()))
        other = garment("private", "top")
        other["user_id"] = "bob"
        conn.execute("INSERT INTO items (" + ",".join(other) + ") VALUES(" + ",".join("?" for _ in other) + ")", list(other.values()))
        conn.execute("UPDATE items SET is_archived=1 WHERE id='d'")
        conn.commit()
        conn.close()

    def tearDown(self):
        self.client_context.__exit__(None, None, None)
        api.app.dependency_overrides.clear()
        for p in reversed(self.patches):
            p.stop()
        self.temp.cleanup()


    def test_delete_only_owned_active_clothing_and_exclude_from_recommendations(self):
        self.assertEqual(self.client.delete('/phase3/items/private').status_code,404)
        self.assertEqual(self.client.delete('/phase3/items/missing').status_code,404)
        response=self.client.delete('/phase3/items/t')
        self.assertEqual(response.status_code,200,response.text)
        self.assertTrue(response.json()['deleted'])
        self.assertNotIn('t',[item['id'] for item in api.wardrobe('alice')])
        self.assertEqual(self.client.delete('/phase3/items/t').status_code,404)
        conn=db.get_conn()
        try:
            self.assertEqual(conn.execute("SELECT is_archived FROM items WHERE id='private'").fetchone()[0],0)
            self.assertEqual(conn.execute("SELECT is_archived FROM items WHERE id='t'").fetchone()[0],1)
        finally: conn.close()

    def test_api_recommend_and_schema(self):
        result = self.client.post("/phase3/recommendations", json={}).json()
        self.assertEqual(result["status"], "recommended")
        self.assertEqual({i["id"] for i in result["outfits"][0]["items"]}, {"t", "b", "s"})
        self.assertEqual(self.client.post("/phase3/recommendations", json={"count": 9}).status_code, 422)

    def test_foreign_item_and_image(self):
        result = self.client.post("/phase3/recommendations", json={"required_ids": ["private"]}).json()
        self.assertEqual(result["status"], "needs_clarification")
        self.assertEqual(self.client.get("/phase3/items/private/image").status_code, 404)

    def test_owned_image_is_private(self):
        Image.new("RGB", (20, 20), "blue").save(self.root / "t.webp")
        with patch("app.recommendations.scorer.IMAGES_DIR", self.root):
            result = self.client.get("/phase3/items/t/image")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.headers["cache-control"], "private, no-store")

    def test_conversation_ownership_and_another(self):
        first = self.client.post("/phase3/chat", json={"message": "one outfit"}).json()
        self.assertEqual(first["status"], "recommended")
        id = first["conversation_id"]
        second = self.client.post("/phase3/chat", json={"message": "another", "conversation_id": id}).json()
        self.assertEqual(second["status"], "no_match")
        api.app.dependency_overrides[api.current_user] = lambda: "bob"
        self.assertEqual(self.client.post("/phase3/chat", json={"message": "hi", "conversation_id": id}).status_code, 404)

    def test_clarification_keeps_request(self):
        api.stylist.clarification = "Which shirt?"
        first = self.client.post("/phase3/chat", json={"message": "a dinner outfit"}).json()
        self.assertIsNotNone(first["conversation_id"])
        api.stylist.clarification = None
        self.client.post("/phase3/chat", json={"message": "the blue one", "conversation_id": first["conversation_id"]})
        self.assertIn("a dinner outfit", api.stylist.last_message)

    def test_compare_and_swap(self):
        id = store.save(None, "alice", None, {})
        store.save(id, "alice", 0, {"updated": 1})
        with self.assertRaises(RuntimeError):
            store.save(id, "alice", 0, {"updated": 2})

    def test_unconfigured_auth_fails_closed(self):
        api.app.dependency_overrides.clear()
        with patch.dict("os.environ", {}, clear=True):
            self.assertEqual(self.client.post("/phase3/recommendations", json={}).status_code, 503)

    def test_verified_auth_and_invalid_token(self):
        import httpx
        api.app.dependency_overrides.clear()
        env = {"SUPABASE_URL": "https://example.supabase.co", "SUPABASE_PUBLISHABLE_KEY": "public-test"}
        with patch.dict("os.environ", env, clear=True), patch.object(api.httpx, "Client") as factory:
            get = factory.return_value.__enter__.return_value.get
            get.return_value = httpx.Response(200, json={"id": "alice"}, request=httpx.Request("GET", "https://example.supabase.co/auth/v1/user"))
            result = self.client.post("/phase3/recommendations", json={}, headers={"Authorization": "Bearer test-token"})
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json()["status"], "recommended")
            get.return_value = httpx.Response(401, json={})
            self.assertEqual(self.client.post("/phase3/recommendations", json={}, headers={"Authorization": "Bearer expired"}).status_code, 401)


class LanguageBoundaryTests(unittest.TestCase):
    def test_unrequested_locks_trigger_correction(self):
        stylist = LocalStylist()
        bad = Interpretation(intent=Intent(required_ids=["t"]), needs_clarification=False)
        good = Interpretation(intent=Intent(preferences=["casual"]), needs_clarification=False)
        with patch.object(stylist, "call", side_effect=[bad, good]) as call:
            result = stylist.interpret("Recommend one casual outfit", Intent(), [{"id": "t", "category": "Shirt", "slot": "top", "colors": ["blue"]}], [])
        self.assertFalse(result.intent.required_ids)
        self.assertEqual(call.call_count, 2)

    def test_selection_quote_is_required(self):
        from app.contracts.styling import SelectionEvidence
        result = Interpretation(intent=Intent(required_ids=["t"]), needs_clarification=False,
                                selections=[SelectionEvidence(item_id="t", action="require", quote="blue shirt")])
        catalog = [{"id": "t", "category": "Shirt", "slot": "top", "colors": ["blue"]}]
        self.assertTrue(LocalStylist.selection_evidence_valid(result, "Use my blue shirt", Intent(), catalog, []))
        self.assertFalse(LocalStylist.selection_evidence_valid(result, "Recommend an outfit", Intent(), catalog, []))

    def test_replacement_can_preserve_other_last_items(self):
        from app.contracts.styling import SelectionEvidence
        result = Interpretation(intent=Intent(required_ids=["t"]), needs_clarification=False,
                                selections=[SelectionEvidence(item_id="t", action="require", quote="change only the shoes")])
        catalog = [{"id": "t", "category": "Shirt", "slot": "top", "colors": ["blue"]},
                   {"id": "s", "category": "Sneakers", "slot": "shoes", "colors": ["red"]}]
        self.assertTrue(LocalStylist.selection_evidence_valid(result, "change only the shoes", Intent(), catalog, ["t", "s"]))
        self.assertFalse(LocalStylist.selection_evidence_valid(result, "change only the shoes", Intent(), catalog, []))

    def test_placeholder_is_not_a_question(self):
        result = Interpretation(intent=Intent(), needs_clarification=False, clarification="None required.")
        self.assertIsNone(result.clarification)
        with self.assertRaises(ValidationError):
            Interpretation(intent=Intent(), needs_clarification=True, clarification=None)

    def test_missing_and_fabricated_candidates_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "image.png"
            Image.new("RGB", (20, 20), "blue").save(path)
            stylist = LocalStylist()
            for entries in [[], [Assessment(candidate_id="invented", decision="suitable", reason="test")],
                            [Assessment(candidate_id="a", decision="suitable", reason="test")] * 2]:
                with patch("app.chat.stylist.image_path", return_value=path), patch.object(stylist, "call", return_value=Assessments(assessments=entries)):
                    with self.assertRaises(LLMUnavailable):
                        stylist.assess(Intent(), [("a", [garment("t", "top")])])


if __name__ == "__main__":
    unittest.main()
