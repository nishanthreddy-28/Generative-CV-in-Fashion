"""Local, pretrained CIR adapter. Never substitutes Phase 2 embeddings.

Architecture matches fkuyumcu/OutfitTransformer-labse (MIT model card).
Our whole-outfit ranking is a leave-one-out adaptation, NOT a trained CP head.
"""
import hashlib
import io
import json
import os
import threading
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

from app.core.config import IMAGES_DIR
from app.core.config import STORAGE_DIR

ARTIFACTS = Path(os.getenv("PHASE3_MODEL_DIR", str(STORAGE_DIR / "phase3_model")))
CACHE = STORAGE_DIR / "phase3_features"


class ModelUnavailable(RuntimeError):
    pass


def architecture():
    import torch
    from torch import nn
    from torch.nn import functional as F

    class CIR(nn.Module):
        def __init__(self):
            super().__init__()
            self.visual_proj = nn.Linear(512, 64)
            self.text_proj = nn.Linear(768, 64)
            layer = nn.TransformerEncoderLayer(128, 16, 512, 0.1, batch_first=True)
            self.transformer = nn.TransformerEncoder(layer, 6)
            self.query_token = nn.Parameter(torch.zeros(1, 1, 128))
            self.output_proj = nn.Sequential(nn.Linear(128, 128), nn.LayerNorm(128))

        def encode_items(self, images, texts):
            return torch.cat([self.visual_proj(images), self.text_proj(texts)], dim=-1)

        def forward(self, images, texts):
            x = self.encode_items(images, texts)
            x = torch.cat([self.query_token.expand(x.shape[0], -1, -1), x], dim=1)
            return F.normalize(self.output_proj(self.transformer(x)[:, 0]), dim=-1)

    return CIR()


def image_path(item):
    root = Path(IMAGES_DIR).resolve()
    path = (root / item["image_path"]).resolve()
    if not path.is_relative_to(root):
        raise ModelUnavailable("Stored image path is outside wardrobe storage")
    return path


class PretrainedScorer:
    def __init__(self):
        self.lock = threading.RLock()
        self.ready = False
        self.version = None

    def load(self):
        if self.ready:
            return
        try:
            import torch
            from torchvision.models import ResNet18_Weights, resnet18
            from sentence_transformers import SentenceTransformer

            torch.set_num_threads(max(1, min(8, int(os.getenv("PHASE3_CPU_THREADS", "4")))))

            manifest = json.loads((ARTIFACTS / "manifest.json").read_text())
            weights = ARTIFACTS / "pytorch_model.bin"
            if hashlib.sha256(weights.read_bytes()).hexdigest() != manifest["sha256"]:
                raise ValueError("Checkpoint integrity check failed")
            self.net = architecture()
            self.net.load_state_dict(torch.load(weights, map_location="cpu", weights_only=True), strict=True)
            self.net.eval()
            self.visual = resnet18(weights=None)
            if hashlib.sha256((ARTIFACTS / "resnet18.pth").read_bytes()).hexdigest() != manifest["resnet_sha256"]:
                raise ValueError("ResNet integrity check failed")
            self.visual.load_state_dict(torch.load(ARTIFACTS / "resnet18.pth", map_location="cpu", weights_only=True))
            self.visual.fc = torch.nn.Identity()
            self.visual.eval()
            self.transform = ResNet18_Weights.IMAGENET1K_V1.transforms()
            self.text = SentenceTransformer(str(ARTIFACTS / "labse"), device="cpu", local_files_only=True)
            self.version = "labse-cir:" + manifest["revision"] + ":loo-v1"
            self.fingerprint = hashlib.sha256(json.dumps(manifest, sort_keys=True).encode()).hexdigest()
            CACHE.mkdir(parents=True, exist_ok=True)
            self.ready = True
        except Exception as exc:
            raise ModelUnavailable("Pretrained assets unavailable or incompatible; run scripts/setup_models.py") from exc

    def features(self, item):
        import torch

        data = image_path(item).read_bytes()
        # A factual description built only from stored metadata, no inferred fabric.
        colors = ", ".join(c["name"] for c in json.loads(item["colors"]))
        description = f"{colors} {item['category']}. {item['pattern']} pattern. {item['fit']} fit."
        key = hashlib.sha256(data + description.encode() + self.fingerprint.encode()).hexdigest()
        path = CACHE / (key + ".npz")
        if path.exists():
            try:
                with np.load(path, allow_pickle=False) as cached:
                    v, t = cached["visual"], cached["text"]
                if v.shape == (512,) and t.shape == (768,) and np.isfinite(v).all() and np.isfinite(t).all():
                    return torch.from_numpy(v.copy()), torch.from_numpy(t.copy())
            except (ValueError, OSError, KeyError):
                pass
        with Image.open(io.BytesIO(data)) as image:
            rgb = Image.new("RGB", image.size, "white")
            rgba = image.convert("RGBA")
            rgb.paste(rgba, mask=rgba.getchannel("A"))
            x = self.transform(rgb).unsqueeze(0)
        v = self.visual(x)[0].detach().cpu()
        t = self.text.encode(description, convert_to_tensor=True, normalize_embeddings=True).cpu()
        with tempfile.NamedTemporaryFile(dir=CACHE, suffix=".tmp", delete=False) as out:
            temp = Path(out.name)
            np.savez(out, visual=v.numpy(), text=t.numpy())
        try:
            temp.replace(path)
        finally:
            temp.unlink(missing_ok=True)
        return v, t

    def score(self, candidates):
        try:
            return self._score(candidates)
        except ModelUnavailable:
            raise
        except Exception as exc:
            raise ModelUnavailable("Recommendation inference failed; check local model assets and garment images.") from exc

    def retrieve_scores(self, contexts, options):
        """Complementary-item cosine in the checkpoint's ResNet/LaBSE space.

        Slot filtering and hard locks are the search caller's responsibility.
        This shortlists candidates; it does not replace whole-outfit scoring.
        """
        import torch
        from torch.nn import functional as F

        if not contexts or not options:
            return [[] for _ in contexts]
        try:
            with self.lock, torch.inference_mode():
                self.load()
                items = {item["id"]: item for context in contexts for item in context}
                items.update({item["id"]: item for item in options})
                features = {key: self.features(item) for key, item in items.items()}
                targets = F.normalize(self.net.encode_items(
                    torch.stack([features[item["id"]][0] for item in options]),
                    torch.stack([features[item["id"]][1] for item in options])), dim=-1)
                result = [None] * len(contexts)
                for length in sorted({len(context) for context in contexts}):
                    indices = [index for index, context in enumerate(contexts) if len(context) == length]
                    for start in range(0, len(indices), 64):
                        batch = indices[start:start + 64]
                        visual = torch.stack([torch.stack([features[item["id"]][0] for item in contexts[index]]) for index in batch])
                        text = torch.stack([torch.stack([features[item["id"]][1] for item in contexts[index]]) for index in batch])
                        values = (self.net(visual, text) @ targets.T).tolist()
                        for index, scores in zip(batch, values):
                            if not all(np.isfinite(value) for value in scores):
                                raise ModelUnavailable("Non-finite complementary retrieval output")
                            result[index] = scores
                return result
        except ModelUnavailable:
            raise
        except Exception as exc:
            raise ModelUnavailable("Complementary retrieval failed; check local model assets and garment images.") from exc

    def _score(self, candidates):
        import torch
        from torch.nn import functional as F

        with self.lock, torch.inference_mode():
            self.load()
            items = {i["id"]: i for outfit in candidates for i in outfit}
            features = {key: self.features(item) for key, item in items.items()}
            scores = np.zeros(len(candidates), dtype=np.float64)
            # Group by cardinality so no padding or outfit-length-dependent sums.
            for length in sorted({len(c) for c in candidates}):
                indices = [j for j, c in enumerate(candidates) if len(c) == length]
                for start in range(0, len(indices), 64):
                    batch_ids = indices[start:start + 64]
                    v = torch.stack([torch.stack([features[i["id"]][0] for i in candidates[j]]) for j in batch_ids])
                    t = torch.stack([torch.stack([features[i["id"]][1] for i in candidates[j]]) for j in batch_ids])
                    aggregate = torch.zeros(len(batch_ids))
                    for missing in range(length):
                        keep = [k for k in range(length) if k != missing]
                        query = self.net(v[:, keep], t[:, keep])
                        target = F.normalize(self.net.encode_items(v[:, missing], t[:, missing]), dim=-1)
                        aggregate += (query * target).sum(-1)
                    values = (aggregate / length).tolist()
                    for j, value in zip(batch_ids, values):
                        if not np.isfinite(value):
                            raise ModelUnavailable("Non-finite model output")
                        scores[j] = value
            return scores.tolist()
