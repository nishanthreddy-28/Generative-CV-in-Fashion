"""Bounded local cache of segmentation masks only, never RGB photographs."""
import hashlib
import os
import tempfile
import time
from pathlib import Path

from PIL import Image
from app.core.config import STORAGE_DIR

ROOT = STORAGE_DIR / "mask-cache"
MAX_ENTRIES = 128
TTL_SECONDS = 7 * 24 * 60 * 60


def key(image, version):
    digest = hashlib.sha256(version.encode())
    digest.update(f"{image.mode}:{image.size}".encode())
    digest.update(image.tobytes())
    return digest.hexdigest()


def get(identifier, size):
    path = ROOT / (identifier + ".png")
    try:
        if time.time() - path.stat().st_mtime > TTL_SECONDS:
            path.unlink(missing_ok=True)
            return None
        with Image.open(path) as source:
            if source.size != size or source.mode != "L":
                return None
            return source.copy()
    except (OSError, ValueError):
        return None


def put(identifier, mask):
    temporary = None
    try:
        ROOT.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=ROOT, suffix=".tmp", delete=False) as file:
            temporary = Path(file.name)
        mask.save(temporary, format="PNG")
        os.replace(temporary, ROOT / (identifier + ".png"))
        # Bounds and expiry are enforced on writes as well as reads.
        files = sorted(ROOT.glob("*.png"), key=lambda path: path.stat().st_mtime, reverse=True)
        for index, path in enumerate(files):
            if index >= MAX_ENTRIES or time.time() - path.stat().st_mtime > TTL_SECONDS:
                path.unlink(missing_ok=True)
    except OSError:
        # A full/read-only cache must not make model inference fail.
        pass
    finally:
        if temporary is not None:
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass
