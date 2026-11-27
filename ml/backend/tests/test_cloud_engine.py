import copy
import hashlib
import io
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

from app.cloud.service import CloudEngine
from app.cloud.service import CloudError
from test_recommendations_api import garment, Scorer, Stylist


class SupabaseDouble:
    user = "00000000-0000-0000-0000-000000000001"
    def __init__(self):
        self.records = [{"id": name * 32, "data": garment(name * 32, slot), "measurements": {"chest_cm": 90} if slot == "top" else {}, "upload_sha256": hashlib.sha256(b"same").hexdigest()}
                        for name, slot in [("a", "top"), ("b", "bottom"), ("c", "shoes")]]
        self.writes, self.downloads, self.uploads = [], [], []
        buffer = io.BytesIO(); Image.new("RGB", (128, 192), "gray").save(buffer, format="PNG")
        self.raw = buffer.getvalue()
    def inventory(self): return copy.deepcopy(self.records)
    def rows(self, table, **filters):
        return [{"data": {"chest_cm": 98, "styles": ["minimal"]}}] if table == "dd_profiles" else []
    def download(self, path): self.downloads.append(path); return self.raw
    def signed(self, path): return "https://example.supabase.co/private/" + path
    def insert(self, table, row): self.writes.append((table, copy.deepcopy(row))); return [row]
    def upload(self, path, raw): self.uploads.append((path, raw))
    def call(self, method, path, **kwargs): self.writes.append((path, copy.deepcopy(kwargs)))


class CloudEngineTests(unittest.TestCase):
    def setUp(self):
        gate=patch('app.pose.validation.validate_person'); gate.start(); self.addCleanup(gate.stop)

    def test_greeting_does_not_run_stylist_or_download_images(self):
        sb = SupabaseDouble()
        engine = CloudEngine(None, None, None, None)
        result = engine.chat(sb, {'message':'hii'})
        self.assertEqual(result['status'],'chat')
        self.assertEqual(result['outfits'],[])
        self.assertEqual(sb.downloads,[])
        self.assertEqual(sb.writes,[])

    def test_hosted_photo_persists_actual_backup_and_attempts(self):
        sb = SupabaseDouble()
        def generate(person, garments):
            self.assertEqual(len(garments),1)
            result=person.copy()
            result.info.update(tryon_provider='idm',tryon_attempts=[{'provider':'weshop','status':'failed'},{'provider':'idm','status':'completed'}],tryon_warnings=['Backup was used'])
            return result
        engine=CloudEngine(None,None,None,generate,photo_engine='weshop')
        result=engine.photo(sb,sb.user+'/uploads/person.png',[sb.records[0]['id']])
        self.assertEqual(result['requested_engine'],'weshop')
        self.assertEqual(result['engine'],'idm')
        self.assertEqual(len(result['attempts']),2)
        self.assertIn('Backup was used',result['warnings'])

    def test_chat_uses_owned_images_measurements_and_persists_state(self):
        sb = SupabaseDouble()
        engine = CloudEngine(None, Scorer(), Stylist(), None)
        result = engine.chat(sb, {"message": "Recommend one outfit", "count": 1})
        self.assertEqual(result["status"], "recommended")
        self.assertEqual(len(result["outfits"]), 1)
        self.assertIn("difference -8", result["outfits"][0]["fit_notes"][0])
        self.assertEqual(len(sb.downloads), 3)
        self.assertTrue(all(path.startswith(sb.user + "/") for path in sb.downloads))
        self.assertTrue(result["conversation_id"])
        self.assertEqual(sb.writes[-1][0], "dd_conversations")
        self.assertTrue(result["outfits"][0]["items"][0]["image_url"].startswith("https://"))
        with self.assertRaises(CloudError):
            engine.chat(sb, {"message": "another", "conversation_id": "f" * 32})

    def test_photo_uploads_result_privately_and_reports_omissions(self):
        sb = SupabaseDouble()
        engine = CloudEngine(None, None, None, lambda person, garments: person)
        result = engine.photo(sb, sb.user + "/uploads/person.png", [sb.records[0]['id'], sb.records[2]['id']])
        self.assertEqual(result["status"], "completed")
        self.assertTrue(any("Shoes" in warning for warning in result["warnings"]))
        self.assertTrue(sb.uploads[0][0].startswith(sb.user + "/results/"))
        self.assertEqual(sb.writes[0][0], "dd_preview_jobs")
        self.assertEqual(sb.writes[0][1]["data"]["status"], "processing")
        with self.assertRaises(CloudError): engine.photo(sb, "unused", ["f" * 32])

    def test_exact_duplicate_does_not_call_models(self):
        sb = SupabaseDouble(); sb.raw = b"same"
        with patch("app.cloud.service.pipeline.process_upload") as model:
            result = CloudEngine(None, None, None, None).tag(sb, sb.user + "/uploads/shirt.png")
        self.assertEqual(result["status"], "exact_duplicate")
        model.assert_not_called()
