"""
Production-Grade Multi-Signal Hybrid RAG Retrieval Engine (Phase 8.2B / 8.E.1).
Combines:
1. Dense Semantic Vector Cosine Similarity (pgvector 768d) across multiple query expansions
2. Lexical Token Overlap (NLP token processing across multi-query variants)
3. Multi-Word Exact Phrase Matching (n-grams)
4. Dynamic Database Entity Relevance
5. RAG4CM Construction Hierarchy Path Matching (spatial confinement)
6. Structured Metadata (Status / Severity / Category) Relevance
7. Temporal / Date Matching
8. Multi-Source Diversity & Deterministic Reranking
Strictly isolated by project_id before any scoring.
"""

import re
import json
import logging
from typing import List, Dict, Any, Optional, Tuple, Union
from sqlalchemy.orm import Session

import models
import schemas
from services.embeddings import EmbeddingService
from services.query_understanding import analyze_query, QueryUnderstanding
from services.query_expansion import QueryExpansionService, ExpandedQueryPlan

logger = logging.getLogger(__name__)


def _cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Computes cosine similarity between two normalized vector lists."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    return sum(a * b for a, b in zip(v1, v2))


def _compute_lexical_score(query_tokens: List[str], text_tokens: set) -> float:
    """
    Computes normalized [0.0, 1.0] token overlap ratio.
    """
    if not query_tokens or not text_tokens:
        return 0.0
    matched = [t for t in query_tokens if t in text_tokens]
    return round(len(matched) / len(query_tokens), 4)


def _compute_phrase_score(phrases: List[str], full_text: str, title: str) -> float:
    """
    Computes normalized [0.0, 1.0] score for exact multi-word phrase occurrences.
    """
    if not phrases:
        return 0.0
    matched_count = 0
    title_lower = title.lower()
    for p in phrases:
        if p in full_text:
            matched_count += 1
            if p in title_lower:
                matched_count += 0.5  # Extra boost for title phrase match
    score = min(1.0, matched_count / max(1, len(phrases)))
    return round(score, 4)


def _compute_entity_score(entities: List[str], title: str, full_text: str, metadata: Dict[str, Any]) -> float:
    """
    Computes entity relevance [0.0, 1.0] matching dynamic DB entities in title/meta/content.
    """
    if not entities:
        return 0.0
    title_lower = title.lower()
    score = 0.0
    for e in entities:
        e_lower = e.lower()
        if e_lower in title_lower:
            score += 0.4
        elif e_lower in full_text:
            score += 0.2
        if metadata.get("area_name") and e_lower in str(metadata["area_name"]).lower():
            score += 0.3
    return round(min(1.0, score), 4)


def _compute_hierarchy_score(query_plan: Union[ExpandedQueryPlan, QueryUnderstanding], hierarchy_path: str, doc_area_id: Optional[int], doc_site_id: Optional[int]) -> float:
    """
    Computes construction spatial hierarchy match score [0.0, 1.0].
    """
    score = 0.0
    h_lower = hierarchy_path.lower() if hierarchy_path else ""

    # Exact area match (High priority)
    if query_plan.matched_area_ids and doc_area_id:
        if doc_area_id in query_plan.matched_area_ids:
            score += 0.85

    # Area name mention match in hierarchy path
    for aname in query_plan.matched_area_names:
        if aname.lower() in h_lower:
            score += 0.6

    # Site match
    if query_plan.matched_site_id and doc_site_id:
        if doc_site_id == query_plan.matched_site_id:
            score += 0.3

    # Query tokens in hierarchy path
    for e in query_plan.entities:
        if len(e) > 3 and e.lower() in h_lower:
            score += 0.2

    return round(min(1.0, score), 4)


def _compute_metadata_score(query_plan: Union[ExpandedQueryPlan, QueryUnderstanding], doc_metadata: Dict[str, Any], doc_type: str) -> float:
    """
    Computes semantic metadata affinity boost [0.0, 1.0].
    """
    score = 0.0
    status = str(doc_metadata.get("status", "")).upper()
    severity = str(doc_metadata.get("severity", "")).upper()
    priority = str(doc_metadata.get("priority", "")).upper()

    is_problem = getattr(query_plan, "is_blocker_query", False) or getattr(query_plan, "is_problem_query", False)
    is_unresolved = getattr(query_plan, "is_unresolved_query", False)
    is_failed = getattr(query_plan, "is_failed_inspection_query", False) or getattr(query_plan, "is_failed_query", False)
    is_ppe = getattr(query_plan, "is_ppe_query", False)
    is_progress = getattr(query_plan, "is_progress_query", False)
    is_material = getattr(query_plan, "is_material_query", False)

    # 1. Problem / Blocker queries favor DELAYED, OUT_OF_STOCK, LOW_STOCK, FAILED, OPEN
    if is_problem or is_material:
        if status in ["DELAYED", "OUT_OF_STOCK", "LOW_STOCK", "FAILED", "OPEN", "INVESTIGATING"]:
            score += 0.55
        if priority in ["HIGH", "CRITICAL"] or severity in ["HIGH", "CRITICAL"]:
            score += 0.4
        if doc_type in ["MATERIAL", "DAILY_REPORT", "OBSERVATION", "INCIDENT", "INSPECTION"]:
            score += 0.25

    # 2. Unresolved incident queries
    if is_unresolved:
        if status in ["OPEN", "UNDER_REVIEW", "INVESTIGATING", "ACTIVE"]:
            score += 0.6
        if doc_type == "INCIDENT":
            score += 0.4

    # 3. Failed inspection queries
    if is_failed:
        if status in ["FAILED", "REQUIRES_REINSPECTION", "OPEN"]:
            score += 0.7
        if doc_type == "INSPECTION":
            score += 0.3

    # 4. PPE queries
    if is_ppe:
        if doc_type in ["AI_FINDING", "PHOTO"]:
            score += 0.8
        if doc_metadata.get("is_violation"):
            score += 0.3

    # 5. Progress queries
    if is_progress:
        if doc_type in ["DAILY_REPORT", "PROJECT", "SITE"]:
            score += 0.6

    # 6. Phase 8.2E: Source-Type Requirement Affinity
    reqs = getattr(query_plan, "requirements", None)
    if reqs and reqs.requested_source_types:
        if doc_type in reqs.requested_source_types:
            score += 0.5
        elif len(reqs.requested_source_types) == 1 and reqs.query_type == "EXACT_STRUCTURED":
            score -= 0.3

    return round(max(0.0, min(1.0, score)), 4)


def _compute_time_score(query_plan: Union[ExpandedQueryPlan, QueryUnderstanding], doc_metadata: Dict[str, Any]) -> float:
    """
    Computes temporal proximity score [0.0, 1.0].
    """
    doc_date = doc_metadata.get("date")
    if not doc_date:
        return 0.0

    doc_date_str = str(doc_date)[:10]

    # Exact target date match
    if query_plan.target_date and query_plan.target_date == doc_date_str:
        return 1.0

    # Within time filter range
    time_filter = getattr(query_plan, "time_filter", None)
    if time_filter:
        try:
            d_dt = datetime.strptime(doc_date_str, "%Y-%m-%d")
            start_dt, end_dt = time_filter
            if start_dt and end_dt:
                if start_dt <= d_dt <= end_dt:
                    return 0.8
            elif start_dt and not end_dt:
                if d_dt >= start_dt:
                    return 0.7
        except Exception:
            pass

    return 0.0


class SearchResult(dict):
    """
    Represents a scored RAG retrieval match with explainable component scores.
    Supports both attribute (.doc_id) and dict (['doc_id']) access for backwards compatibility.
    """
    def __init__(
        self,
        doc_id: int,
        project_id: int,
        doc_type: str,
        title: str,
        content: str,
        relevance_score: float,
        semantic_score: float,
        lexical_score: float,
        phrase_score: float,
        entity_score: float,
        hierarchy_score: float,
        metadata_score: float,
        time_score: float,
        metadata: Dict[str, Any],
        source_id: Optional[int] = None,
        site_id: Optional[int] = None,
        area_id: Optional[int] = None,
        hierarchy_path: Optional[str] = None
    ):
        data = {
            "doc_id": doc_id,
            "project_id": project_id,
            "doc_type": doc_type,
            "source_type": doc_type,
            "title": title,
            "content": content,
            "relevance_score": relevance_score,
            "similarity": relevance_score,
            "semantic_score": semantic_score,
            "semantic_similarity": semantic_score,
            "lexical_score": lexical_score,
            "lexical_similarity": lexical_score,
            "phrase_score": phrase_score,
            "entity_score": entity_score,
            "hierarchy_score": hierarchy_score,
            "metadata_score": metadata_score,
            "metadata_similarity": metadata_score,
            "time_score": time_score,
            "metadata": metadata,
            "source_id": source_id,
            "site_id": site_id,
            "area_id": area_id,
            "hierarchy_path": hierarchy_path or metadata.get("hierarchy_path", "")
        }
        super().__init__(data)

    def __getattr__(self, item):
        if item in self:
            return self[item]
        raise AttributeError(f"'SearchResult' object has no attribute '{item}'")

    def __setattr__(self, key, value):
        self[key] = value


class SemanticRetriever:
    """
    Production-Grade Hybrid Semantic & Lexical RAG Retrieval Engine (Phase 8.2B / Phase 8.E.1).
    Combines multi-query dense semantic vector similarity, token lexical overlap, multi-word phrase matching,
    entity extraction, hierarchy path matching, metadata affinity, and temporal scoring.
    Strictly isolated by project_id.
    """

    def __init__(self, db: Optional[Session] = None):
        self.db = db

    def search(
        self_or_first: Any = None,
        project_id: Optional[int] = None,
        query: Optional[str] = None,
        primary_topic: Optional[Any] = None,
        extracted_entities: Optional[List[str]] = None,
        top_k: int = 8,
        site_id: Optional[int] = None,
        area_id: Optional[int] = None,
        source_types: Optional[List[str]] = None,
        min_similarity: float = 0.04,
        query_plan: Optional[ExpandedQueryPlan] = None,
        db: Optional[Session] = None
    ) -> List[SearchResult]:
        active_db = db
        if not active_db and isinstance(self_or_first, Session):
            active_db = self_or_first
        elif not active_db and hasattr(self_or_first, 'db') and getattr(self_or_first, 'db') is not None:
            active_db = getattr(self_or_first, 'db')
            
        if not active_db:
            raise ValueError("A database session (db) must be provided to SemanticRetriever.")
            
        return SemanticRetriever._execute_search(
            db=active_db,
            project_id=project_id,
            query=query,
            primary_topic=primary_topic,
            extracted_entities=extracted_entities,
            top_k=top_k,
            site_id=site_id,
            area_id=area_id,
            source_types=source_types,
            min_similarity=min_similarity,
            query_plan=query_plan
        )

    @classmethod
    def search_static(
        cls,
        db: Session,
        project_id: int,
        query: str,
        primary_topic: Optional[Any] = None,
        extracted_entities: Optional[List[str]] = None,
        top_k: int = 8,
        site_id: Optional[int] = None,
        area_id: Optional[int] = None,
        source_types: Optional[List[str]] = None,
        min_similarity: float = 0.04,
        query_plan: Optional[ExpandedQueryPlan] = None
    ) -> List[SearchResult]:
        return SemanticRetriever._execute_search(
            db=db,
            project_id=project_id,
            query=query,
            primary_topic=primary_topic,
            extracted_entities=extracted_entities,
            top_k=top_k,
            site_id=site_id,
            area_id=area_id,
            source_types=source_types,
            min_similarity=min_similarity,
            query_plan=query_plan
        )

    @classmethod
    def _execute_search(
        cls,
        db: Session,
        project_id: int,
        query: str,
        primary_topic: Optional[Any] = None,
        extracted_entities: Optional[List[str]] = None,
        top_k: int = 8,
        site_id: Optional[int] = None,
        area_id: Optional[int] = None,
        source_types: Optional[List[str]] = None,
        min_similarity: float = 0.04,
        query_plan: Optional[ExpandedQueryPlan] = None
    ) -> List[SearchResult]:
        if not query or not query.strip():
            return []

        query_str = query.strip()

        # 1. Semantic Query Expansion & Plan Generation (Phase 8.E.1)
        plan = query_plan or QueryExpansionService.expand_query(db=db, project_id=project_id, query=query_str)

        # 2. Multi-Query Dense Semantic Vector Embeddings
        # Embed the original query + up to 2 distinct expanded formulations
        query_vectors: List[Tuple[float, List[float]]] = []
        queries_to_embed = [(1.0, plan.original_query)]
        for eq in plan.expanded_queries[1:3]:
            if eq and eq.lower() != plan.original_query.lower():
                queries_to_embed.append((0.85, eq))

        for weight, q_text in queries_to_embed:
            try:
                vec = EmbeddingService.get_embedding(q_text)
                if vec:
                    query_vectors.append((weight, vec))
            except Exception as e:
                logger.warning(f"Embedding generation failed for '{q_text}': {e}")

        # 3. Native PostgreSQL pgvector Semantic Retrieval (Phase 8.2F)
        # Query dense semantic similarities directly in PostgreSQL using <=> (cosine distance)
        doc_sem_scores: Dict[int, float] = {}
        for weight, q_vec in query_vectors:
            try:
                distance_expr = models.RAGDocument.embedding.cosine_distance(q_vec)
                vec_q = (
                    db.query(
                        models.RAGDocument.id,
                        distance_expr.label("distance")
                    )
                    .filter(
                        models.RAGDocument.project_id == project_id,
                        models.RAGDocument.embedding.isnot(None)
                    )
                )
                if source_types:
                    vec_q = vec_q.filter(models.RAGDocument.source_type.in_(source_types))

                for doc_id, dist in vec_q.all():
                    if dist is not None:
                        cosine_sim = max(0.0, min(1.0, 1.0 - float(dist)))
                        weighted_sim = weight * cosine_sim
                        if doc_id not in doc_sem_scores or weighted_sim > doc_sem_scores[doc_id]:
                            doc_sem_scores[doc_id] = weighted_sim
            except Exception as e:
                logger.warning(f"pgvector cosine distance query error: {e}")

        # 4. Query scoped documents from PostgreSQL strictly filtered by project_id
        doc_q = db.query(models.RAGDocument).filter(models.RAGDocument.project_id == project_id)

        target_site_id = site_id or plan.matched_site_id
        target_area_id = area_id or (plan.matched_area_ids[0] if len(plan.matched_area_ids) == 1 and not plan.is_blocker_query else None)

        effective_source_types = source_types or plan.likely_source_types
        # If specific source types were requested, apply filter
        if source_types:
            doc_q = doc_q.filter(models.RAGDocument.source_type.in_(source_types))

        candidate_docs = doc_q.all()
        if not candidate_docs:
            return []

        # Tokenize meaningful words across original query + expanded queries
        stopwords = {
            "what", "is", "the", "are", "in", "of", "to", "and", "a", "an", "for", "on",
            "with", "this", "that", "which", "give", "me", "show", "tell", "there", "any",
            "about", "how", "many", "been", "was", "were", "who", "whom", "will", "can",
            "why", "cant", "can't", "did", "does", "whats", "what's"
        }
        all_q_words = []
        for eq in plan.expanded_queries:
            all_q_words.extend([w for w in re.findall(r'\w+', eq.lower()) if len(w) > 1 and w not in stopwords])
        meaningful_q_words = list(dict.fromkeys(all_q_words))  # preserve order & unique
        if not meaningful_q_words:
            meaningful_q_words = [w for w in re.findall(r'\w+', query_str.lower()) if len(w) > 1]

        # 5. Multi-Signal Multi-Query Scoring
        scored_candidates: List[SearchResult] = []
        for doc in candidate_docs:
            title = doc.title or ""
            content = doc.content or ""
            full_text = f"{title} {content}".lower()
            text_tokens = set(re.findall(r'\w+', full_text))

            meta = {}
            if doc.metadata_json:
                try:
                    meta = json.loads(doc.metadata_json)
                except Exception:
                    pass

            hierarchy_path = meta.get("hierarchy_path", "")

            # A. Dense Semantic Vector Score (retrieved via native PostgreSQL pgvector)
            sem_score = doc_sem_scores.get(doc.id, 0.0)

            # B. Lexical Overlap Score (across expanded union)
            lex_score = _compute_lexical_score(meaningful_q_words, text_tokens)

            # C. Multi-Word Exact Phrase Score
            phrase_score = _compute_phrase_score(plan.phrases, full_text, title)

            # D. Dynamic Database Entity Score
            entity_score = _compute_entity_score(plan.entities, title, full_text, meta)

            # E. Construction Hierarchy Score (Boosted for area matches)
            hier_score = _compute_hierarchy_score(plan, hierarchy_path, doc.area_id, doc.site_id)

            # F. Metadata Score
            meta_score = _compute_metadata_score(plan, meta, doc.source_type)

            # G. Time / Date Score
            time_score = _compute_time_score(plan, meta)

            # H. Combined Relevance Formula
            if sem_score > 0.0:
                combined_score = (
                    0.35 * sem_score +
                    0.20 * lex_score +
                    0.15 * phrase_score +
                    0.10 * entity_score +
                    0.10 * hier_score +
                    0.05 * meta_score +
                    0.05 * time_score
                )
            else:
                combined_score = (
                    0.30 * lex_score +
                    0.25 * phrase_score +
                    0.15 * entity_score +
                    0.15 * hier_score +
                    0.10 * meta_score +
                    0.05 * time_score
                )

            # Spatial Confinement Boost: If query explicitly asks about an area and doc matches area, boost combined_score
            if plan.matched_area_ids and doc.area_id in plan.matched_area_ids:
                combined_score = min(1.0, combined_score + 0.15)

            if combined_score >= min_similarity:
                scored_candidates.append(
                    SearchResult(
                        doc_id=doc.id,
                        project_id=doc.project_id,
                        site_id=doc.site_id,
                        area_id=doc.area_id,
                        doc_type=doc.source_type,
                        source_id=doc.source_id,
                        title=title,
                        content=content,
                        metadata=meta,
                        relevance_score=round(float(combined_score), 4),
                        semantic_score=round(float(sem_score), 4),
                        lexical_score=round(float(lex_score), 4),
                        phrase_score=round(float(phrase_score), 4),
                        entity_score=round(float(entity_score), 4),
                        hierarchy_score=round(float(hier_score), 4),
                        metadata_score=round(float(meta_score), 4),
                        time_score=round(float(time_score), 4),
                        hierarchy_path=hierarchy_path
                    )
                )

        # 5. Phase 8.2E: Authoritative Structured Retrieval Merging
        reqs = getattr(plan, "requirements", None)
        if reqs and (reqs.needs_exact_structured_data or reqs.requested_source_types):
            from services.rag.structured_retriever import StructuredDataRetriever
            try:
                facts = StructuredDataRetriever.retrieve_authoritative_facts(db=db, project_id=project_id, requirements=reqs)
                auth_results = StructuredDataRetriever.convert_to_search_results(facts, project_id=project_id)
                if auth_results:
                    seen_keys = {(c.doc_type, c.source_id) for c in auth_results}
                    remaining = [c for c in scored_candidates if (c.doc_type, c.source_id) not in seen_keys]
                    scored_candidates = auth_results + remaining
            except Exception as e:
                logger.warning(f"Error merging authoritative structured results: {e}")

        # 6. Result Diversity & Multi-Source Blending
        scored_candidates.sort(key=lambda x: (x.relevance_score, x.phrase_score, x.lexical_score), reverse=True)

        if not scored_candidates:
            return []

        # If problem/blocker/concern query, ensure multi-source diversity
        if (plan.is_blocker_query or plan.is_material_query) and len(scored_candidates) > top_k:
            diverse_results = []
            seen_types = {}
            for item in scored_candidates:
                st = item.doc_type
                count = seen_types.get(st, 0)
                if count < 2 or len(diverse_results) < top_k // 2:
                    diverse_results.append(item)
                    seen_types[st] = count + 1
                if len(diverse_results) >= top_k:
                    break
            
            # Fill remaining slots with top scored if needed
            if len(diverse_results) < top_k:
                for item in scored_candidates:
                    if item not in diverse_results:
                        diverse_results.append(item)
                    if len(diverse_results) >= top_k:
                        break
            return diverse_results[:top_k]

        return scored_candidates[:top_k]
