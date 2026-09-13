import os
import json
import logging
import urllib.request
import urllib.error
from typing import List, Optional
from .base import BaseEmbedder

logger = logging.getLogger(__name__)


class GeminiEmbedder(BaseEmbedder):
    """
    Google Gemini Embedding Provider (text-embedding-004, 768-dimensional).
    """

    DIMENSION = 768

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    @property
    def dimension(self) -> int:
        return self.DIMENSION

    @property
    def provider_name(self) -> str:
        return "Google Gemini (text-embedding-004, 768d)"

    def is_available(self) -> bool:
        return bool(self.api_key and len(self.api_key.strip()) > 5)

    def embed_text(self, text: str) -> List[float]:
        if not self.is_available():
            raise ValueError("Gemini API key is not configured.")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={self.api_key}"
        payload = {
            "model": "models/gemini-embedding-001",
            "content": {
                "parts": [{"text": text[:2048]}]
            },
            "outputDimensionality": self.DIMENSION
        }
        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data_bytes,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            resp_data = json.loads(response.read().decode("utf-8"))
            values = resp_data.get("embedding", {}).get("values", [])
            if len(values) == self.DIMENSION:
                return values
            raise ValueError(f"Unexpected embedding dimension from Gemini: {len(values)}")

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        if not self.is_available():
            raise ValueError("Gemini API key is not configured.")

        # Batch in chunks of 20
        results: List[List[float]] = []
        chunk_size = 20
        for i in range(0, len(texts), chunk_size):
            chunk = texts[i:i + chunk_size]
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key={self.api_key}"
            requests_list = [
                {
                    "model": "models/gemini-embedding-001",
                    "content": {"parts": [{"text": t[:2048]}]},
                    "outputDimensionality": self.DIMENSION
                }
                for t in chunk
            ]
            payload = {"requests": requests_list}
            data_bytes = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data_bytes,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=15) as response:
                resp_data = json.loads(response.read().decode("utf-8"))
                embeddings_list = resp_data.get("embeddings", [])
                for item in embeddings_list:
                    results.append(item.get("values", [0.0] * self.DIMENSION))

        return results
