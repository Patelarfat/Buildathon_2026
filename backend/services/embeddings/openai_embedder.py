import os
import json
import logging
import urllib.request
import urllib.error
from typing import List, Optional
from .base import BaseEmbedder

logger = logging.getLogger(__name__)


class OpenAIEmbedder(BaseEmbedder):
    """
    OpenAI Embedding Provider (text-embedding-3-small, dimension=768 or 1536).
    """

    DIMENSION = 768

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")

    @property
    def dimension(self) -> int:
        return self.DIMENSION

    @property
    def provider_name(self) -> str:
        return "OpenAI (text-embedding-3-small, 768d)"

    def is_available(self) -> bool:
        return bool(self.api_key and len(self.api_key.strip()) > 5)

    def embed_text(self, text: str) -> List[float]:
        if not self.is_available():
            raise ValueError("OpenAI API key is not configured.")

        url = "https://api.openai.com/v1/embeddings"
        payload = {
            "model": "text-embedding-3-small",
            "input": text[:4000],
            "dimensions": self.DIMENSION
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            resp_data = json.loads(response.read().decode("utf-8"))
            data_arr = resp_data.get("data", [])
            if data_arr:
                return data_arr[0].get("embedding", [0.0] * self.DIMENSION)
            raise ValueError("Empty embedding response from OpenAI")

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        if not self.is_available():
            raise ValueError("OpenAI API key is not configured.")

        url = "https://api.openai.com/v1/embeddings"
        payload = {
            "model": "text-embedding-3-small",
            "input": [t[:4000] for t in texts],
            "dimensions": self.DIMENSION
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=15) as response:
            resp_data = json.loads(response.read().decode("utf-8"))
            data_arr = resp_data.get("data", [])
            return [d.get("embedding", [0.0] * self.DIMENSION) for d in data_arr]
