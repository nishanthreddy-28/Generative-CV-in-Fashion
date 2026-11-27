"""Preparation stages must hand the updated garment references to each other."""
import json
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
from integration_worker import tryon

class SessionPreparationTests(unittest.TestCase):
    def test_background_metadata_reaches_isolation_and_provider(self):
        stages=[]
        def background(manifest):
            path=Path(manifest);plan=json.loads(path.read_text())
            garment=plan["garments"][0]
            garment["source_path"]=garment["path"]
            garment["foreground_path"]=garment["path"]
            (path.parent/"prepared-manifest.json").write_text(json.dumps(plan))
            stages.append("background")
        def isolate(manifest,parser=None):
            path=Path(manifest);plan=json.loads(path.read_text())
            garment=plan["garments"][0]
            self.assertIn("source_path",garment)
            self.assertIn("foreground_path",garment)
            garment["prepared_path"]=garment["path"]
            path.write_text(json.dumps(plan))
            stages.append("isolation")
        def provider(plan):
            self.assertIn("prepared_path",plan["garments"][0])
            Image.new("RGB",(256,256),"white").save(plan["output"])
            path=Path(plan["person"]).parent/"manifest.json"
            audit=json.loads(path.read_text())
            audit.update(actual_provider="weshop",attempts=[{"provider":"weshop","status":"completed"}])
            path.write_text(json.dumps(audit))
            stages.append("provider")
        with patch.object(tryon,"_parser",object()),patch("scripts.prepare_tryon_background.prepare",side_effect=background),patch("scripts.prepare_tryon_garments.prepare",side_effect=isolate),patch("app.tryon.hosted.run_manifest",side_effect=provider):
            result=tryon.generate(Image.new("RGB",(256,256)),Image.new("RGB",(256,256)),"tops","weshop")
        self.assertEqual(stages,["background","isolation","provider"])
        self.assertEqual(result["provider"],"weshop")
        self.assertTrue(result["imageBase64"])

    def test_saved_reference_skips_both_cpu_preparation_stages(self):
        def provider(plan):
            self.assertIn("prepared_path",plan["garments"][0])
            Image.new("RGB",(256,256)).save(plan["output"])
            path=Path(plan["person"]).parent/"manifest.json"
            value=json.loads(path.read_text());value.update(actual_provider="weshop",attempts=[])
            path.write_text(json.dumps(value))
        with patch("scripts.prepare_tryon_background.prepare") as background,patch("scripts.prepare_tryon_garments.prepare") as isolate,patch("app.tryon.hosted.run_manifest",side_effect=provider):
            result=tryon.generate(Image.new("RGB",(256,256)),Image.new("RGB",(256,256)),"tops","weshop",prepared=True)
        background.assert_not_called();isolate.assert_not_called()
        self.assertEqual(result["provider"],"weshop")
