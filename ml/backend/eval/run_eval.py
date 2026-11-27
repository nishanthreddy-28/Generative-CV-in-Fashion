"""
Phase 2 evaluation. Run this against your hand-labelled set BEFORE
building Phase 3.

Prepare eval/labels.csv:
    filename,true_category,true_formality,photo_type
    shirt_01.jpg,Shirt,smart_casual,hanger
    jeans_03.jpg,Jeans,casual,flat-lay

Put the images in eval/images/.

Run:
    python -m eval.run_eval

Acceptance gates (from the spec):
    slot accuracy      >= 0.95   <- the hard one
    category top-1     >= 0.80
    category top-3     >= 0.93
    formality accuracy >= 0.75
    crashes            == 0
"""

from __future__ import annotations

import csv
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.wardrobe import gates
from app.wardrobe.pipeline import _flatten
from app.wardrobe.pipeline import _remove_background
from app.wardrobe.tagger import Tagger
from app.wardrobe.taxonomy import CAT_SLOT

EVAL_DIR   = Path(__file__).resolve().parent
IMAGES_DIR = EVAL_DIR / "images"
LABELS_CSV = EVAL_DIR / "labels.csv"

GATES = {
    "slot_accuracy":      0.95,
    "category_top1":      0.80,
    "category_top3":      0.93,
    "formality_accuracy": 0.75,
}


def main() -> int:
    if not LABELS_CSV.exists():
        print(f"Missing {LABELS_CSV}. See the docstring for the format.")
        return 1

    with open(LABELS_CSV, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    print(f"Loading model... ({len(rows)} eval images)")
    tagger = Tagger()

    results, crashes = [], []
    confusion = Counter()
    by_photo_type = defaultdict(lambda: {"n": 0, "cat": 0, "slot": 0})

    for i, row in enumerate(rows, 1):
        path = IMAGES_DIR / row["filename"]
        try:
            img = gates.g1_validate_image(path.read_bytes())
            cutout = _remove_background(img)
            ok, ratio = gates.g3_cutout_ok(cutout)
            if not ok:
                cutout = img.convert("RGBA")
            emb = tagger.embed(_flatten(cutout))
            tags = tagger.classify(emb)
        except Exception as e:
            crashes.append((row["filename"], repr(e)))
            print(f"  [{i}/{len(rows)}] CRASH {row['filename']}: {e}")
            continue

        true_cat  = row["true_category"].strip()
        true_slot = CAT_SLOT.get(true_cat, "?")
        pred_cat  = tags["category"]
        top3      = [pred_cat] + [a["category"] for a in tags["alternatives"]]

        cat_ok  = pred_cat == true_cat
        slot_ok = tags["slot"] == true_slot
        top3_ok = true_cat in top3
        form_ok = (tags["attributes"]["formality"]["value"]
                   == row.get("true_formality", "").strip())

        if not cat_ok:
            confusion[(true_cat, pred_cat)] += 1

        pt = row.get("photo_type", "unknown").strip() or "unknown"
        by_photo_type[pt]["n"] += 1
        by_photo_type[pt]["cat"] += int(cat_ok)
        by_photo_type[pt]["slot"] += int(slot_ok)

        results.append({
            "filename": row["filename"], "photo_type": pt,
            "true_category": true_cat, "pred_category": pred_cat,
            "cat_ok": cat_ok, "slot_ok": slot_ok, "top3_ok": top3_ok,
            "formality_ok": form_ok,
            "confidence": tags["confidence"], "margin": tags["margin"],
            "route": gates.g4_route(tags["confidence"], tags["margin"]),
            "cutout_ratio": ratio,
        })
        mark = "OK " if cat_ok else ("slot" if slot_ok else "MISS")
        print(f"  [{i}/{len(rows)}] {mark:4} {row['filename']:28} "
              f"{true_cat:12} -> {pred_cat:12} (m={tags['margin']:.3f})")

    n = len(results)
    if n == 0:
        print("No results.")
        return 1

    metrics = {
        "n":                  n,
        "crashes":            len(crashes),
        "slot_accuracy":      sum(r["slot_ok"] for r in results) / n,
        "category_top1":      sum(r["cat_ok"] for r in results) / n,
        "category_top3":      sum(r["top3_ok"] for r in results) / n,
        "formality_accuracy": sum(r["formality_ok"] for r in results) / n,
        "pct_needs_review":   sum(r["route"] != "auto" for r in results) / n,
    }

    print("\n" + "=" * 62)
    print("RESULTS")
    print("=" * 62)
    for k, thresh in GATES.items():
        v = metrics[k]
        print(f"  {k:22} {v:6.1%}   (gate {thresh:.0%})  "
              f"{'PASS' if v >= thresh else 'FAIL'}")
    print(f"  {'crashes':22} {len(crashes):6}   (gate 0)      "
          f"{'PASS' if not crashes else 'FAIL'}")
    print(f"  {'flagged for review':22} {metrics['pct_needs_review']:6.1%}")

    print("\nBY PHOTO TYPE  (this is the paper's interesting axis)")
    for pt, s in sorted(by_photo_type.items()):
        print(f"  {pt:12} n={s['n']:3}  cat={s['cat']/s['n']:6.1%}  "
              f"slot={s['slot']/s['n']:6.1%}")

    if confusion:
        print("\nTOP CONFUSIONS  (fix these prompts in taxonomy.py)")
        for (t, p), c in confusion.most_common(10):
            print(f"  {c:3}x  {t:14} -> {p}")

    if crashes:
        print("\nCRASHES")
        for fn, err in crashes:
            print(f"  {fn}: {err}")

    with open(EVAL_DIR / "results.json", "w", encoding="utf-8") as f:
        json.dump({"metrics": metrics, "results": results,
                   "confusions": {f"{t}->{p}": c
                                  for (t, p), c in confusion.items()}},
                  f, indent=2)
    print(f"\nWrote {EVAL_DIR / 'results.json'}")

    passed = all(metrics[k] >= t for k, t in GATES.items()) and not crashes
    print("\n" + ("ALL GATES PASSED - freeze schemas.py, start Phase 3."
                  if passed else
                  "GATES FAILED - see guidance in README before tuning."))
    return 0 if passed else 2


if __name__ == "__main__":
    sys.exit(main())
