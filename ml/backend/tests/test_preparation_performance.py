import io
import json
import os
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import numpy as np
import torch
from PIL import Image

from app.wardrobe import background
from app.core import mask_cache
from app.wardrobe import pipeline
from scripts import prepare_tryon_background as bg_stage
from scripts import prepare_tryon_garments as garment_stage


class PreparationPerformanceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        patcher = patch.object(mask_cache, "ROOT", self.root / "cache")
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_mask_cache_invalidates_pixels_policy_dimensions_and_expiry(self):
        source = Image.new("RGB", (128, 128), "blue")
        identifier = mask_cache.key(source, "v1")
        mask_cache.put(identifier, Image.new("L", source.size, 200))
        self.assertEqual(mask_cache.get(identifier, source.size).getpixel((0, 0)), 200)
        self.assertIsNone(mask_cache.get(identifier, (64, 64)))
        self.assertNotEqual(identifier, mask_cache.key(source, "v2"))
        self.assertNotEqual(identifier, mask_cache.key(Image.new("RGB", source.size, "red"), "v1"))
        path = mask_cache.ROOT / (identifier + ".png")
        os.utime(path, (0, 0))
        self.assertIsNone(mask_cache.get(identifier, source.size))
        self.assertFalse(path.exists())

    def test_corrupt_and_full_cache_do_not_break_inference(self):
        mask_cache.ROOT.mkdir()
        (mask_cache.ROOT / "broken.png").write_bytes(b"bad png")
        self.assertIsNone(mask_cache.get("broken", (128, 128)))
        with patch.object(mask_cache, "MAX_ENTRIES", 2):
            for identifier in ["a", "b", "c"]:
                mask_cache.put(identifier, Image.new("L", (16, 16), 100))
        self.assertLessEqual(len(list(mask_cache.ROOT.glob("*.png"))), 2)

    def test_background_repeat_avoids_model_and_preserves_existing_alpha(self):
        source = Image.new("RGBA", (128, 128), (0, 0, 255, 120))
        def infer(rgb):
            result = rgb.convert("RGBA")
            result.putalpha(Image.new("L", rgb.size, 200))
            return result
        with patch.object(background, "_infer", side_effect=infer) as model:
            first = background.remove_background(source)
            second = background.remove_background(source)
        self.assertEqual(model.call_count, 1)
        self.assertEqual(first.tobytes(), second.tobytes())
        self.assertEqual(second.getchannel("A").getextrema(), (120, 120))

    def test_wardrobe_cutout_is_reused_but_opaque_fallback_is_processed(self):
        source = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
        source.paste((0, 0, 255, 255), (30, 20, 100, 110))
        path = self.root / "source.png"
        source.save(path)
        manifest = self.root / "manifest.json"
        plan = {"garments": [{"path": str(path), "category": "tops", "wardrobe_cutout": True}]}
        manifest.write_text(json.dumps(plan))
        with patch.object(bg_stage, "remove_background", return_value=source) as model:
            bg_stage.prepare(manifest)
            model.assert_not_called()
            Image.new("RGB", source.size).save(path)
            plan["garments"][0]["rotation"] = 45
            manifest.write_text(json.dumps(plan))
            bg_stage.prepare(manifest)
            model.assert_called_once()

    def test_cached_parser_labels_skip_parser_import_and_preserve_prepared_pixels(self):
        rgb = Image.new("RGB", (200, 300), "blue")
        rgba = rgb.convert("RGBA")
        labels = Image.new("L", rgb.size, 3)
        mask_cache.put(mask_cache.key(rgb, garment_stage.PARSER_VERSION), labels)
        rgb.save(self.root / "source.png")
        rgba.save(self.root / "foreground.png")
        manifest = self.root / "prepared-manifest.json"
        manifest.write_text(json.dumps({"garments": [{"source_path": str(self.root / "source.png"),
            "foreground_path": str(self.root / "foreground.png"), "category": "tops"}]}))
        # If the package is touched on a hit, this fake package cannot supply it.
        with patch.dict("sys.modules", {"fashn_human_parser": None}):
            garment_stage.prepare(manifest)
        info = json.loads((self.root / "preparation.json").read_text())["references"][0]
        self.assertTrue(info["parser_cache_hit"])
        with Image.open(self.root / "prepared-1.png") as prepared:
            self.assertEqual(prepared.getpixel((prepared.width // 2, prepared.height // 2)), (0, 0, 255))

    def test_failed_cutout_reuses_original_embedding_without_changing_tags(self):
        image = Image.new("RGB", (128, 128), "blue")
        output = io.BytesIO()
        image.save(output, format="PNG")
        tagger = Mock()
        vector = torch.ones(768) / np.sqrt(768)
        tagger.embed.return_value = vector
        tagger.clothing_score.return_value = 1.0
        tagger.classify.return_value = {"category": "Shirt", "slot": "top", "confidence": .9, "margin": .2,
                                       "alternatives": [], "attributes": {}}
        with patch.object(pipeline, "_remove_background", return_value=image.convert("RGBA")), \
             patch.object(pipeline, "_save_images", return_value=("image.webp", "thumb.webp")), \
             patch.object(pipeline, "extract_colors", return_value=[]):
            result = pipeline.process_upload(output.getvalue(), "alice", tagger)
        tagger.embed.assert_called_once()
        self.assertEqual(result.category, "Shirt")
        np.testing.assert_allclose(result.embedding, vector.numpy())
