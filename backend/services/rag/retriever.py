import re
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


def _lexical_similarity(query: str, text: str) -> float:
    """Computes keyword/token overlap similarity between query and document text."""
    if not query or not text:
        return 0.0
    q_tokens = set(re.findall(r'\w+', query.lower()))
    # Remove common stopwords to focus on construction terminology
    stopwords = {"what", "is", "the", "are", "in", "of", "to", "and", "a", "an", "for", "on", "with", "this", "that", "which", "give", "me", "show", "tell"}
    meaningful_q_tokens = {t for t in q_tokens if t not in stopwords and len(t) > 1}
    if not meaningful_q_tokens:
        meaningful_q_tokens = q_tokens
    if not meaningful_q_tokens:
        return 0.0
    text_tokens = set(re.findall(r'\w+', text.lower()))
    intersection = meaningful_q_tokens.intersection(text_tokens)
    return len(intersection) / len(meaningful_q_tokens)


class SemanticRetriever:
    """
    Hybrid Semantic & Lexical RAG Retrieval Engine.
    Executes combined similarity searches against pgvector/rag_documents strictly isolated by project_id.
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
        Retrieves top-K hybrid semantic + lexical matches strictly isolated to project_id.
        """
        if not query or not query.strip():
            return []

        # 1. Compute query vector
        query_str = query.strip()
        query_vec = None
        try:
            query_vec = EmbeddingService.get_embedding(query_str)
        except Exception as e:
            logger.warning(f"Embedding generation failed: {e}")

        # 2. Query scoped documents from PostgreSQL strictly filtered by project_id
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

        # 3. Score candidates with hybrid cosine similarity + lexical token matching
        scored_results = []
        for doc in candidate_docs:
            doc_text = f"{doc.title or ''} {doc.content}"
            lexical_sim = _lexical_similarity(query_str, doc_text)

            sem_sim = 0.0
            if doc.embedding and query_vec:
                try:
                    doc_vec = json.loads(doc.embedding) if isinstance(doc.embedding, str) else doc.embedding
                    sem_sim = _cosine_similarity(query_vec, doc_vec)
                except Exception as e:
                    logger.warning(f"Error scoring RAG document #{doc.id}: {e}")

            # Hybrid score: balanced semantic meaning and exact keyword precision
            if sem_sim > 0.0:
                hybrid_sim = (sem_sim * 0.65) + (lexical_sim * 0.35)
            else:
                hybrid_sim = lexical_sim

            if hybrid_sim >= min_similarity:
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
                    "similarity": round(float(hybrid_sim), 4),
                    "semantic_similarity": round(float(sem_sim), 4),
                    "lexical_similarity": round(float(lexical_sim), 4),
                })

        # 4. Sort descending by hybrid similarity score
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
