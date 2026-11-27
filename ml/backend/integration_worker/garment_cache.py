"""Bounded five-minute RAM cache. No private image files survive a request."""
import copy
import hashlib
import threading
import time
from collections import OrderedDict
from dataclasses import replace
from pathlib import Path

class GarmentCache:
    def __init__(self,max_entries=32,max_bytes=32*1024*1024,ttl=300,clock=time.monotonic):
        self.entries=OrderedDict()
        self.bytes=0
        self.max_entries=max_entries
        self.max_bytes=max_bytes
        self.ttl=ttl
        self.clock=clock
        self.lock=threading.RLock()

    def _remove(self,key):
        entry=self.entries.pop(key)
        self.bytes-=entry["size"]

    def _expire(self):
        for key,entry in list(self.entries.items()):
            if self.clock()-entry["time"]>=self.ttl:self._remove(key)

    def analyse(self,raw,scope,tagger,root,process):
        from app.wardrobe import pipeline,tagger as tagger_module,background,color,gates,taxonomy
        from app.core import config
        fingerprint=hashlib.sha256()
        for module in (pipeline,tagger_module,background,color,gates,taxonomy,config):
            fingerprint.update(Path(module.__file__).read_bytes())
        digest=hashlib.sha256(scope.encode()+b"\0"+fingerprint.digest()+raw).hexdigest()
        root=Path(root)
        with self.lock:
            self._expire()
            entry=self.entries.get(digest)
            if entry is not None:
                self.entries.move_to_end(digest)
                folder=root/"cached";folder.mkdir(parents=True,exist_ok=True)
                image=folder/(digest+".webp");thumb=folder/(digest+"_thumb.webp")
                image.write_bytes(entry["image"]);thumb.write_bytes(entry["thumb"])
                return replace(copy.deepcopy(entry["result"]),image_path=str(image.relative_to(root)),thumb_path=str(thumb.relative_to(root)))
            result=process(raw,"inference",tagger,image_root=root)
            full=(root/result.image_path).read_bytes()
            thumbnail=(root/result.thumb_path).read_bytes()
            size=len(full)+len(thumbnail)+result.embedding.nbytes+8192
            if size<=self.max_bytes:
                while self.entries and (len(self.entries)>=self.max_entries or self.bytes+size>self.max_bytes):
                    self._remove(next(iter(self.entries)))
                self.entries[digest]={"time":self.clock(),"size":size,"result":copy.deepcopy(result),"image":full,"thumb":thumbnail}
                self.bytes+=size
            return result

cache=GarmentCache()
