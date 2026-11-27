"""Real pretrained inference check on existing images; not an accuracy benchmark."""
import json
import math
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import torch
from app.persistence import wardrobe as db
from app.recommendations.scorer import PretrainedScorer
from app.recommendations.scorer import image_path


def main():
    torch.set_num_threads(4)
    conn = db.get_conn()
    try:
        rows = [dict(r) for r in conn.execute("SELECT * FROM items WHERE is_archived=0 ORDER BY user_id,id")]
    finally:
        conn.close()
    pair = None
    for top in rows:
        for bottom in rows:
            if top["user_id"] == bottom["user_id"] and top["slot"] == "top" and bottom["slot"] == "bottom" and image_path(top).exists() and image_path(bottom).exists():
                pair = [top, bottom]
                break
        if pair:
            break
    if not pair:
        raise RuntimeError("Two existing images from one user with top/bottom slots are needed")
    scorer = PretrainedScorer()
    started = time.perf_counter()
    scores = scorer.score([pair, list(reversed(pair))])
    elapsed = time.perf_counter() - started
    assert all(math.isfinite(s) for s in scores)
    assert abs(scores[0] - scores[1]) < 1e-5, "Outfit ordering changed score"
    report = {"model_version": scorer.version, "scores": scores, "seconds_including_load": elapsed,
              "checks": ["strict checkpoint loading", "real ResNet18 and LaBSE image/text features", "finite output", "permutation invariance"],
              "limitations": ["Two-item partial-outfit smoke check, not a complete outfit", "No independently labeled compatibility evaluation", "No claim of recommendation accuracy"]}
    target = ROOT / "storage" / "phase3_model_verification.json"
    target.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
