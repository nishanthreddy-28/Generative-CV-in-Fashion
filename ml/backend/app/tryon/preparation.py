"""Garment-only reference preparation; never generate or repaint garment pixels."""
import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import label

CATEGORY_LABELS = {"tops": (3, 4), "bottoms": (5, 6, 7), "one-pieces": (4,)}
BODY_LABELS = (1, 2, 12, 13, 14, 15, 16)


def prepare_garment(source, foreground, labels, category, return_cutout=False):
    """Intersect semantic clothing with foreground, crop, and pad without stretching."""
    if category not in CATEGORY_LABELS or labels.shape != (source.height, source.width) or foreground.size != source.size:
        raise ValueError("Invalid garment category or segmentation dimensions")
    alpha = np.asarray(foreground.getchannel("A"))
    target = np.isin(labels, CATEGORY_LABELS[category])
    body_fraction = float(np.isin(labels, BODY_LABELS).mean())
    target_fraction = float((target & (alpha > 32)).mean())
    warnings = []
    if target_fraction < .02:
        if body_fraction >= .005 or float(np.isin(labels, (3, 4, 5, 6)).mean()) > .05:
            raise ValueError("The selected clothing type could not be isolated. Check its type and rotation, or upload a clearer garment photo.")
        # The human parser can miss a genuine flat-lay. Foreground is safe only
        # when the parser finds neither a donor body nor another clothing type.
        mask = alpha.copy()
        warnings.append("Garment segmentation was uncertain; the foreground cutout was used. Check the prepared reference.")
        method = "foreground-only"
    else:
        semantic = Image.fromarray((target.astype(np.uint8) * 255)).filter(ImageFilter.MedianFilter(3))
        mask = np.minimum(alpha, np.asarray(semantic))
        method = "foreground-and-garment"
    # Detached flecks (e.g. a floral bedsheet visible between trouser legs)
    # should not become garment print. Keep substantial disconnected pieces.
    component_mask = mask > 32
    if category == "bottoms":
        # Break tiny bridges to sheets/threads beside flat-lay trouser legs.
        # Avoid opening delicate straps on tops or dresses.
        core = Image.fromarray(component_mask.astype(np.uint8) * 255)
        component_mask = np.asarray(core.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))) > 0
        mask = np.where(component_mask, mask, 0).astype(np.uint8)
    components, _ = label(component_mask)
    sizes = np.bincount(components.ravel())
    sizes[0] = 0
    if sizes.max() > 0:
        keep = sizes >= max(24, sizes.max() * .01)
        keep[0] = False
        mask = np.where(keep[components], mask, 0).astype(np.uint8)
    visible = mask > 32
    if visible.mean() < .02:
        raise ValueError("Background removal left too little clothing. Upload a clearer reference.")
    ys, xs = np.where(visible)
    box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    cutout = source.convert("RGBA")
    cutout.putalpha(Image.fromarray(mask))
    cutout = cutout.crop(box)
    # Match FASHN's portrait ratio with whitespace, retaining aspect and detail.
    padding = max(8, round(max(cutout.size) * .06))
    width = max(cutout.width + 2 * padding, round((cutout.height + 2 * padding) * 2 / 3))
    height = max(cutout.height + 2 * padding, round(width * 3 / 2))
    prepared = Image.new("RGB", (width, height), "white")
    prepared.paste(cutout, ((width - cutout.width) // 2, (height - cutout.height) // 2), cutout.getchannel("A"))
    prepared.thumbnail((1536, 1536), Image.Resampling.LANCZOS)
    if min(cutout.size) < 256:
        warnings.append("The garment reference is low resolution; fine text and details may change.")
    info = {"method": method, "photo_type": "flat-lay", "body_fraction": round(body_fraction, 4),
                      "garment_fraction": round(target_fraction, 4), "crop": list(box),
                      "size": list(prepared.size), "warnings": warnings}

    return (prepared, info, cutout) if return_cutout else (prepared, info)
