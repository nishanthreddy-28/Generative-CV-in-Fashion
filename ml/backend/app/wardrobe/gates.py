"""
Gates G1-G5. Each raises GateError with a user-facing message, or returns
a value. Nothing here silently guesses.
"""

from __future__ import annotations

import io

import numpy as np
from PIL import Image, ImageOps

from app.core.config import MAX_UPLOAD_BYTES
from app.core.config import MAX_IMAGE_SIDE
from app.core.config import MIN_IMAGE_SIDE
from app.core.config import ALLOWED_FORMATS
from app.core.config import CLOTHING_GATE_THRESH
from app.core.config import CUTOUT_MIN_RATIO
from app.core.config import CUTOUT_MAX_RATIO
from app.core.config import ALPHA_THRESH
from app.core.config import MARGIN_THRESH
from app.core.config import CONFIDENCE_THRESH
from app.core.config import DUPLICATE_THRESH

# register HEIC support if available (iPhone uploads)
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:  # pragma: no cover
    pass


class GateError(Exception):
    """Raised when an upload cannot proceed. .message is user-facing."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


# ---------------------------------------------------------------------------
# G1 - file validation
# ---------------------------------------------------------------------------

def g1_validate_image(raw: bytes) -> Image.Image:
    """
    bytes -> RGB PIL image, EXIF-rotated and downscaled.
    Raises GateError on anything unusable.
    """
    if len(raw) > MAX_UPLOAD_BYTES:
        raise GateError(
            "file_too_large",
            f"That image is over {MAX_UPLOAD_BYTES // (1024 * 1024)}MB. "
            "Try a smaller photo.")

    if len(raw) == 0:
        raise GateError("empty_file", "That file appears to be empty.")

    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except Exception:
        raise GateError(
            "unreadable",
            "We couldn't read that file. Try a JPG, PNG or HEIC photo.")

    if img.format and img.format.upper() not in ALLOWED_FORMATS:
        raise GateError(
            "bad_format",
            f"{img.format} images aren't supported. Try JPG, PNG or HEIC.")

    # honour EXIF orientation BEFORE anything else - sideways photos tag badly
    img = ImageOps.exif_transpose(img)
    img = img.convert("RGB")

    if min(img.size) < MIN_IMAGE_SIDE:
        raise GateError(
            "too_small",
            "That image is too small to analyse. Try a larger photo.")

    if max(img.size) > MAX_IMAGE_SIDE:
        img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE), Image.LANCZOS)

    return img


# ---------------------------------------------------------------------------
# G2 - is this clothing
# ---------------------------------------------------------------------------

def g2_clothing_gate(score: float) -> None:
    """score from Tagger.clothing_score. Raises if it doesn't look like a garment."""
    if score < CLOTHING_GATE_THRESH:
        raise GateError(
            "not_clothing",
            "This doesn't look like a piece of clothing. "
            "Try a photo of a single garment on a plain background.")


# ---------------------------------------------------------------------------
# G3 - cutout sanity
# ---------------------------------------------------------------------------

def g3_cutout_ok(cutout: Image.Image) -> tuple[bool, float]:
    """
    Returns (usable, foreground_ratio).
    usable=False means fall back to the original image, not an error.
    """
    alpha = np.array(cutout.convert("RGBA"))[:, :, 3]
    ratio = float((alpha > ALPHA_THRESH).mean())
    return (CUTOUT_MIN_RATIO <= ratio <= CUTOUT_MAX_RATIO), round(ratio, 4)


# ---------------------------------------------------------------------------
# G4 - confidence routing
# ---------------------------------------------------------------------------

def g4_route(confidence: float, margin: float) -> str:
    """
    'auto'    -> accept silently
    'review'  -> accept but surface alternatives for a one-tap fix
    'ask'     -> too uncertain, make the user choose
    """
    if confidence < CONFIDENCE_THRESH:
        return "ask"
    if margin < MARGIN_THRESH:
        return "review"
    return "auto"


# ---------------------------------------------------------------------------
# G5 - duplicate detection
# ---------------------------------------------------------------------------

def g5_find_duplicate(emb: np.ndarray,
                      existing: list[tuple[str, np.ndarray]]
                      ) -> tuple[str | None, float]:
    """
    emb: (dim,) L2-normalised. existing: [(item_id, embedding), ...].
    Returns (duplicate_item_id | None, best_similarity).
    """
    if not existing:
        return None, 0.0

    ids  = [i for i, _ in existing]
    mat  = np.stack([e for _, e in existing])
    sims = mat @ emb                       # both L2-normalised -> cosine
    best = int(np.argmax(sims))
    score = float(sims[best])

    return (ids[best] if score >= DUPLICATE_THRESH else None), round(score, 4)
