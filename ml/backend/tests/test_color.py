"""Colour regression fixtures: faded denim, neutrals and foreground masking."""
import unittest
from PIL import Image
from app.wardrobe.color import extract_colors, _name_of

class DenimColourTests(unittest.TestCase):
    def test_faded_denim_is_blue_not_grey(self):
        for rgb in [(165,185,200),(140,170,190),(160,180,195),(80,110,135),(65,90,110)]:
            with self.subTest(rgb=rgb):
                self.assertIn(_name_of(rgb), {"light blue","blue","navy"})

    def test_grey_remains_grey(self):
        for rgb in [(128,128,128),(200,200,200),(185,188,190)]:
            with self.subTest(rgb=rgb):
                self.assertIn(_name_of(rgb), {"grey","light grey"})

    def test_transparent_grey_background_does_not_outvote_denim(self):
        image=Image.new("RGBA",(160,160),(200,200,200,0))
        image.paste((140,170,190,255),(50,10,110,150))
        result=extract_colors(image)
        self.assertEqual(result[0]["name"],"light blue")
        self.assertGreater(result[0]["share"],.95)

    def test_canonical_red_and_green_are_preserved(self):
        self.assertEqual(_name_of((200,35,40)),"red")
        self.assertEqual(_name_of((55,140,70)),"green")


class ColourReviewTests(unittest.TestCase):
    def review(self,name,semantic,share=.9,margin=.4):
        from app.wardrobe.color import colour_review_needed
        return colour_review_needed([{"name":name,"share":share}],{"name":semantic,"margin":margin})

    def test_blue_grey_disagreement_requests_review(self):
        self.assertTrue(self.review("light grey","light blue"))

    def test_related_blue_shades_do_not_interrupt_the_user(self):
        self.assertFalse(self.review("light blue","navy"))

    def test_weak_semantic_signal_does_not_override_pixels(self):
        self.assertFalse(self.review("blue","grey",margin=.01))

    def test_multicolour_photo_is_not_forced_to_one_semantic_colour(self):
        self.assertFalse(self.review("red","blue",share=.4))


class HybridPipelineTests(unittest.TestCase):
    def test_disagreement_opens_review_without_changing_pixels(self):
        import tempfile
        from pathlib import Path
        import torch
        from unittest.mock import Mock,patch
        from app.wardrobe.pipeline import process_upload
        image=Image.new("RGBA",(160,160),(200,200,200,255))
        embedding=torch.tensor([1.,0.])
        tagger=Mock()
        tagger.embed.return_value=embedding
        tagger.clothing_score.return_value=1.
        tagger.classify.return_value={"category":"Jeans","slot":"bottom","confidence":.9,
            "margin":.5,"alternatives":[],"attributes":{}}
        tagger.colour_evidence.return_value={"name":"light blue","margin":.4}
        with tempfile.TemporaryDirectory() as folder, \
             patch("app.wardrobe.pipeline.gates.g1_validate_image",return_value=image.convert("RGB")), \
             patch("app.wardrobe.pipeline._remove_background",return_value=image), \
             patch("app.wardrobe.pipeline.gates.g3_cutout_ok",return_value=(True,.5)), \
             patch("app.wardrobe.pipeline.gates.g4_route",return_value="auto"):
            result=process_upload(b"fixture","test",tagger,image_root=Path(folder))
        self.assertEqual(result.route,"review")
        self.assertEqual(result.colors[0]["name"],"light grey")
        self.assertTrue(any("check the colour" in warning for warning in result.warnings))
        self.assertEqual(tagger.embed.call_count,2)
        tagger.colour_evidence.assert_called_once_with(embedding)

    def test_semantic_check_uses_existing_features(self):
        import torch
        from app.wardrobe.tagger import Tagger
        tagger=object.__new__(Tagger)
        tagger._color_names=["grey","light blue"]
        tagger._color_proto=torch.eye(2)
        result=tagger.colour_evidence(torch.tensor([0.,1.]))
        self.assertEqual(result["name"],"light blue")
        self.assertGreater(result["margin"],.15)
