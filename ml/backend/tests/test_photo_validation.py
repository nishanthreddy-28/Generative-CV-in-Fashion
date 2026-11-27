import unittest
from types import SimpleNamespace as Point
from unittest.mock import patch
from fastapi import HTTPException
from PIL import Image
from app.pose import validation as photo_validation
from app.tryon import jobs as tryon
from app.chat.routing import FALLBACK
from app.chat.routing import conversational_reply


def standing():
    points=[Point(x=.5,y=.12,z=0.,visibility=.99) for _ in range(33)]
    for ids,x in [([11,13,15,23,25,27,29,31],.65),([12,14,16,24,26,28,30,32],.35)]:
        for i,y in zip(ids,[.25,.4,.55,.55,.72,.9,.92,.94]):
            points[i]=Point(x=x,y=y,z=0.,visibility=.99)
    return points


class PhotoGateTests(unittest.TestCase):
    def test_front_standing_and_invalid_poses(self):
        self.assertTrue(photo_validation.check_pose([standing()],600,1000)['validated'])
        for case in ['none','multiple','sideways','leaning','seated','bent_arm','crossed_legs','cropped','hidden_face']:
            with self.subTest(case=case):
                points=standing(); poses=[points]
                if case=='none': poses=[]
                elif case=='multiple': poses=[points,standing()]
                elif case=='sideways': points[11].z=.8
                elif case=='leaning': points[23].x+=.25;points[24].x+=.25
                elif case=='seated': points[25].y=.55
                elif case=='bent_arm': points[15].y=.3
                elif case=='crossed_legs': points[27].x,points[28].x=.3,.7
                elif case=='cropped': points[0].y=0
                elif case=='hidden_face': points[2].visibility=.1
                with self.assertRaises(HTTPException) as caught: photo_validation.check_pose(poses,600,1000)
                self.assertEqual(caught.exception.status_code,422)

    def test_tryon_does_not_require_measurement_pose_or_model(self):
        import io
        import tempfile
        from pathlib import Path
        from app.persistence import conversations as store
        data=io.BytesIO();Image.new('RGB',(128,192)).save(data,format='PNG')
        with tempfile.TemporaryDirectory() as tmp, patch.object(store,'PATH',Path(tmp)/'state.db'), patch.object(tryon,'ROOT',Path(tmp)/'jobs'), patch.object(photo_validation,'validate_person',side_effect=AssertionError('Try-on called measurement validator')) as gate:
            store.init();tryon.init()
            job=tryon.create(data.getvalue(),'alice')
            try:
                self.assertEqual(tryon.read(job,'alice')['status'],'queued')
                gate.assert_not_called()
            finally: tryon.SLOT.release()

    def test_validator_unavailable_does_not_allow_generation(self):
        with patch.object(photo_validation,'_detector',None), patch.object(photo_validation,'MODEL') as model:
            model.is_file.return_value=False
            with self.assertRaises(HTTPException) as caught: photo_validation.validate_person(Image.new('RGB',(128,192)))
            self.assertEqual(caught.exception.status_code,503)

    def test_smalltalk_gets_fixed_outfit_request_fallback(self):
        for message in ['hii','hello!','thanks','what can you do','how are you?']:
            self.assertEqual(conversational_reply(message),FALLBACK)
        self.assertIsNone(conversational_reply('hi, recommend a casual outfit'))
