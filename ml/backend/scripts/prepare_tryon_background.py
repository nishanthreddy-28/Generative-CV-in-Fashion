"""CPU background stage for hosted try-on garment references."""
import json
import sys
import time
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
from PIL import Image, ImageOps
from app.wardrobe.background import remove_background
from app.wardrobe.gates import g3_cutout_ok


def prepare(manifest):
    path = Path(manifest)
    plan = json.loads(path.read_text(encoding="utf-8"))
    for index, garment in enumerate(plan["garments"], 1):
        started = time.monotonic()
        with Image.open(garment["path"]) as source:
            rgba = ImageOps.exif_transpose(source).convert("RGBA")
            reuse = garment.get("wardrobe_cutout", False) and g3_cutout_ok(rgba)[0]
            rgba = rgba.rotate(-garment.get("rotation", 0), expand=True)
            rgb = Image.new("RGB", rgba.size, "white")
            rgb.paste(rgba, mask=rgba.getchannel("A"))
            rgb.save(path.parent / f"reference-source-{index}.png")
            # Owned wardrobe images were already cut out during categorization.
            # Reuse their validated alpha, while still parsing garment vs skin.
            cutout = rgba if reuse else remove_background(rgba)
            print(f"Background reference {index}: {'reused wardrobe cutout' if reuse else 'inference or mask cache'}; {time.monotonic() - started:.3f}s", flush=True)
            foreground = path.parent / f"foreground-{index}.png"
            cutout.save(foreground)
            garment["foreground_path"] = str(foreground)
            garment["source_path"] = str(path.parent / f"reference-source-{index}.png")
    (path.parent / "prepared-manifest.json").write_text(json.dumps(plan), encoding="utf-8")


if __name__ == "__main__":
    prepare(sys.argv[1])
