import unittest
from unittest.mock import patch

from app.chat.stylist import LocalStylist
from app.chat.stylist import explicit_garment_reference
from app.contracts.styling import Intent
from app.contracts.styling import Interpretation


class ExplicitSelectionTests(unittest.TestCase):
    def test_another_button_is_local_and_keeps_only_explicit_locks(self):
        previous = Intent(occasion="casual lunch", weather="cold", required_ids=["black-trousers"])
        with patch.object(self.stylist, "call") as call:
            result = self.stylist.interpret("Show me another outfit.", previous, self.catalog, ["shirt", "black-trousers"])
        call.assert_not_called()
        self.assertTrue(result.intent.another)
        self.assertEqual(result.intent.required_ids, ["black-trousers"])
        self.assertEqual(result.intent.occasion, previous.occasion)
        self.assertFalse(previous.another)
    def test_unique_singular_trouser_is_local_and_preserves_other_constraints(self):
        previous = Intent(occasion="dinner date", weather="cold", preferences=["casual"],
                          required_ids=["shirt", "grey-jeans"], excluded_ids=["black-trousers"],
                          required_categories=["Jeans"], count=1, another=True)
        with patch.object(self.stylist, "call") as call:
            result = self.stylist.interpret("use black trouser", previous, self.catalog, [])
        call.assert_not_called()
        self.assertEqual(result.intent.required_ids, ["shirt", "black-trousers"])
        self.assertEqual(result.intent.required_categories, [])
        self.assertEqual(result.intent.excluded_ids, [])
        self.assertEqual(result.intent.occasion, "dinner date")
        self.assertEqual(result.intent.weather, "cold")
        self.assertEqual(result.intent.preferences, ["casual"])
        self.assertFalse(result.intent.another)
        self.assertEqual(previous.required_ids, ["shirt", "grey-jeans"])

    def setUp(self):
        self.stylist = LocalStylist()
        self.catalog = [
            {"id": "black-trousers", "category": "Trousers", "slot": "bottom", "colors": ["black"]},
            {"id": "grey-jeans", "category": "Jeans", "slot": "bottom", "colors": ["grey"]},
            {"id": "shirt", "category": "Shirt", "slot": "top", "colors": ["blue"]}]

    def test_omitted_black_trousers_becomes_a_hard_lock(self):
        ignored = Interpretation(intent=Intent(occasion="college fest", required_ids=["grey-jeans"]), needs_clarification=False)
        with patch.object(self.stylist, "call", return_value=ignored):
            result = self.stylist.interpret("use the black trousers i have", Intent(occasion="college fest"), self.catalog, [])
        self.assertEqual(result.intent.required_ids, ["black-trousers"])
        self.assertEqual(result.intent.occasion, "college fest")
        self.assertTrue(self.stylist.selection_evidence_valid(result, "use the black trousers i have", Intent(), self.catalog, []))

    def test_missing_or_ambiguous_piece_requires_clarification(self):
        for catalog in (self.catalog[1:], self.catalog + [dict(self.catalog[0], id="other-trousers")]):
            with patch.object(self.stylist, "call") as call:
                result = self.stylist.interpret("use black trousers", Intent(), catalog, [])
            self.assertTrue(result.needs_clarification)
            call.assert_not_called()

    def test_negative_or_general_requests_are_not_positive_locks(self):
        for message in ("don't use black trousers", "outfit for Diwali", "use black trousers or grey jeans", "use black trousers but no shirt"):
            self.assertIsNone(explicit_garment_reference(message, self.catalog))

    def test_trousers_do_not_silently_match_black_jeans(self):
        catalog = [dict(self.catalog[0], category="Jeans")]
        self.assertEqual(explicit_garment_reference("use black trousers", catalog)[0], [])

    def test_tshirt_followup_keeps_office_and_allows_category_choice(self):
        catalog = self.catalog + [{"id": "tee1", "category": "T-Shirt", "slot": "top", "colors": ["white"]},
                                  {"id": "tee2", "category": "T-Shirt", "slot": "top", "colors": ["blue"]}]
        ignored = Interpretation(intent=Intent(), needs_clarification=True, clarification="Which tee?")
        previous = Intent(occasion="office", preferences=["formal dress code"], weather="cold", required_ids=["shirt", "black-trousers"])
        with patch.object(self.stylist, "call", return_value=ignored):
            result = self.stylist.interpret("use t shirts", previous, catalog, [])
        self.assertFalse(result.needs_clarification)
        self.assertEqual(result.intent.occasion, "office")
        self.assertEqual(result.intent.required_categories, ["T-Shirt"])
        self.assertEqual(result.intent.required_ids, ["black-trousers"])
        self.assertEqual(result.intent.preferences, ["formal dress code"])
        self.assertEqual(result.intent.weather, "cold")

    def test_missing_category_does_not_silently_recommend_shirts(self):
        with patch.object(self.stylist, "call") as call:
            result = self.stylist.interpret("use t shirts", Intent(occasion="office"), self.catalog, [])
        self.assertTrue(result.needs_clarification)
        call.assert_not_called()
