"""CPU human parsing and garment isolation; no try-on generator is loaded."""
import json
import os
import sys
import time
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
os.environ.setdefault("HF_HOME", str(root / "storage" / "preparation-cache"))
import numpy as np
from PIL import Image
from app.tryon.preparation import prepare_garment
from app.core import mask_cache

PARSER_VERSION = "fashn-human-parser-default-labels-v1"


def prepare(path, parser=None):
    path = Path(path)
    plan = json.loads(path.read_text(encoding="utf-8"))
    # Hosted generation must not require CUDA on the API/preparation server.
    references = []
    for index, garment in enumerate(plan["garments"], 1):
        started = time.monotonic()
        with Image.open(garment["source_path"]) as source, Image.open(garment["foreground_path"]) as foreground:
            rgb = source.convert("RGB")
            identifier = mask_cache.key(rgb, PARSER_VERSION)
            labels = mask_cache.get(identifier, rgb.size)
            cached = labels is not None
            if labels is None:
                if parser is None:
                    import torch
                    from fashn_human_parser import FashnHumanParser
                    torch.set_num_threads(2)
                    parser = FashnHumanParser(device="cpu")
                labels = Image.fromarray(parser.predict(np.asarray(rgb)).astype(np.uint8))
                mask_cache.put(identifier, labels)
            prepared, info = prepare_garment(rgb, foreground.convert("RGBA"), np.asarray(labels), garment["category"])
            info.update(parser_cache_hit=cached, preparation_seconds=round(time.monotonic() - started, 3))
            print(f"Garment reference {index}: {'cached parser mask' if cached else 'parser inference'}; {info['preparation_seconds']:.3f}s", flush=True)
        prepared_path = path.parent / f"prepared-{index}.png"
        prepared.save(prepared_path)
        info.update(index=index, category=garment["category"], requested_photo_type=garment.get("photo_type", "auto"))
        references.append(info)
        garment["prepared_path"] = str(prepared_path)
    temporary = path.parent / "preparation.tmp"
    temporary.write_text(json.dumps({"background_model": "birefnet-general-lite", "references": references}), encoding="utf-8")
    temporary.replace(path.parent / "preparation.json")
    path.write_text(json.dumps(plan), encoding="utf-8")


if __name__ == "__main__":
    try:
        prepare(sys.argv[1])
    except ValueError as exc:
        print(f"PREPARATION_ERROR: {exc}", flush=True)
        raise
