"""One CPU model set per worker process; initialization never retrains models."""
import threading
from app.recommendations.scorer import PretrainedScorer
tagger=None
stylist=None
scorer=PretrainedScorer()
lock=threading.RLock()
error=None

def models():
    global tagger,stylist,error
    with lock:
        try:
            import torch
            torch.set_num_threads(4)
            if tagger is None:
                from app.wardrobe.tagger import Tagger
                tagger=Tagger(device="cpu")
            if stylist is None:
                from app.chat.stylist import create_stylist
                stylist=create_stylist()
            error=None
            return tagger,scorer,stylist
        except Exception:
            error="Model initialization failed"
            raise

def warm():
    try: models()
    except Exception: pass
