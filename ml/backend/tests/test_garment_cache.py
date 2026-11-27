import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from integration_worker.garment_cache import GarmentCache
from app.wardrobe.pipeline import TagResult
import numpy as np

class CacheTests(unittest.TestCase):
    def processor(self):
        calls=[]
        def process(raw,user,tagger,image_root=None):
            calls.append(raw)
            root=Path(image_root);(root/"full.webp").write_bytes(b"full");(root/"thumb.webp").write_bytes(b"thumb")
            return TagResult("id","full.webp","thumb.webp","Shirt","top",.9,.1,[],{},[],np.zeros(2),"auto",True,.5)
        return calls,process

    def test_same_scope_reuses_result_and_recreates_request_local_images(self):
        cache=GarmentCache();calls,process=self.processor()
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            cache.analyse(b"image","owner-a",None,first,process)
            result=cache.analyse(b"image","owner-a",None,second,process)
            self.assertEqual(len(calls),1)
            self.assertEqual((Path(second)/result.image_path).read_bytes(),b"full")

    def test_other_user_and_changed_photo_do_not_share_results(self):
        cache=GarmentCache();calls,process=self.processor()
        with tempfile.TemporaryDirectory() as root:
            for raw,scope in [(b"one","a"),(b"one","b"),(b"two","a")]:
                cache.analyse(raw,scope,None,root,process)
        self.assertEqual(len(calls),3)

    def test_expiry_and_entry_limit_are_enforced(self):
        now=[0];cache=GarmentCache(max_entries=1,ttl=5,clock=lambda:now[0]);calls,process=self.processor()
        with tempfile.TemporaryDirectory() as root:
            cache.analyse(b"one","a",None,root,process)
            now[0]=6;cache.analyse(b"one","a",None,root,process)
            cache.analyse(b"two","a",None,root,process)
        self.assertEqual(len(calls),3);self.assertEqual(len(cache.entries),1)
