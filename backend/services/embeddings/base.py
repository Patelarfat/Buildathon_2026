from abc import ABC, abstractmethod
from typing import List


class BaseEmbedder(ABC):
    """Abstract Base Class for Embedding Providers."""

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Returns the embedding vector dimension."""
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Returns human-readable name of the embedding provider."""
        pass

    @abstractmethod
    def embed_text(self, text: str) -> List[float]:
        """Generates an embedding vector for a single string."""
        pass

    @abstractmethod
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generates embedding vectors for a list of strings."""
        pass
