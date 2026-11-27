"""Shared, CPU-only BiRefNet-lite background removal with a workspace cache."""
import os
import hashlib
import threading
from pathlib import Path

from PIL import Image

from app.core.config import STORAGE_DIR
from app.core import mask_cache

_session = None
_lock = threading.Lock()
_version = "birefnet-general-lite:" + hashlib.sha256(Path(__file__).read_bytes()).hexdigest()


def remove_background(image: Image.Image) -> Image.Image:
    rgb = Image.new("RGB", image.size, "white")
    rgb.paste(image, mask=image.getchannel("A") if "A" in image.getbands() else None)
    identifier = mask_cache.key(image, _version)
    # Keep this off the GPU and limit RAM/thread pressure beside the try-on worker.
    with _lock:
        alpha = mask_cache.get(identifier, image.size)
        if alpha is not None:
            cutout = rgb.convert("RGBA")
            cutout.putalpha(alpha)
        else:
            cutout = _infer(rgb)
            mask_cache.put(identifier, cutout.getchannel("A"))
    # An existing transparent cutout must never become opaque again.
    if "A" in image.getbands():
        from PIL import ImageChops
        cutout.putalpha(ImageChops.darker(cutout.getchannel("A"), image.getchannel("A")))
    return cutout


def _infer(rgb):
    global _session
    from rembg import new_session, remove
    import onnxruntime as ort

    if _session is None:
        cache = STORAGE_DIR / "rembg-models"
        cache.mkdir(parents=True, exist_ok=True)
        os.environ["REMBG_HOME"] = str(cache)
        os.environ["U2NET_HOME"] = str(cache)
        options = ort.SessionOptions()
        options.intra_op_num_threads = 2
        options.inter_op_num_threads = 1
        options.enable_cpu_mem_arena = False
        options.enable_mem_pattern = False
        _session = new_session("birefnet-general-lite", model_dir=str(cache),
                               providers=["CPUExecutionProvider"], sess_opts=options)
    return remove(rgb, session=_session).convert("RGBA")
