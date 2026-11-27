"""
Orchestrates the full Phase 2 flow:
  bytes -> validated -> gated -> cut out -> embedded -> tagged -> saved images

Returns a TagResult that routes/items.py turns into a DB row.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from PIL import Image

from app.core.config import IMAGES_DIR
from app.core.config import THUMB_SIZE
from app.core.config import IMAGE_FORMAT
from app.core.config import IMAGE_QUALITY
from app.wardrobe import gates
from app.wardrobe.color import extract_colors, colour_review_needed
from app.wardrobe.tagger import Tagger

def _remove_background(img: Image.Image) -> Image.Image:
    """RGB -> RGBA cutout. Falls back to opaque original if rembg fails."""
    try:
        from app.wardrobe.background import remove_background
        return remove_background(img)
    except Exception:
        return img.convert("RGBA")


def _flatten(cutout: Image.Image) -> Image.Image:
    """RGBA cutout -> RGB on white. SigLIP expects 3 channels."""
    bg = Image.new("RGB", cutout.size, (255, 255, 255))
    bg.paste(cutout, mask=cutout.split()[3])
    return bg


@dataclass
class TagResult:
    item_id:        str
    image_path:     str
    thumb_path:     str
    category:       str
    slot:           str
    confidence:     float
    margin:         float
    alternatives:   list[dict]
    attributes:     dict
    colors:         list[dict]
    embedding:      np.ndarray
    route:          str                 # auto | review | ask
    cutout_used:    bool
    cutout_ratio:   float
    duplicate_of:   str | None = None
    duplicate_score: float = 0.0
    warnings:       list[str] = field(default_factory=list)


def _save_images(cutout: Image.Image, user_id: str, item_id: str, image_root: Path | None = None
                 ) -> tuple[str, str]:
    root = Path(image_root) if image_root is not None else Path(IMAGES_DIR)
    out_dir = root / user_id
    out_dir.mkdir(parents=True, exist_ok=True)

    ext = IMAGE_FORMAT.lower()
    full = out_dir / f"{item_id}.{ext}"
    thumb = out_dir / f"{item_id}_thumb.{ext}"

    cutout.save(full, IMAGE_FORMAT, quality=IMAGE_QUALITY)

    t = cutout.copy()
    t.thumbnail((THUMB_SIZE, THUMB_SIZE), Image.LANCZOS)
    t.save(thumb, IMAGE_FORMAT, quality=IMAGE_QUALITY)

    return str(full.relative_to(root)), str(thumb.relative_to(root))


def process_upload(raw: bytes,
                   user_id: str,
                   tagger: Tagger,
                   existing: list[tuple[str, np.ndarray]] | None = None,
                   image_root: Path | None = None,
                   ) -> TagResult:
    """
    Full pipeline. Raises gates.GateError with a user-facing message on
    anything unusable.
    """
    warnings: list[str] = []

    # G1 ---------------------------------------------------------------
    img = gates.g1_validate_image(raw)

    # G2 - score on the ORIGINAL image, before background removal ------
    raw_emb = tagger.embed(img)
    gates.g2_clothing_gate(tagger.clothing_score(raw_emb))

    # background removal ------------------------------------------------
    cutout = _remove_background(img)

    # G3 ---------------------------------------------------------------
    ok, ratio = gates.g3_cutout_ok(cutout)
    if not ok:
        cutout = img.convert("RGBA")
        warnings.append(
            "Background removal didn't work well on this photo - "
            "using the original image.")

    # embed the cutout (better signal than the raw photo) ---------------
    # Rejected removal uses the unchanged opaque original; its embedding already
    # exists from the clothing gate. Keep both passes for a usable cutout.
    emb = tagger.embed(_flatten(cutout)) if ok else raw_emb
    emb_np = emb.detach().cpu().numpy().astype(np.float32)

    # classify ----------------------------------------------------------
    tags = tagger.classify(emb)

    # G4 ---------------------------------------------------------------
    route = gates.g4_route(tags["confidence"], tags["margin"])

    # G5 ---------------------------------------------------------------
    dup_id, dup_score = gates.g5_find_duplicate(emb_np, existing or [])

    # colours + persist -------------------------------------------------
    colors = extract_colors(cutout)
    # Do not silently override pixel measurements with semantic guesses.
    # A disagreement opens the existing editable review form before saving.
    colour_check = getattr(tagger, "colour_evidence", None)
    if ok and callable(colour_check) and colour_review_needed(colors, colour_check(emb)):
        warnings.append("Please check the colour: lighting or fabric texture makes this suggestion uncertain.")
        if route == "auto":
            route = "review"
    elif not ok:
        warnings.append("Please check the colour: the background could not be excluded reliably.")
        if route == "auto":
            route = "review"
    item_id = uuid.uuid4().hex
    image_path, thumb_path = _save_images(cutout, user_id, item_id, image_root)

    return TagResult(
        item_id=item_id,
        image_path=image_path,
        thumb_path=thumb_path,
        category=tags["category"],
        slot=tags["slot"],
        confidence=tags["confidence"],
        margin=tags["margin"],
        alternatives=tags["alternatives"],
        attributes=tags["attributes"],
        colors=colors,
        embedding=emb_np,
        route=route,
        cutout_used=ok,
        cutout_ratio=ratio,
        duplicate_of=dup_id,
        duplicate_score=dup_score,
        warnings=warnings,
    )
