"""Dominant colour extraction from an RGBA cutout, named in CIELAB."""

import numpy as np
from PIL import Image
from sklearn.cluster import KMeans

from app.core.config import ALPHA_THRESH
from app.core.config import COLOR_K
from app.wardrobe.taxonomy import COLOR_ANCHORS


def srgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    """(N,3) sRGB 0-255 -> (N,3) CIELAB, D65 white point."""
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805],
                  [0.2126, 0.7152, 0.0722],
                  [0.0193, 0.1192, 0.9505]])
    xyz = (c @ m.T) / np.array([0.95047, 1.0, 1.08883])
    d = 6.0 / 29.0
    f = np.where(xyz > d ** 3, np.cbrt(xyz), xyz / (3 * d * d) + 4.0 / 29.0)
    return np.stack([116 * f[:, 1] - 16,
                     500 * (f[:, 0] - f[:, 1]),
                     200 * (f[:, 1] - f[:, 2])], axis=1)


# Faded denim is much less saturated than the canonical blue swatches.
# Multiple prototypes retain the public colour names without forcing these
# foreground colours toward the neutral grey anchors.
_PROTOTYPES = list(COLOR_ANCHORS.items()) + [
    ("light blue", (165, 185, 200)),
    ("light blue", (140, 170, 190)),
    ("blue", (80, 110, 135)),
    ("blue", (65, 90, 110)),
    ("navy", (35, 50, 65)),
]
_ANCHOR_NAMES = [name for name, _ in _PROTOTYPES]
_ANCHOR_LAB = srgb_to_lab(np.array([rgb for _, rgb in _PROTOTYPES]))


def _name_of(rgb) -> str:
    lab = srgb_to_lab(np.asarray(rgb, dtype=float).reshape(1, 3))
    return _ANCHOR_NAMES[int(np.argmin(np.linalg.norm(_ANCHOR_LAB - lab, axis=1)))]


def _hex_of(rgb) -> str:
    return "#{:02x}{:02x}{:02x}".format(*(int(round(v)) for v in rgb))


def extract_colors(rgba: Image.Image, k: int = COLOR_K) -> list[dict]:
    """
    RGBA cutout -> [{name, hex, share}, ...] sorted by share desc.
    Only foreground pixels (alpha > ALPHA_THRESH) are considered.
    """
    arr  = np.array(rgba.convert("RGBA").resize((160, 160), Image.BILINEAR))
    mask = arr[:, :, 3] > ALPHA_THRESH
    px   = arr[:, :, :3][mask]

    if len(px) < 50:
        return []

    uniq = np.unique(px, axis=0)
    k = int(max(1, min(k, len(uniq))))

    km = KMeans(n_clusters=k, n_init=5, random_state=0).fit(px.astype(np.float64))

    out = []
    for i, centre in enumerate(km.cluster_centers_):
        share = float((km.labels_ == i).mean())
        out.append({
            "name":  _name_of(centre),
            "hex":   _hex_of(centre),
            "share": round(share, 3),
        })

    # merge clusters that resolved to the same colour name
    merged: dict[str, dict] = {}
    for c in out:
        if c["name"] in merged:
            merged[c["name"]]["share"] = round(
                merged[c["name"]]["share"] + c["share"], 3)
        else:
            merged[c["name"]] = c

    return sorted(merged.values(), key=lambda c: -c["share"])


def colour_review_needed(colors: list[dict], evidence: dict) -> bool:
    """Ask for review on clear disagreement; never invent a replacement colour.

    The margin is a conservative routing heuristic, not an accuracy estimate.
    Multi-colour garments do not have a reliable single dominant-colour target.
    """
    if not colors or colors[0]["share"] < .55 or evidence["margin"] < .15:
        return False
    families={"light blue":"blue","navy":"blue","charcoal":"grey",
              "light grey":"grey","burgundy":"red"}
    def family(name):
        return families.get(name,name)
    return family(colors[0]["name"]) != family(evidence["name"])
