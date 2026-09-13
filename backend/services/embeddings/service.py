import os
import logging
from typing import List, Dict, Any, Optional

from .base import BaseEmbedder
from .local_embedder import LocalSemanticEmbedder
from .gemini_embedder import GeminiEmbedder
from .openai_embedder import OpenAIEmbedder

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Unified Embedding Service for Phase 8 Hybrid RAG.
    Selects the most suitable embedding provider based on environment configuration:
    1. Google Gemini (text-embedding-004) if GEMINI_API_KEY / GOOGLE_API_KEY configured
    2. OpenAI (text-embedding-3-small) if OPENAI_API_KEY configured
    3. High-performance deterministic LocalSemanticEmbedder (Zero-dependency fallback)
    """

    _local_embedder = LocalSemanticEmbedder()

    @classmethod
    def get_embedder(cls) -> BaseEmbedder:
        gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if gemini_key:
            return GeminiEmbedder(api_key=gemini_key)

        openai_key = os.getenv("OPENAI_API_KEY")
        if openai_key:
            return OpenAIEmbedder(api_key=openai_key)

        return cls._local_embedder

    @classmethod
    def get_embedding(cls, text: str) -> List[float]:
        """Generates embedding vector with resilient fallback to local embedder."""
        embedder = cls.get_embedder()
        try:
            return embedder.embed_text(text)
        except Exception as e:
            logger.warning(f"Primary embedder ({embedder.provider_name}) failed: {e}. Using local semantic embedder.")
            return cls._local_embedder.embed_text(text)

    @classmethod
    def get_embeddings(cls, texts: List[str]) -> List[List[float]]:
        """Batch embedding generation with resilient fallback."""
        if not texts:
            return []
        embedder = cls.get_embedder()
        try:
            return embedder.embed_batch(texts)
        except Exception as e:
            logger.warning(f"Primary batch embedder ({embedder.provider_name}) failed: {e}. Using local semantic embedder.")
            return cls._local_embedder.embed_batch(texts)

    @classmethod
    def get_active_provider_info(cls) -> Dict[str, Any]:
        embedder = cls.get_embedder()
        return {
            "provider": embedder.provider_name,
            "dimension": embedder.dimension,
            "is_external": not isinstance(embedder, LocalSemanticEmbedder),
            "fallback_available": True
        }
