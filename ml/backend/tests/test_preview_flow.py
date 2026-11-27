import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.testclient import TestClient
from PIL import Image

from app.persistence import wardrobe as db
from app.api import styling as api
from app.profiles import fit
from app.profiles import service as profile
from app.persistence import conversations as store
from app.tryon import jobs as tryon
from app.contracts.styling import Intent
from app.recommendations.service import recommend
from test_recommendations_api import garment, Scorer, Stylist


class PreviewFlowTests(unittest.TestCase):
    def setUp(self):
        gate=patch('app.pose.validation.validate_person'); gate.start(); self.addCleanup(gate.stop)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        for target, name, value in [(store, "PATH", root / "state.db"), (db, "DB_PATH", root / "items.db"), (tryon, "ROOT", root / "jobs")]:
            patcher = patch.object(target, name, value)
            patcher.start(); self.addCleanup(patcher.stop)
        db.init_db(); store.init(); tryon.init()
        self.items = [garment("t", "top"), garment("b", "bottom"), garment("s", "shoes"), garment("d", "full"), garment("o", "outer")]
        for target, name, value in [(api, "wardrobe", lambda user: self.items), (api, "scorer", Scorer()), (api, "stylist", Stylist())]:
            patcher = patch.object(target, name, value); patcher.start(); self.addCleanup(patcher.stop)
        api.app.dependency_overrides[api.current_user] = lambda: "alice"
        self.addCleanup(api.app.dependency_overrides.clear)
        self.client = TestClient(api.app)

    def test_idm_rejects_bottom_and_two_garments_before_job_creation(self):
        buffer = io.BytesIO()
        Image.new("RGB", (128, 128)).save(buffer, format="PNG")
        files = [("file", ("person.png", buffer.getvalue())), ("garments", ("garment.png", buffer.getvalue()))]
        response = self.client.post("/phase3/tryon/uploads", files=files, data={"engine": "idm", "categories": "bottoms"})
        self.assertEqual(response.status_code, 422)
        for items in [[self.items[1]], self.items[:2]]:
            with self.assertRaises(HTTPException):
                tryon.outfit_plan(items, "idm")
        self.assertEqual(tryon.outfit_plan([self.items[0]], "idm")[0], [self.items[0]])


    def test_new_hosted_engines_dispatch_without_local_preparation_or_gpu(self):
        for engine in ["idm"]:
            data = io.BytesIO()
            Image.new("RGB", (128, 128)).save(data, format="PNG")
            job = tryon.create(data.getvalue(), "alice")
            directory = tryon.ROOT / job
            (directory / "manifest.json").write_text(json.dumps({"provider": engine, "person": str(directory / "person.png"),
                "output": str(directory / "result.png"), "garments": [], "item_ids": [], "warnings": []}))
            def generate(plan):
                Image.new("RGB", (128, 128)).save(plan["output"])
            module = "app.tryon.idm"
            with patch(module + ".run_manifest", side_effect=generate), patch.object(tryon.subprocess, "run") as local:
                tryon.run(job)
            self.assertEqual(tryon.read(job, "alice")["status"], "completed")
            local.assert_not_called()

    def test_count_control_returns_multiple_complete_outfits(self):
        self.items.append(garment('second-top', 'top'))
        response = self.client.post("/phase3/chat", json={"message": "Recommend outfits", "count": 3})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["intent"]["count"], 3)
        self.assertEqual(len(response.json()["outfits"]), 3)
        cores = [frozenset(i['id'] for i in o['items'] if i['slot'] in {'top','bottom','full'}) for o in response.json()['outfits']]
        self.assertEqual(len(set(cores)),3)
        self.assertEqual(self.client.post("/phase3/chat", json={"message": "outfits", "count": 6}).status_code, 422)

    def test_unexpected_worker_error_marks_failed_and_releases_slot(self):
        data=io.BytesIO(); Image.new('RGB',(128,192)).save(data,format='PNG')
        job=tryon.create(data.getvalue(),'alice'); directory=tryon.ROOT/job
        (directory/'manifest.json').write_text(json.dumps({'provider':'idm','person':str(directory/'person.png'),
            'output':str(directory/'result.png'),'garments':[],'item_ids':[],'warnings':[]}))
        with patch('app.tryon.idm.run_manifest',side_effect=RuntimeError('unexpected provider failure')):
            tryon.run(job)
        self.assertEqual(tryon.read(job,'alice')['status'],'failed')
        self.assertIn('unexpected provider failure',(directory/'inference.log').read_text())
        next_job=tryon.create(data.getvalue(),'alice')
        try: self.assertEqual(tryon.read(next_job,'alice')['status'],'queued')
        finally: tryon.SLOT.release()

    def test_hosted_shortlist_is_assessed_in_one_batch(self):
        class BatchStylist(Stylist):
            assessment_batch_size = 6
            def __init__(self):
                self.batches = []
            def assess(self, intent, candidates):
                self.batches.append([key for key, _ in candidates])
                return super().assess(intent, candidates)
        stylist = BatchStylist()
        items = [garment("t1", "top"), garment("t2", "top"), garment("b1", "bottom"),
                 garment("b2", "bottom"), garment("b3", "bottom"), garment("s", "shoes")]
        result = recommend(items, Intent(count=3), Scorer(), stylist)
        self.assertEqual(result.status, "recommended")
        self.assertEqual(len(result.outfits), 3)
        self.assertEqual(len(stylist.batches), 1)
        self.assertEqual(len(stylist.batches[0]), 6)

    def test_measurements_are_owned_and_pass_comparison_to_stylist(self):
        response = self.client.put("/phase3/items/t/measurements", json={"chest_cm": 90})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.put("/phase3/items/foreign/measurements", json={"chest_cm": 90}).status_code, 404)
        self.assertEqual(fit.read("bob", "t"), fit.GarmentMeasurements())
        saved = profile.Profile(chest_cm=98, comfort="Avoid tight clothes")
        notes = fit.notes("alice", self.items, saved)
        self.assertIn("difference -8", notes["t"][0])
        captured = []
        stylist = Stylist()
        original = stylist.assess
        def assess(intent, candidates):
            captured.extend(intent.preferences)
            return original(intent, candidates)
        stylist.assess = assess
        result = recommend(self.items, Intent(required_ids=["t"]), Scorer(), stylist, profile=saved, fit_notes=notes)
        self.assertTrue(result.outfits[0].fit_notes)
        self.assertTrue(any("difference -8" in value for value in captured))
        self.assertTrue(any("Avoid tight" in value for value in captured))

    def test_photo_plan_warns_about_omitted_pieces(self):
        selected, warnings = tryon.outfit_plan([self.items[0], self.items[2], self.items[4]], engine="weshop")
        self.assertEqual([item["slot"] for item in selected], ["top"])
        self.assertEqual(len(warnings), 3)
        self.assertFalse(any("sequential" in warning for warning in warnings))
        for values in [[self.items[0], self.items[3]], [self.items[0], self.items[0]], [self.items[2]]]:
            with self.assertRaises(HTTPException):
                tryon.outfit_plan(values)

    def test_upload_captures_engine_and_worn_reference_type_per_job(self):
        buffer = io.BytesIO()
        Image.new("RGB", (128, 128)).save(buffer, format="PNG")
        files = [("file", ("person.png", buffer.getvalue())), ("garments", ("top.png", buffer.getvalue()))]
        with patch.object(tryon, "run", side_effect=lambda _: tryon.SLOT.release()):
            response = self.client.post("/phase3/tryon/uploads", files=files,
                data={"categories": "tops", "engine": "weshop", "photo_type": "model"})
        self.assertEqual(response.status_code, 202, response.text)
        plan = json.loads((tryon.ROOT / response.json()["id"] / "manifest.json").read_text())
        self.assertEqual(plan["provider"], "weshop")
        self.assertEqual(plan["garments"][0]["photo_type"], "model")
        self.assertEqual(response.json()["engine"], "weshop")
        for change in [{"engine": "unknown"}, {"photo_type": "unknown"}]:
            result = self.client.post("/phase3/tryon/uploads", files=files,
                data={"categories": "tops", **change})
            self.assertEqual(result.status_code, 422)

    def test_outfit_job_delivers_owned_result_and_can_delete_person_photo(self):
        image = Path(self.temp.name) / "garment.png"
        Image.new("RGB", (128, 128), "blue").save(image)
        data = io.BytesIO(); Image.new("RGB", (128, 192), "gray").save(data, format="PNG")
        fit.save("alice", "t", fit.GarmentMeasurements(preview_rotation=90))
        def worker(job_id):
            try:
                plan = json.loads((tryon.ROOT / job_id / "manifest.json").read_text())
                self.assertEqual(plan["garments"][-1]["rotation"], 90)
                Image.new("RGB", (128, 192), "green").save(tryon.ROOT / job_id / "result.png")
                Image.new("RGB", (128, 192), "blue").save(tryon.ROOT / job_id / "prepared-1.png")
                (tryon.ROOT / job_id / "preparation.json").write_text(json.dumps({"references": [{"index": 1, "category": "bottoms", "warnings": []}]}))
                with store.connection() as conn:
                    conn.execute("UPDATE tryon_jobs SET status='completed' WHERE id=?", (job_id,))
            finally:
                tryon.SLOT.release()
        with patch.object(api, "image_path", return_value=image), patch.object(tryon, "run", side_effect=worker):
            rejected = self.client.post("/phase3/tryon/outfit", data={"item_ids": ["foreign"]}, files={"file": ("person.png", data.getvalue())})
            self.assertEqual(rejected.status_code, 404)
            response = self.client.post("/phase3/tryon/outfit", data={"item_ids": ["t", "s"], "engine": "weshop"}, files={"file": ("person.png", data.getvalue())})
        self.assertEqual(response.status_code, 202, response.text)
        job_id = response.json()["id"]
        self.assertTrue(any("Shoes" in warning for warning in response.json()["warnings"]))
        self.assertEqual(self.client.get(f"/phase3/tryon/{job_id}/image").status_code, 200)
        self.assertEqual(self.client.get(f"/phase3/tryon/{job_id}/references/1").status_code, 200)
        self.assertEqual(self.client.get(f"/phase3/tryon/{job_id}/references/3").status_code, 404)
        exported = self.client.get(f"/phase3/tryon/{job_id}/export")
        self.assertEqual(exported.status_code, 200)
        import zipfile
        with zipfile.ZipFile(io.BytesIO(exported.content)) as archive:
            self.assertEqual(set(archive.namelist()), {"person.png", "garment-1.png", "prompt.txt", "README.txt"})
            self.assertIn(b"existing tattoos", archive.read("prompt.txt"))
        api.app.dependency_overrides[api.current_user] = lambda: "bob"
        self.assertEqual(self.client.get(f"/phase3/tryon/{job_id}/references/1").status_code, 404)
        self.assertEqual(self.client.get(f"/phase3/tryon/{job_id}/export").status_code, 404)
        self.assertEqual(self.client.delete(f"/phase3/tryon/{job_id}").status_code, 404)
        api.app.dependency_overrides[api.current_user] = lambda: "alice"
        self.assertEqual(self.client.delete(f"/phase3/tryon/{job_id}").status_code, 200)
        self.assertFalse((tryon.ROOT / job_id).exists())

    def test_rotated_preview_image_is_private_and_keeps_original_unchanged(self):
        image = Path(self.temp.name) / "portrait.png"
        Image.new("RGBA", (128, 192), "blue").save(image)
        fit.save("alice", "t", fit.GarmentMeasurements(preview_rotation=90))
        with patch.object(api, "image_path", return_value=image), patch.object(db, "get_item", side_effect=lambda conn, item_id, user_id: self.items[0] if user_id == "alice" else None):
            response = self.client.get("/phase3/items/t/image?preview=true")
            self.assertEqual(response.status_code, 200)
            with Image.open(io.BytesIO(response.content)) as rotated:
                self.assertEqual(rotated.size, (192, 128))
            with Image.open(image) as original:
                self.assertEqual(original.size, (128, 192))
            api.app.dependency_overrides[api.current_user] = lambda: "bob"
            self.assertEqual(self.client.get("/phase3/items/t/image?preview=true").status_code, 404)

    def test_removed_manual_engine_cannot_create_a_job(self):
        with self.assertRaises(HTTPException) as caught:
            tryon.choose_provider("gemini_manual")
        self.assertEqual(caught.exception.status_code, 422)
