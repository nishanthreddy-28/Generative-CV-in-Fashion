r"""Download official dependencies and a pinned pretrained artifact, never remote Python code.
Run from backend: ..\.venv\Scripts\python.exe scripts/setup_models.py
"""
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from huggingface_hub import HfApi, hf_hub_download, snapshot_download
from app.recommendations.scorer import ARTIFACTS
from app.recommendations.scorer import architecture


def main():
    import torch
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    api = HfApi()
    repo = "fkuyumcu/OutfitTransformer-labse"
    revision = api.model_info(repo).sha
    for name in ("config.json", "README.md", "pytorch_model.bin"):
        hf_hub_download(repo, name, revision=revision, local_dir=ARTIFACTS)
    weights = ARTIFACTS / "pytorch_model.bin"
    model = architecture()
    model.load_state_dict(torch.load(weights, map_location="cpu", weights_only=True), strict=True)
    text_repo = "sentence-transformers/LaBSE"
    text_revision = api.model_info(text_repo).sha
    files = api.list_repo_files(text_repo, revision=text_revision)
    selected = [f for f in files if f.endswith((".json", ".txt", ".model", ".safetensors")) and not f.startswith(("onnx/", "openvino/"))]
    for f in files:
        if f.endswith("pytorch_model.bin") and str(Path(f).with_name("model.safetensors")).replace("\\", "/") not in files:
            selected.append(f)
    snapshot_download(text_repo, revision=text_revision, local_dir=ARTIFACTS / "labse", allow_patterns=selected)
    resnet = ARTIFACTS / "resnet18.pth"
    if not resnet.exists():
        temporary = resnet.with_suffix(".tmp")
        urllib.request.urlretrieve("https://download.pytorch.org/models/resnet18-f37072fd.pth", temporary)
        temporary.replace(resnet)
    resnet_hash = hashlib.sha256(resnet.read_bytes()).hexdigest()
    if not resnet_hash.startswith("f37072fd"):
        raise RuntimeError("ResNet checksum mismatch")
    manifest = {"repo": repo, "revision": revision, "sha256": hashlib.sha256(weights.read_bytes()).hexdigest(),
                "text_repo": text_repo, "text_revision": text_revision, "resnet_sha256": resnet_hash,
                "image_preprocessing": "torchvision ResNet18 IMAGENET1K_V1 transforms",
                "ranking": "mean leave-one-out cosine; adaptation, not published CP benchmark"}
    (ARTIFACTS / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
