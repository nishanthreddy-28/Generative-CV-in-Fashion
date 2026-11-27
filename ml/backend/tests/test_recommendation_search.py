import unittest
from unittest.mock import patch

from app.contracts.styling import Intent
from app.contracts.styling import Assessment
from app.recommendations.scorer import ModelUnavailable
from app.recommendations.search import diverse
from app.recommendations.search import POOL_PER_TEMPLATE
from app.recommendations.service import generate
from app.recommendations.service import outfit_id
from app.recommendations.service import recommend
from test_recommendations_api import garment, Scorer, Stylist


class RetrievalDouble(Scorer):
    def __init__(self):
        self.scored = 0

    def retrieve_scores(self, contexts, options):
        # Equal scores deliberately exercise deterministic ties and variety.
        return [[0.5 for _ in options] for _ in contexts]

    def score(self, candidates):
        self.scored = len(candidates)
        return super().score(candidates)


class SearchTests(unittest.TestCase):
    def test_multiple_results_never_count_shoe_or_jacket_only_variants(self):
        base = [garment('t','top'),garment('b','bottom'),garment('s','shoes')]
        shoe_variant = base[:2] + [garment('s2','shoes')]
        layer_variant = base + [garment('o','outer')]
        items = list({i['id']:i for c in [base,shoe_variant,layer_variant] for i in c}.values())
        result = recommend(items, Intent(count=3), Scorer(), Stylist())
        self.assertEqual(result.status,'recommended')
        self.assertEqual(len(result.outfits),1)
        self.assertTrue(any('1 distinct main outfits out of 3' in w for w in result.warnings))

    def setUp(self):
        self.items = [garment(f"{slot}{index:02}", slot)
                      for slot, count in [("top", 30), ("bottom", 30), ("shoes", 30), ("full", 5), ("outer", 4)]
                      for index in range(count)]
        self.scorer = RetrievalDouble()

    def test_large_wardrobe_uses_bounded_pool_and_keeps_all_templates(self):
        candidates, issue = generate(self.items, Intent(), retriever=self.scorer)
        self.assertIsNone(issue)
        self.assertLessEqual(len(candidates), 4 * POOL_PER_TEMPLATE)
        templates = {(any(i["slot"] == "full" for i in c), any(i["slot"] == "outer" for i in c)) for c in candidates}
        self.assertEqual(templates, {(False, False), (False, True), (True, False), (True, True)})
        self.assertEqual(len(candidates), len({outfit_id(c) for c in candidates}))
        self.assertTrue(all(any(i["slot"] == "shoes" for i in c) for c in candidates))
        result = recommend(self.items, Intent(count=3), self.scorer, Stylist())
        self.assertEqual(result.status, "recommended")
        self.assertEqual(len(result.outfits), 3)
        self.assertLessEqual(self.scorer.scored, 256)

    def test_retrieval_respects_locks_exclusions_layers_and_history(self):
        for required in [["top00"], ["full00"], ["bottom00", "outer00"], ["top00", "bottom00", "shoes00"]]:
            intent = Intent(required_ids=required, excluded_ids=["shoes01"], outerwear="required")
            first, issue = generate(self.items, intent, retriever=self.scorer)
            self.assertIsNone(issue)
            self.assertTrue(first)
            seen = {outfit_id(c) for c in first[:5]}
            candidates, _ = generate(self.items, intent, seen, retriever=self.scorer)
            for candidate in candidates:
                ids = {i["id"] for i in candidate}
                self.assertTrue(set(required) <= ids)
                self.assertNotIn("shoes01", ids)
                self.assertTrue(any(i["slot"] == "outer" for i in candidate))
                self.assertNotIn(outfit_id(candidate), seen)

    def test_input_order_does_not_change_retrieved_candidates(self):
        first, _ = generate(self.items, Intent(), retriever=self.scorer)
        second, _ = generate(list(reversed(self.items)), Intent(), retriever=self.scorer)
        self.assertEqual([outfit_id(c) for c in first], [outfit_id(c) for c in second])

    def test_large_wardrobe_excludes_previous_main_clothing_before_retrieval(self):
        previous_core = {"top00", "bottom00"}
        candidates, issue = generate(self.items, Intent(another=True), retriever=self.scorer, previous_core=previous_core)
        self.assertIsNone(issue)
        self.assertTrue(candidates)
        for candidate in candidates:
            core = {item["id"] for item in candidate if item["slot"] in {"top", "bottom", "full"}}
            self.assertNotEqual(core, previous_core)

    def test_bad_retrieval_is_unavailable_instead_of_no_match(self):
        for value in [[], [[float("nan")]]]:
            with patch.object(self.scorer, "retrieve_scores", return_value=value):
                self.assertEqual(recommend(self.items, Intent(), self.scorer, Stylist()).status, "unavailable")
        with patch.object(self.scorer, "retrieve_scores", side_effect=ModelUnavailable("missing")):
            self.assertEqual(recommend(self.items, Intent(), self.scorer, Stylist()).status, "unavailable")

    def test_small_wardrobe_does_not_require_retrieval(self):
        items = [garment("t", "top"), garment("b", "bottom"), garment("s", "shoes")]
        with patch.object(self.scorer, "retrieve_scores", side_effect=AssertionError("unnecessary retrieval")):
            self.assertEqual(recommend(items, Intent(), self.scorer, Stylist()).status, "recommended")

    def test_jacket_change_does_not_hide_an_alternative_base(self):
        base = [garment("t", "top"), garment("b", "bottom"), garment("s", "shoes")]
        alternative = [garment("t2", "top"), garment("b2", "bottom"), garment("s", "shoes")]
        ranked = [(base, .6), (base + [garment("o", "outer")], .59), (alternative, .58)]
        selected = diverse(ranked, 2)
        self.assertEqual(selected[0][0], base)
        self.assertEqual(selected[1][0], alternative)

    def test_final_diversity_recomputed_when_first_candidate_is_rejected(self):
        t, b, s = garment("t", "top"), garment("b", "bottom"), garment("s", "shoes")
        rejected = [t, b, s]
        better = rejected + [garment("o", "outer")]
        other = [garment("t2", "top"), garment("b2", "bottom"), s]
        candidates = [rejected, other, better]

        class SelectiveStylist:
            def assess(self, intent, batch):
                return {key: Assessment(candidate_id=key,
                        decision="unsuitable" if key == outfit_id(rejected) else "suitable", reason="test")
                        for key, _ in batch}

        with patch("app.recommendations.service.generate", return_value=(candidates, None)), \
                patch.object(Scorer, "score", return_value=[.8, .59, .6]):
            result = recommend(list({i["id"]: i for c in candidates for i in c}.values()), Intent(count=2), Scorer(), SelectiveStylist())
        self.assertEqual([o.id for o in result.outfits], [outfit_id(better), outfit_id(other)])


if __name__ == "__main__":
    unittest.main()
