import json
import logging
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session

import models
import schemas
from services.embeddings import EmbeddingService

logger = logging.getLogger(__name__)


def _cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Computes cosine similarity between two normalized vectors."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    return sum(a * b for a, b in zip(v1, v2))


class SemanticRetriever:
    """
    Semantic Vector Retrieval Engine.
    Executes similarity searches against pgvector/rag_documents strictly isolated by project_id.
    """

    @classmethod
    def search(
        cls,
        db: Session,
        project_id: int,
        query: str,
        top_k: int = 5,
        site_id: Optional[int] = None,
        area_id: Optional[int] = None,
        source_types: Optional[List[str]] = None,
        min_similarity: float = 0.05
    ) -> List[Dict[str, Any]]:
        """
        Retrieves top-K semantic matches strictly isolated to project_id.
        """
        if not query or not query.strip():
            return []

        # 1. Compute query vector
        query_vec = EmbeddingService.get_embedding(query.strip())

        # 2. Query scoped documents from PostgreSQL
        doc_q = db.query(models.RAGDocument).filter(models.RAGDocument.project_id == project_id)

        if site_id:
            doc_q = doc_q.filter(models.RAGDocument.site_id == site_id)
        if area_id:
            doc_q = doc_q.filter(models.RAGDocument.area_id == area_id)
        if source_types:
            doc_q = doc_q.filter(models.RAGDocument.source_type.in_(source_types))

        candidate_docs = doc_q.all()
        if not candidate_docs:
            return []

        # 3. Score candidates with cosine similarity
        scored_results = []
        for doc in candidate_docs:
            if not doc.embedding:
                continue
            try:
                doc_vec = json.loads(doc.embedding) if isinstance(doc.embedding, str) else doc.embedding
                sim = _cosine_similarity(query_vec, doc_vec)
                if sim >= min_similarity:
                    meta = json.loads(doc.metadata_json) if doc.metadata_json else {}
                    scored_results.append({
                        "doc_id": doc.id,
                        "project_id": doc.project_id,
                        "site_id": doc.site_id,
                        "area_id": doc.area_id,
                        "source_type": doc.source_type,
                        "source_id": doc.source_id,
                        "title": doc.title,
                        "content": doc.content,
                        "metadata": meta,
                        "similarity": round(float(sim), 4)
                    })
            except Exception as e:
                logger.warning(f"Error scoring RAG document #{doc.id}: {e}")

        # 4. Sort descending by similarity
        scored_results.sort(key=lambda x: x["similarity"], reverse=True)
        return scored_results[:top_k]

    @classmethod
    def format_semantic_evidence(
        cls,
        matches: List[Dict[str, Any]]
    ) -> Tuple[str, List[schemas.AssistantSource]]:
        """
        Converts top-K semantic matches into clean, non-leaking contextual evidence
        and structured AssistantSource records.
        """
        if not matches:
            return "", []

        evidence_lines = []
        sources: List[schemas.AssistantSource] = []
        seen_source_keys = set()

        for idx, m in enumerate(matches):
            st = m["source_type"]
            sid = m["source_id"]
            title = m["title"] or f"{st} #{sid}"
            content = m["content"]
            sim = m["similarity"]

            evidence_lines.append(f"{idx+1}. [{st}] {content} (Relevance: {round(sim*100)}%)")

            source_key = f"{st}_{sid}"
            if source_key not in seen_source_keys:
                seen_source_keys.add(source_key)
                sources.append(schemas.AssistantSource(
                    type=st,
                    id=source_key,
                    title=title,
                    detail=f"Semantic evidence match (Confidence: {round(sim*100)}%)"
                ))

        evidence_block = (
            "[RELEVANT SEMANTIC EVIDENCE FROM PROJECT RECORDS]\n" +
            "\n".join(evidence_lines)
        )
        return evidence_block, sources
