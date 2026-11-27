"""Live, free local LLM integration checks. No recommendation accuracy claims."""
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.persistence import wardrobe as db
from app.chat.stylist import LocalStylist
from app.contracts.styling import Intent
from app.recommendations.scorer import image_path


def main():
    stylist = LocalStylist()
    started = time.perf_counter()
    plain = stylist.interpret("Recommend one outfit", Intent(), [], [])
    assert plain.intent.count == 1 and plain.clarification is None
    assert plain.intent.occasion is None and plain.intent.weather is None
    detailed = stylist.interpret("I have a dinner date and it is cold. Recommend one outfit.", Intent(), [], [])
    assert detailed.intent.occasion and detailed.intent.weather
    assert "date" in detailed.intent.occasion.lower() and "cold" in detailed.intent.weather.lower()
    assert not detailed.intent.required_ids and not detailed.intent.excluded_ids
    conn = db.get_conn()
    try:
        rows = [dict(row) for row in conn.execute("SELECT * FROM items WHERE is_archived=0 ORDER BY user_id,id")]
    finally:
        conn.close()
    pair = None
    for top in rows:
        pair = next(([top, bottom] for bottom in rows if top["slot"] == "top" and bottom["slot"] == "bottom" and top["user_id"] == bottom["user_id"] and image_path(top).is_file() and image_path(bottom).is_file()), None)
        if pair:
            break
    if not pair:
        raise RuntimeError("Saved top/bottom images needed for the image assessment check")
    assessed = stylist.assess(Intent(), [("real-partial-outfit", pair)])
    report = {"model": stylist.model, "plain_request": plain.model_dump(), "contextual_request": detailed.model_dump(),
              "image_assessment": {key: value.model_dump() for key, value in assessed.items()},
              "seconds": time.perf_counter() - started,
              "limitation": "Schema and real text/image transport checks only; partial outfit, no human aesthetic validation"}
    (ROOT / "storage" / "phase3_chat_verification.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
