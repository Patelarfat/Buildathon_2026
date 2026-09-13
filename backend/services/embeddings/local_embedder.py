import math
import hashlib
from typing import List
from .base import BaseEmbedder


class LocalSemanticEmbedder(BaseEmbedder):
    """
    High-performance deterministic semantic embedder (768-dimensional).
    Provides consistent, offline semantic vector embeddings with domain-specific
    weighting for construction concepts, safety hazards, PPE, and materials.
    """

    DIMENSION = 768

    DOMAIN_WEIGHTS = {
        # Hazards & Safety Incidents
        "fall": 4.5, "ladder": 4.0, "scaffolding": 4.0, "hazard": 3.8, "incident": 3.8,
        "injury": 4.2, "accident": 3.8, "slip": 3.5, "trip": 3.5, "unresolved": 3.5,
        "critical": 3.8, "high": 3.0, "severity": 3.0,
        # Environmental & Equipment
        "hydraulic": 4.2, "leak": 4.0, "spill": 4.0, "oil": 3.8, "fluid": 3.8, "drainage": 3.5,
        "pump": 3.5, "excavator": 4.0, "excavation": 4.0, "crane": 3.8, "electrical": 3.5,
        "ventilation": 3.8, "collapse": 4.5, "equipment": 3.5,
        # PPE & Vision
        "helmet": 3.8, "ppe": 4.0, "violation": 4.0, "vest": 3.5, "gloves": 3.5,
        "boots": 3.5, "goggles": 3.5, "without": 3.5, "detected": 3.0, "compliance": 3.5,
        # Inspections & Quality
        "inspection": 3.5, "failed": 4.0, "passed": 3.0, "checklist": 3.0, "rebar": 3.5,
        "concrete": 3.5, "curing": 3.0, "defect": 3.5, "snag": 3.0, "structural": 3.0,
        # Materials & Operations
        "material": 3.0, "steel": 3.5, "cement": 3.5, "shortage": 4.0, "delayed": 3.8,
        "stock": 3.0, "supplier": 2.8, "blocker": 4.0, "weather": 2.5, "progress": 2.8,
        # Spatial / Zones
        "building": 2.8, "block": 2.8, "podium": 2.8, "basement": 2.8, "floor": 2.8,
        "zone": 2.8, "site": 2.5, "trench": 3.5, "shaft": 3.5
    }

    @property
    def dimension(self) -> int:
        return self.DIMENSION

    @property
    def provider_name(self) -> str:
        return "LocalSemanticEmbedder (768d)"

    def embed_text(self, text: str) -> List[float]:
        if not text or not text.strip():
            return [0.0] * self.DIMENSION

        clean_text = text.lower().replace(".", " ").replace(",", " ").replace(":", " ").replace("-", " ").replace("#", " ")
        tokens = clean_text.split()
        if not tokens:
            return [0.0] * self.DIMENSION

        vec = [0.0] * self.DIMENSION

        for token in tokens:
            w = self.DOMAIN_WEIGHTS.get(token, 1.0)
            h = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16)
            idx1 = h % self.DIMENSION
            idx2 = (h >> 16) % self.DIMENSION
            idx3 = (h >> 32) % self.DIMENSION
            vec[idx1] += w * 1.0
            vec[idx2] += w * 0.5
            vec[idx3] += w * 0.25

        # Bi-gram semantic contextual boosting
        for i in range(len(tokens) - 1):
            bigram = tokens[i] + "_" + tokens[i+1]
            h_bi = int(hashlib.sha256(bigram.encode("utf-8")).hexdigest(), 16)
            vec[h_bi % self.DIMENSION] += 1.8

        # L2 Normalization for unit hypersphere cosine similarity
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]
        return vec

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        return [self.embed_text(t) for t in texts]
