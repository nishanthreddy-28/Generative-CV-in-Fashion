"""
FashionSigLIP zero-shot tagger.

One image -> one embedding -> category, attributes, and the clothing gate
score, all from that single forward pass.

Load ONCE at app startup (see main.py lifespan), never per request.
"""

from __future__ import annotations

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

from app.core.config import MODEL_NAME
from app.core.config import DEVICE
from app.wardrobe.taxonomy import LABELS
from app.wardrobe.taxonomy import CAT_SLOT
from app.wardrobe.taxonomy import CAT_BANKS
from app.wardrobe.taxonomy import COLOR_ANCHORS
from app.wardrobe.taxonomy import ATTRIBUTES
from app.wardrobe.taxonomy import CLOTHING_PROMPTS
from app.wardrobe.taxonomy import NOT_CLOTHING_PROMPTS


class Tagger:
    def __init__(self, model_name: str = MODEL_NAME, device: str | None = DEVICE):
        import open_clip

        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model, _, self.preprocess = open_clip.create_model_and_transforms(
            model_name)
        self.model = self.model.to(self.device).eval()
        self.tokenizer = open_clip.get_tokenizer(model_name)

        # prototypes, built once
        self._cat_proto = self._build_prototypes(CAT_BANKS)
        self._attr_proto = {
            group: (list(opts.keys()), self._build_prototypes(list(opts.values())))
            for group, opts in ATTRIBUTES.items()
        }
        self._gate_proto = self._build_prototypes(
            [[p] for p in CLOTHING_PROMPTS + NOT_CLOTHING_PROMPTS])
        self._n_clothing = len(CLOTHING_PROMPTS)
        self._color_names = list(COLOR_ANCHORS)
        self._color_proto = self._build_prototypes([
            [f"a {name} garment", f"a piece of clothing whose main colour is {name}"]
            for name in self._color_names
        ])

    # -- internals ----------------------------------------------------------

    @torch.no_grad()
    def _build_prototypes(self, banks: list[list[str]]) -> torch.Tensor:
        """List of prompt-lists -> (n, dim) averaged, L2-normalised."""
        protos = []
        for bank in banks:
            tok = self.tokenizer(bank).to(self.device)
            emb = F.normalize(self.model.encode_text(tok).float(), dim=-1)
            protos.append(F.normalize(emb.mean(dim=0), dim=-1))
        return torch.stack(protos)

    @staticmethod
    def _softmax(sims: torch.Tensor, temp: float = 100.0) -> torch.Tensor:
        return (sims * temp).softmax(dim=-1)

    # -- public -------------------------------------------------------------

    @torch.no_grad()
    def embed(self, image: Image.Image) -> torch.Tensor:
        """RGB PIL image -> (dim,) L2-normalised float32 tensor."""
        x = self.preprocess(image.convert("RGB")).unsqueeze(0).to(self.device)
        return F.normalize(self.model.encode_image(x).float(), dim=-1).squeeze(0)

    @torch.no_grad()
    def clothing_score(self, emb: torch.Tensor) -> float:
        """Probability mass landing on clothing prompts. Used by gate G2."""
        probs = self._softmax(emb @ self._gate_proto.T)
        return float(probs[:self._n_clothing].sum())

    @torch.no_grad()
    def colour_evidence(self, emb: torch.Tensor) -> dict:
        """Relative prompt evidence, not a calibrated colour probability.

        Reuses the existing image embedding: no extra image inference or API call.
        """
        scores = self._softmax(emb @ self._color_proto.T)
        top = torch.topk(scores, k=2)
        return {"name": self._color_names[int(top.indices[0])],
                "margin": float(top.values[0] - top.values[1])}

    @torch.no_grad()
    def classify(self, emb: torch.Tensor) -> dict:
        """Category top-3 + all attribute groups, from a cached embedding."""
        probs = self._softmax(emb @ self._cat_proto.T)
        top = torch.topk(probs, k=min(3, len(LABELS)))
        idx  = top.indices.tolist()
        vals = [float(v) for v in top.values]

        attrs = {}
        for group, (names, proto) in self._attr_proto.items():
            p = self._softmax(emb @ proto.T)
            j = int(p.argmax())
            attrs[group] = {"value": names[j], "confidence": round(float(p[j]), 4)}

        return {
            "category":     LABELS[idx[0]],
            "slot":         CAT_SLOT[LABELS[idx[0]]],
            "confidence":   round(vals[0], 4),
            "margin":       round(vals[0] - vals[1], 4),
            "alternatives": [
                {"category": LABELS[i], "slot": CAT_SLOT[LABELS[i]],
                 "confidence": round(v, 4)}
                for i, v in zip(idx[1:], vals[1:])
            ],
            "attributes":   attrs,
        }

    @staticmethod
    def to_bytes(emb: torch.Tensor) -> bytes:
        return emb.detach().cpu().numpy().astype(np.float32).tobytes()

    @staticmethod
    def from_bytes(blob: bytes) -> np.ndarray:
        return np.frombuffer(blob, dtype=np.float32)
