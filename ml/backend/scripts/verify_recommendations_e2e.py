"""Real chat -> actual pretrained ranking -> actual visual judgment -> API response.

Uses an isolated, explicitly synthetic wardrobe with existing top/bottom photos
and one public sneaker fixture. Never inserts items into the real wardrobe DB.
"""
import json
import shutil
import sys
import tempfile
import time
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient
from app.persistence import wardrobe as db
from app.core.config import IMAGES_DIR
from app.core.config import STORAGE_DIR
from app.api import styling as api
from app.persistence import conversations as store
from app.recommendations.scorer import image_path


def main():
    conn = db.get_conn()
    try:
        rows = [dict(r) for r in conn.execute("SELECT * FROM items WHERE is_archived=0 ORDER BY user_id,id")]
    finally:
        conn.close()
    pair = None
    for top in rows:
        pair = next(([top.copy(), bottom.copy()] for bottom in rows if top["slot"] == "top" and bottom["slot"] == "bottom" and top["user_id"] == bottom["user_id"] and image_path(top).exists() and image_path(bottom).exists()), None)
        if pair:
            break
    if not pair:
        raise RuntimeError("Saved same-user top/bottom images required")
    fixture = STORAGE_DIR / "phase3_eval" / "red_sneaker.jpg"
    if not fixture.is_file():
        raise RuntimeError("Public sneaker verification fixture not downloaded; see PHASE3.md")
    with tempfile.TemporaryDirectory(dir=IMAGES_DIR, prefix="phase3-verify-") as directory:
        directory = Path(directory)
        shutil.copyfile(fixture, directory / "shoe.jpg")
        shoe = pair[0].copy()
        shoe.update(id="fixture_shoes", category="Sneakers", slot="shoes", image_path=str((directory / "shoe.jpg").relative_to(IMAGES_DIR)),
                    thumb_path=str((directory / "shoe.jpg").relative_to(IMAGES_DIR)), colors=json.dumps([{"name": "red", "hex": "#ff0000", "share": 1.0}]),
                    pattern="solid", formality="casual", season="mild", fit="regular", source="user_corrected", confidence=1.0, margin=1.0)
        items = pair + [shoe]
        for j, item in enumerate(items):
            item["id"] = ["fixture_top", "fixture_bottom", "fixture_shoes"][j]
            item["user_id"] = "verification-fixture"
        with patch.object(db, "DB_PATH", directory / "wardrobe.db"), patch.object(store, "PATH", directory / "conversation.db"):
            db.init_db()
            conn = db.get_conn()
            try:
                for item in items:
                    conn.execute("INSERT INTO items (" + ",".join(item) + ") VALUES (" + ",".join("?" for _ in item) + ")", list(item.values()))
                conn.commit()
            finally:
                conn.close()
            api.app.dependency_overrides[api.current_user] = lambda: "verification-fixture"
            try:
                with TestClient(api.app) as client:
                    started = time.perf_counter()
                    response = client.post("/phase3/chat", json={"message": "Recommend one casual outfit."})
                    response.raise_for_status()
                    first = response.json()
                    assert first["status"] == "recommended", first
                    assert first["intent"]["required_ids"] == [], "General request must not lock arbitrary items"
                    assert "casual" in json.dumps([first["intent"]["occasion"], first["intent"]["preferences"]]).lower(), "Explicit casual preference was lost"
                    assert len(first["outfits"]) == 1
                    assert {i["slot"] for i in first["outfits"][0]["items"]} == {"top", "bottom", "shoes"}
                    for item in first["outfits"][0]["items"]:
                        assert client.get(item["image_url"]).status_code == 200
                    another = client.post("/phase3/chat", json={"message": "Give me another outfit.", "conversation_id": first["conversation_id"]}).json()
                    assert another["status"] == "no_match", another
                    report = {"first_response": first, "another_status": another["status"], "seconds_total": time.perf_counter() - started,
                              "fixture_shoe_source": "https://images.unsplash.com/photo-1542291026-7eec264c27ff",
                              "checks": ["real local chat interpretation", "real pretrained recommendation weights", "real image judgment", "API outfit images", "conversation follow-up"],
                              "limitations": ["One isolated synthetic wardrobe; not a human quality study", "Identity overridden only in this isolated integration test; auth tested separately"]}
                    (STORAGE_DIR / "phase3_e2e_verification.json").write_text(json.dumps(report, indent=2))
                    print(json.dumps(report, indent=2))
            finally:
                api.app.dependency_overrides.clear()


if __name__ == "__main__":
    main()
