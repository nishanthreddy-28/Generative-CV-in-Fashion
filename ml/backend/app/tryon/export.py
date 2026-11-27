"""Private, local export for manual Gemini / WeShopAI comparisons."""
import io
import json
import zipfile

from PIL import Image, ImageOps


def export_bundle(directory):
    plan = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    categories = [garment["category"] for garment in plan["garments"]]
    prompt = ("Edit image 1 (the person). Replace only the clothing corresponding to the subsequent garment reference images, "
              "in this order: " + ", ".join(categories) + ". "
              "Keep the person's face, identity, expression, hair, skin, existing tattoos, body proportions, pose, "
              "hands, framing, lighting and background unchanged. Keep all unselected clothing and shoes unchanged. "
              "Use the reference garment's actual colour, cut, sleeve length, neckline, pattern and lettering. "
              "Fit it naturally to the existing pose with realistic folds and occlusion. "
              "The references show garments, not a new person or pose to copy. Return one edited photo at the original framing.\n")
    note = """Prepared inputs for inspection. Extract this ZIP to view the person photo and garment references.
prompt.txt describes the intended edit; downloading this package does not generate an image or send photos to another service.
This package contains your person photo; keep it private.
"""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.write(directory / "person.png", "person.png")
        for index, garment in enumerate(plan["garments"], 1):
            prepared = directory / f"prepared-{index}.png"
            if prepared.is_file():
                archive.write(prepared, f"garment-{index}.png")
            else:
                with Image.open(garment["path"]) as source:
                    rgba = ImageOps.exif_transpose(source).convert("RGBA").rotate(-garment.get("rotation", 0), expand=True)
                    rgb = Image.new("RGB", rgba.size, "white")
                    rgb.paste(rgba, mask=rgba.getchannel("A"))
                    output = io.BytesIO()
                    rgb.save(output, format="PNG")
                    archive.writestr(f"garment-{index}.png", output.getvalue())
        archive.writestr("prompt.txt", prompt)
        archive.writestr("README.txt", note)
    return buffer.getvalue()
