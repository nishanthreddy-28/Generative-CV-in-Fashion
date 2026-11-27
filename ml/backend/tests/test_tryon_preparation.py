import unittest

import numpy as np
from PIL import Image

from app.tryon.preparation import prepare_garment


class PreparationTests(unittest.TestCase):
    def test_removes_donor_skin_other_clothing_and_foreground_holes(self):
        labels = np.zeros((300, 200), dtype=np.uint8)
        labels[40:180, 40:160] = 3
        labels[80:160, 10:40] = 12
        labels[180:280, 40:160] = 6
        pixels = np.full((300, 200, 3), 255, dtype=np.uint8)
        pixels[labels == 3] = [0, 100, 90]
        pixels[labels == 12] = [200, 150, 100]
        pixels[labels == 6] = [50, 50, 50]
        foreground = Image.fromarray(pixels).convert("RGBA")
        alpha = np.full(labels.shape, 255, dtype=np.uint8)
        alpha[100:120, 90:110] = 0
        foreground.putalpha(Image.fromarray(alpha))
        prepared, report = prepare_garment(Image.fromarray(pixels), foreground, labels, "tops")
        output = np.asarray(prepared)
        self.assertFalse(np.any(np.all(output == [200, 150, 100], axis=-1)))
        self.assertFalse(np.any(np.all(output == [50, 50, 50], axis=-1)))
        self.assertTrue(np.any(np.all(output == [0, 100, 90], axis=-1)))
        self.assertEqual(report["crop"], [40, 40, 160, 180])
        self.assertAlmostEqual(prepared.width / prepared.height, 2 / 3, places=2)

    def test_rejects_wrong_category_and_empty_foreground(self):
        source = Image.new("RGB", (200, 300), "blue")
        labels = np.full((300, 200), 3, dtype=np.uint8)
        for category, alpha in [("bottoms", 255), ("tops", 0)]:
            cutout = source.convert("RGBA"); cutout.putalpha(alpha)
            with self.assertRaises(ValueError):
                prepare_garment(source, cutout, labels, category)

    def test_uncertain_flat_lay_has_explicit_warning(self):
        source = Image.new("RGB", (200, 300), "blue")
        prepared, report = prepare_garment(source, source.convert("RGBA"), np.zeros((300, 200), dtype=np.uint8), "tops")
        self.assertTrue(report["warnings"])
        self.assertEqual(report["method"], "foreground-only")
        self.assertEqual(prepared.mode, "RGB")

    def test_detached_background_fleck_does_not_survive_as_clothing(self):
        source = Image.new("RGB", (200, 300), "blue")
        labels = np.zeros((300, 200), dtype=np.uint8)
        labels[40:250, 40:160] = 6
        labels[260:265, 180:185] = 6
        prepared, report = prepare_garment(source, source.convert("RGBA"), labels, "bottoms")
        self.assertEqual(report["crop"], [40, 40, 160, 250])
