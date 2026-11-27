import tempfile
import unittest
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.persistence import wardrobe as db
from app import main as studio
from app.wardrobe import gates
from app.api import items


class StudioTests(unittest.TestCase):
    def test_exact_upload_rejected_but_similar_photo_flagged(self):
        app = FastAPI()
        app.include_router(items.router)
        embedding = np.zeros(768, dtype=np.float32)
        embedding[0] = 1

        def process(raw, user_id, tagger, existing):
            duplicate, similarity = gates.g5_find_duplicate(embedding, existing)
            return SimpleNamespace(item_id=uuid.uuid4().hex, image_path="shirt.webp", thumb_path="shirt.webp",
                                   category="Shirt", slot="top", confidence=.99, margin=.9,
                                   attributes={key: {"value": value} for key, value in
                                               {"pattern": "solid", "formality": "casual", "season": "mild", "fit": "regular"}.items()},
                                   colors=[{"name": "blue", "hex": "#0000ff", "share": 1}], embedding=embedding,
                                   route="auto", alternatives=[], duplicate_of=duplicate, duplicate_score=similarity, warnings=[])

        with tempfile.TemporaryDirectory() as directory, patch.object(db, "DB_PATH", Path(directory) / "items.db"):
            db.init_db()
            app.state.db = db.get_conn()
            app.state.tagger = object()
            try:
                with TestClient(app) as client, patch("app.api.items.pipeline.process_upload", side_effect=process):
                    first = client.post("/items", data={"user_id": "alice"}, files={"file": ("shirt.png", b"same shirt")})
                    second = client.post("/items", data={"user_id": "alice"}, files={"file": ("shirt.png", b"same shirt")})
                    self.assertEqual(first.status_code, 200, first.text)
                    self.assertEqual(second.status_code, 409, second.text)
                    self.assertEqual(second.json()["detail"]["code"], "exact_duplicate")
                    second = client.post("/items", data={"user_id": "alice"}, files={"file": ("other.png", b"different photo")})
                    self.assertEqual(second.status_code, 200, second.text)
                    self.assertNotEqual(first.json()["item"]["id"], second.json()["item"]["id"])
                    self.assertEqual(second.json()["duplicate_of"], first.json()["item"]["id"])
                    self.assertTrue(any("Possible duplicate" in warning for warning in second.json()["warnings"]))
                    self.assertEqual(len(client.get("/items?user_id=alice").json()), 2)
                    foreign = client.post("/items", data={"user_id": "bob"}, files={"file": ("shirt.png", b"same shirt")})
                    self.assertEqual(foreign.status_code, 200)
                    self.assertIsNone(foreign.json()["duplicate_of"])
                    client.delete(f"/items/{first.json()['item']['id']}?user_id=alice")
                    self.assertEqual(client.post("/items", data={"user_id": "alice"}, files={"file": ("shirt.png", b"same shirt")}).status_code, 200)
            finally:
                app.state.db.close()

    def test_combined_studio_uses_one_origin(self):
        with patch.dict("os.environ", {"PHASE3_DEV_USER_ID": "alice"}):
            client = TestClient(studio.app, client=("127.0.0.1", 50000))
            self.assertEqual(client.get("/studio/session").json(), {"user_id": "alice", "phase2_api": ""})
            self.assertEqual(client.get("/").status_code, 200)
            self.assertEqual(client.get("/studio/assets/body-analysis.js").status_code, 200)
