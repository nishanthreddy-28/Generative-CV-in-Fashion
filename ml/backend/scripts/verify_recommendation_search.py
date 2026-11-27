"""Real checkpoint smoke test. Reads wardrobe images; never edits the wardrobe.

Validates retrieval/LOO agreement and bounded search, not aesthetic accuracy.
"""
import json
import math
import sys
import time
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.persistence import wardrobe as db
from app.contracts.styling import Intent
from app.recommendations.scorer import PretrainedScorer
from app.recommendations.scorer import image_path
from app.recommendations.service import generate
from app.recommendations.service import outfit_id


def main():
    conn = db.get_conn()
    try:
        rows = [dict(row) for row in conn.execute("SELECT * FROM items WHERE is_archived=0 ORDER BY user_id,id")]
    finally:
        conn.close()
    groups = {}
    for item in rows:
        if image_path(item).is_file():
            groups.setdefault(item["user_id"], []).append(item)
    items = next((items for items in groups.values() if {"top", "bottom", "shoes"} <= {i["slot"] for i in items}), None)
    if items is None:
        raise RuntimeError("A single wardrobe with top, bottom and shoes is required")
    top = next(i for i in items if i["slot"] == "top")
    bottom = next(i for i in items if i["slot"] == "bottom")
    scorer = PretrainedScorer()
    started = time.perf_counter()
    forward = scorer.retrieve_scores([[top]], [bottom])[0][0]
    backward = scorer.retrieve_scores([[bottom]], [top])[0][0]
    pair_score = scorer.score([[top, bottom]])[0]
    assert abs((forward + backward) / 2 - pair_score) < 1e-5
    retrieval_seconds = time.perf_counter() - started
    started = time.perf_counter()
    # Force the bounded path even when the user's wardrobe is small.
    with patch("app.recommendations.service.EXACT_POOL_LIMIT", 0):
        candidates, issue = generate(items, Intent(required_ids=[top["id"]]), retriever=scorer)
    assert issue is None and candidates and len(candidates) <= 256
    assert all(top["id"] in {i["id"] for i in candidate} for candidate in candidates)
    scores = scorer.score(candidates)
    assert len(scores) == len(candidates) and all(math.isfinite(s) for s in scores)
    wardrobe_seconds = time.perf_counter() - started
    # Synthetic scale check reuses three owned image references under distinct
    # in-memory IDs. It establishes work bounds, never recommendation quality.
    shoe = next(i for i in items if i["slot"] == "shoes")
    synthetic = [{**item, "id": f"synthetic-{item['slot']}-{index:02}"}
                 for item in [top, bottom, shoe] for index in range(30)]
    started = time.perf_counter()
    pool, issue = generate(synthetic, Intent(), retriever=scorer)
    assert issue is None and 0 < len(pool) <= 256
    stress_scores = scorer.score(pool)
    assert len(stress_scores) == len(pool) and all(math.isfinite(s) for s in stress_scores)
    report = {
        "model_version": scorer.version,
        "wardrobe_item_count": len(items), "candidate_count": len(candidates),
        "retrieval_seconds_including_load": retrieval_seconds,
        "candidate_search_and_scoring_seconds": wardrobe_seconds,
        "retrieval_loo_absolute_difference": abs((forward + backward) / 2 - pair_score),
        "unique_outfit_count": len({outfit_id(c) for c in candidates}),
        "synthetic_scale_check": {"possible_combinations": 30 ** 3, "scored_candidates": len(pool),
                                  "seconds": time.perf_counter() - started,
                                  "fixture": "90 in-memory items reusing three images; not a quality benchmark"},
        "checks": ["local checkpoint loaded", "retrieval agrees with existing two-item LOO score",
                   "bounded search preserves locked garment", "finite full-outfit scores",
                   "27000-combination synthetic wardrobe uses bounded real-model scoring"],
        "limitations": ["Functional smoke test only; no independent aesthetic judgments",
                        "Does not measure live stylist latency or try-on quality"],
    }
    (ROOT / "storage" / "recommendation_search_verification.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
