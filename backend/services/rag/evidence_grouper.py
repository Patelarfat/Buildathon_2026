"""
Evidence Grouping, Reranking & Corroboration Engine (Phase 8.2C).
Transforms raw multi-signal RAG candidates into normalized, grouped, and corroborated
construction evidence packages:
- Identifies underlying real-world issues dynamically without hardcoded regex
- Discovers corroborating evidence across multiple source types (e.g. Material + Daily Report + Observation)
- Distinguishes Primary Evidence from Supporting Evidence
- Calculates Corroboration & Confidence Scores
- Detects Contradictions & Temporal State Transitions
- Binds output to a clean, high-precision evidence set (3-6 groups)
Strictly project isolated.
"""

import re
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple, Set
from pydantic import BaseModel, Field

import schemas

logger = logging.getLogger(__name__)


class NormalizedEvidence(BaseModel):
    """
    Standardized internal representation of a retrieved construction document.
    """
    doc_id: int
    source_type: str
    source_id: int
    title: str
    content: str
    project_id: int
    site_id: Optional[int] = None
    area_id: Optional[int] = None
    hierarchy_path: str = ""
    date: Optional[str] = None
    status: Optional[str] = None
    severity: Optional[str] = None
    category: Optional[str] = None
    relevance_score: float = 0.0
    component_scores: Dict[str, float] = {}
    is_authoritative: bool = True
    parsed_date: Optional[datetime] = None


class EvidenceGroup(BaseModel):
    """
    Represents a synthesized real-world construction issue or topic with primary and supporting evidence.
    """
    issue_key: str
    issue_title: str
    primary_evidence: NormalizedEvidence
    supporting_evidence: List[NormalizedEvidence] = []
    duplicate_evidence: List[NormalizedEvidence] = []
    confidence: str = "MODERATE"  # MODERATE, HIGH, VERY_HIGH
    corroboration_score: float = 0.5
    contradiction_detected: bool = False
    conflict_notes: Optional[str] = None
    latest_date: Optional[str] = None
    project_id: int
    site_id: Optional[int] = None
    area_id: Optional[int] = None
    group_score: float = 0.0
    source_types: List[str] = []
    explainability: Dict[str, Any] = {}


# Source type reliability hierarchy (Base reliability weightings)
SOURCE_RELIABILITY_WEIGHTS = {
    "MATERIAL": 1.0,
    "DAILY_REPORT": 1.0,
    "INCIDENT": 1.0,
    "INSPECTION": 1.0,
    "OBSERVATION": 0.90,
    "AI_FINDING": 0.85,
    "PHOTO": 0.80,
    "PROJECT": 0.75,
    "SITE": 0.75,
    "AREA": 0.75,
}


def _clean_text_for_tokens(text: str) -> str:
    """Removes standard RAG4CM structural hierarchy headers to isolate record-specific semantics."""
    cleaned = re.sub(r'PROJECT:[^\n]+', '', text, flags=re.IGNORECASE)
    cleaned = re.sub(r'SITE:[^\n]+', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'HIERARCHY:[^\n]+', '', cleaned, flags=re.IGNORECASE)
    return cleaned


def _extract_subject_tokens(text: str) -> Set[str]:
    """
    Extracts meaningful domain entity and subject tokens for grouping similarity.
    Removes generic construction boilerplate to avoid false clustering across different events.
    """
    stopwords = {
        "what", "is", "the", "are", "in", "of", "to", "and", "a", "an", "for", "on",
        "with", "this", "that", "which", "give", "me", "show", "tell", "there", "any",
        "about", "how", "many", "been", "was", "were", "who", "whom", "will", "can",
        "source", "type", "title", "status", "date", "content", "project", "site", "area",
        "hierarchy", "record", "recorded", "tracking", "category", "inventory", "notes",
        "details", "observation", "finding", "report", "site_name", "area_name", "location",
        "workers", "weather", "progress", "completed", "planned", "blockers", "issues",
        "equipment", "used", "materials", "clear", "cloudy", "sunny", "rainy", "percentage",
        "workforce", "activity", "activities", "stage", "phase", "standard", "normal", "today",
        "daily", "summary", "audit", "review", "action", "taken", "hours", "shift", "general",
        "person", "verified", "total", "count", "high", "medium", "low", "zone", "open", "closed",
        "work", "site", "level", "operations", "main", "phase"
    }
    raw = _clean_text_for_tokens(text)
    words = re.findall(r'\w+', raw.lower())
    return {w for w in words if w not in stopwords and len(w) > 2}


def _calculate_token_jaccard(tokens1: Set[str], tokens2: Set[str]) -> float:
    """Computes Jaccard overlap between two token sets."""
    if not tokens1 or not tokens2:
        return 0.0
    intersection = tokens1.intersection(tokens2)
    union = tokens1.union(tokens2)
    return len(intersection) / len(union) if union else 0.0


def _parse_iso_date(date_str: Optional[str]) -> Optional[datetime]:
    """Safely parses YYYY-MM-DD or datetime string."""
    if not date_str:
        return None
    cleaned = str(date_str).strip()[:10]
    try:
        return datetime.strptime(cleaned, "%Y-%m-%d")
    except Exception:
        return None


class EvidenceGrouper:
    """
    Evidence Normalization, Grouping, Corroboration & Reranking Engine.
    """

    @classmethod
    def normalize_candidates(cls, raw_candidates: List[Any]) -> List[NormalizedEvidence]:
        """
        Converts raw SearchResult dicts/objects into normalized structures with parsed dates and authority weights.
        """
        normalized_list: List[NormalizedEvidence] = []
        for c in raw_candidates:
            doc_id = c.get("doc_id") if isinstance(c, dict) else getattr(c, "doc_id", 0)
            source_type = c.get("doc_type") or c.get("source_type") if isinstance(c, dict) else (getattr(c, "doc_type", None) or getattr(c, "source_type", "UNKNOWN"))
            source_id = c.get("source_id") if isinstance(c, dict) else getattr(c, "source_id", doc_id)
            title = c.get("title") or "" if isinstance(c, dict) else getattr(c, "title", "")
            content = c.get("content") or "" if isinstance(c, dict) else getattr(c, "content", "")
            project_id = c.get("project_id") if isinstance(c, dict) else getattr(c, "project_id", 0)
            site_id = c.get("site_id") if isinstance(c, dict) else getattr(c, "site_id", None)
            area_id = c.get("area_id") if isinstance(c, dict) else getattr(c, "area_id", None)
            meta = c.get("metadata") or {} if isinstance(c, dict) else getattr(c, "metadata", {})
            relevance = c.get("relevance_score") or c.get("similarity", 0.0) if isinstance(c, dict) else getattr(c, "relevance_score", 0.0)

            hierarchy_path = meta.get("hierarchy_path") or c.get("hierarchy_path", "") if isinstance(c, dict) else (meta.get("hierarchy_path") or getattr(c, "hierarchy_path", ""))
            date_val = meta.get("date") or meta.get("incident_date") or meta.get("report_date") or meta.get("delivery_date")
            status_val = meta.get("status")
            severity_val = meta.get("severity") or meta.get("priority")
            category_val = meta.get("category") or meta.get("incident_type") or meta.get("inspection_type") or meta.get("finding_type")

            comp_scores = {
                "semantic": c.get("semantic_score", 0.0) if isinstance(c, dict) else getattr(c, "semantic_score", 0.0),
                "lexical": c.get("lexical_score", 0.0) if isinstance(c, dict) else getattr(c, "lexical_score", 0.0),
                "phrase": c.get("phrase_score", 0.0) if isinstance(c, dict) else getattr(c, "phrase_score", 0.0),
                "entity": c.get("entity_score", 0.0) if isinstance(c, dict) else getattr(c, "entity_score", 0.0),
                "hierarchy": c.get("hierarchy_score", 0.0) if isinstance(c, dict) else getattr(c, "hierarchy_score", 0.0),
                "metadata": c.get("metadata_score", 0.0) if isinstance(c, dict) else getattr(c, "metadata_score", 0.0),
                "time": c.get("time_score", 0.0) if isinstance(c, dict) else getattr(c, "time_score", 0.0),
            }

            norm = NormalizedEvidence(
                doc_id=doc_id,
                source_type=source_type,
                source_id=source_id,
                title=title,
                content=content,
                project_id=project_id,
                site_id=site_id,
                area_id=area_id,
                hierarchy_path=hierarchy_path,
                date=str(date_val) if date_val else None,
                status=str(status_val) if status_val else None,
                severity=str(severity_val) if severity_val else None,
                category=str(category_val) if category_val else None,
                relevance_score=round(float(relevance), 4),
                component_scores=comp_scores,
                is_authoritative=SOURCE_RELIABILITY_WEIGHTS.get(source_type, 0.8) >= 0.95,
                parsed_date=_parse_iso_date(str(date_val) if date_val else None)
            )
            normalized_list.append(norm)

        return normalized_list

    @classmethod
    def are_records_corroborating(cls, rec1: NormalizedEvidence, rec2: NormalizedEvidence) -> bool:
        """
        Determines if two records describe the same underlying construction issue/topic
        using entity, subject token, spatial, and semantic overlap.
        DOES NOT merge records solely on shared location (preserves causality boundaries).
        """
        if rec1.doc_id == rec2.doc_id:
            return True

        # Extract core subject tokens (stripping generic scaffolding words)
        tokens1 = _extract_subject_tokens(f"{rec1.title} {rec1.content}")
        tokens2 = _extract_subject_tokens(f"{rec2.title} {rec2.content}")

        jaccard = _calculate_token_jaccard(tokens1, tokens2)

        # 1. Exact Material / Equipment / Specific Subject Overlap
        title1_words = set(re.findall(r'\w+', rec1.title.lower())) - {"material", "observation", "finding", "incident", "inspection", "report", "site", "area", "scan"}
        title2_words = set(re.findall(r'\w+', rec2.title.lower())) - {"material", "observation", "finding", "incident", "inspection", "report", "site", "area", "scan"}
        shared_title_words = [w for w in title1_words if w in title2_words and len(w) > 3]

        if len(shared_title_words) >= 2:
            return True

        # 2. Material record + Daily Report / Observation mentioning the exact material
        if (rec1.source_type == "MATERIAL" or rec2.source_type == "MATERIAL"):
            mat_rec = rec1 if rec1.source_type == "MATERIAL" else rec2
            other_rec = rec2 if rec1.source_type == "MATERIAL" else rec1
            mat_name_tokens = {w for w in re.findall(r'\w+', mat_rec.title.lower()) if len(w) > 3 and w not in ["material", "sets", "meters", "boxes", "delayed", "available", "units", "tons", "stock"]}
            other_cleaned_text = _clean_text_for_tokens(f"{other_rec.title} {other_rec.content}").lower()
            if mat_name_tokens and any(token in other_cleaned_text for token in mat_name_tokens):
                return True

        # 3. High Subject Token Jaccard overlap (> 0.20 on clean domain tokens)
        if jaccard >= 0.20:
            if rec1.source_type == "DAILY_REPORT" and rec2.source_type == "DAILY_REPORT":
                return len(tokens1.intersection(tokens2)) >= 3
            if rec1.area_id == rec2.area_id or not rec1.area_id or not rec2.area_id:
                return True

        # 4. Same source entity duplicate check
        if rec1.source_type == rec2.source_type and rec1.source_id == rec2.source_id:
            return True

        return False

    @classmethod
    def are_records_duplicates(cls, rec1: NormalizedEvidence, rec2: NormalizedEvidence) -> bool:
        """
        Detects if two records are effectively identical logs of the same event.
        If status or date differs, they represent temporal state updates/transitions rather than duplicates.
        """
        if rec1.source_type == rec2.source_type and rec1.source_id == rec2.source_id:
            if rec1.status and rec2.status and rec1.status != rec2.status:
                return False
            if rec1.date and rec2.date and rec1.date != rec2.date:
                return False
            return True
        if rec1.title.strip().lower() == rec2.title.strip().lower() and rec1.date == rec2.date:
            return True
        return False

    @classmethod
    def detect_contradictions(cls, records: List[NormalizedEvidence]) -> Tuple[bool, Optional[str]]:
        """
        Identifies state conflicts between records referencing the same entity
        (e.g. Material marked AVAILABLE vs Daily Report stating DELAYED).
        """
        if len(records) < 2:
            return False, None

        statuses = [r.status for r in records if r.status]
        if not statuses:
            return False, None

        has_available = any(s in ["AVAILABLE", "IN_STOCK", "COMPLIANT", "PASSED", "RESOLVED"] for s in statuses)
        has_problem = any(s in ["DELAYED", "OUT_OF_STOCK", "LOW_STOCK", "FAILED", "OPEN", "VIOLATION"] for s in statuses)

        if has_available and has_problem:
            # Sort by date to see transition
            dated_records = [r for r in records if r.parsed_date]
            if dated_records:
                dated_records.sort(key=lambda x: x.parsed_date)
                first_r = dated_records[0]
                latest_r = dated_records[-1]
                note = f"State transition / conflict detected: Earlier record ({first_r.date or 'N/A'}) had status '{first_r.status}', while latest record ({latest_r.date or 'N/A'}) is '{latest_r.status}'."
                return True, note
            return True, "Conflicting status states detected among corroborating records."

        return False, None

    @classmethod
    def group_and_rerank(
        cls,
        raw_candidates: List[Any],
        query: str = "",
        top_groups: int = 5,
        project_id: Optional[int] = None
    ) -> List[EvidenceGroup]:
        """
        Executes full Phase 8.2C evidence grouping, corroboration scoring, contradiction detection, and final reranking.
        """
        if not raw_candidates:
            return []

        # 1. Normalize candidates & enforce project isolation if project_id is provided
        normalized_candidates = cls.normalize_candidates(raw_candidates)
        if project_id is not None:
            normalized_candidates = [c for c in normalized_candidates if c.project_id == project_id]
            if not normalized_candidates:
                return []

        # 2. Cluster candidates into semantic issue groups
        clusters: List[List[NormalizedEvidence]] = []
        for cand in normalized_candidates:
            assigned = False
            for cluster in clusters:
                # Check if candidate corroborates with the leader of the cluster
                leader = cluster[0]
                if cls.are_records_corroborating(cand, leader):
                    cluster.append(cand)
                    assigned = True
                    break
            if not assigned:
                clusters.append([cand])

        # 3. Process each cluster into an EvidenceGroup
        evidence_groups: List[EvidenceGroup] = []
        for cluster in clusters:
            # Sort cluster items by (is_authoritative, relevance_score * reliability_weight, recency)
            def score_key(rec: NormalizedEvidence) -> Tuple[float, float, str]:
                auth_bonus = 10.0 if getattr(rec, "is_authoritative", False) else 0.0
                rel_weight = SOURCE_RELIABILITY_WEIGHTS.get(rec.source_type, 0.8)
                weighted_rel = (rec.relevance_score * rel_weight) + auth_bonus
                date_val = rec.parsed_date.timestamp() if rec.parsed_date else 0.0
                return (weighted_rel, date_val, rec.title)

            cluster.sort(key=score_key, reverse=True)

            primary_rec = cluster[0]
            supporting_recs: List[NormalizedEvidence] = []
            duplicate_recs: List[NormalizedEvidence] = []

            for other_rec in cluster[1:]:
                if cls.are_records_duplicates(primary_rec, other_rec):
                    duplicate_recs.append(other_rec)
                else:
                    supporting_recs.append(other_rec)

            # Calculate Corroboration & Confidence
            distinct_source_types = list(set([r.source_type for r in [primary_rec] + supporting_recs]))
            num_independent_sources = len(distinct_source_types)

            if num_independent_sources >= 3 or len(supporting_recs) >= 3:
                confidence = "VERY_HIGH"
                corroboration_score = 1.0
            elif num_independent_sources == 2 or len(supporting_recs) >= 1:
                confidence = "HIGH"
                corroboration_score = 0.85
            else:
                confidence = "MODERATE"
                corroboration_score = 0.50

            # Detect Contradictions across all cluster records
            has_conflict, conflict_notes = cls.detect_contradictions(cluster)

            # Latest Date
            all_dates = [r.date for r in [primary_rec] + supporting_recs if r.date]
            latest_date = max(all_dates) if all_dates else None

            # Calculate Composite Group Score
            # group_score = 0.60 * primary_relevance + 0.25 * corroboration_score + 0.15 * source_reliability
            primary_rel = primary_rec.relevance_score
            primary_weight = SOURCE_RELIABILITY_WEIGHTS.get(primary_rec.source_type, 0.8)
            group_score = round(
                (0.60 * primary_rel) + (0.25 * corroboration_score) + (0.15 * primary_weight),
                4
            )

            # Generate clean issue title
            clean_title = re.sub(r'#[A-Z0-9_]+', '', primary_rec.title).strip(" :·-")
            if primary_rec.status and primary_rec.status not in clean_title:
                clean_title = f"{clean_title} ({primary_rec.status})"

            issue_key = f"{primary_rec.source_type}_{primary_rec.source_id}"

            group = EvidenceGroup(
                issue_key=issue_key,
                issue_title=clean_title,
                primary_evidence=primary_rec,
                supporting_evidence=supporting_recs,
                duplicate_evidence=duplicate_recs,
                confidence=confidence,
                corroboration_score=corroboration_score,
                contradiction_detected=has_conflict,
                conflict_notes=conflict_notes,
                latest_date=latest_date,
                project_id=primary_rec.project_id,
                site_id=primary_rec.site_id,
                area_id=primary_rec.area_id,
                group_score=group_score,
                source_types=distinct_source_types,
                explainability={
                    "primary_score": primary_rel,
                    "corroboration_score": corroboration_score,
                    "confidence": confidence,
                    "independent_sources_count": num_independent_sources,
                    "contradiction": has_conflict
                }
            )
            evidence_groups.append(group)

        # 4. Final Reranking of Evidence Groups
        evidence_groups.sort(key=lambda g: (g.group_score, g.corroboration_score), reverse=True)

        return evidence_groups[:top_groups]

    @classmethod
    def format_grouped_evidence_block(
        cls,
        groups: List[EvidenceGroup]
    ) -> Tuple[str, List[schemas.AssistantSource]]:
        """
        Converts top EvidenceGroups into grounded LLM prompt context and structured manager citations.
        """
        if not groups:
            return "", []

        evidence_lines = []
        sources: List[schemas.AssistantSource] = []
        seen_source_keys = set()

        def add_source(rec: NormalizedEvidence, is_primary: bool = True):
            source_key = f"{rec.source_type}_{rec.source_id}"
            if source_key not in seen_source_keys:
                seen_source_keys.add(source_key)
                clean_title = re.sub(r'#[A-Z0-9_]+', '', rec.title).strip(" :·-")
                detail_parts = []
                if rec.status:
                    detail_parts.append(f"Status: {rec.status}")
                if rec.date:
                    detail_parts.append(f"Date: {rec.date}")
                if is_primary:
                    detail_parts.append("Primary Evidence")
                else:
                    detail_parts.append("Supporting Evidence")
                
                detail_str = " · ".join(detail_parts)
                sources.append(schemas.AssistantSource(
                    type=rec.source_type,
                    id=source_key,
                    title=clean_title,
                    detail=detail_str
                ))

        for idx, g in enumerate(groups, 1):
            p = g.primary_evidence
            add_source(p, is_primary=True)

            group_block = [
                f"### [ISSUE {idx}] {g.issue_title} (Confidence: {g.confidence})",
                f"- PRIMARY EVIDENCE: [{p.source_type} #{p.source_id}] {p.content}"
            ]

            if g.supporting_evidence:
                group_block.append("- CORROBORATING / SUPPORTING EVIDENCE:")
                for s in g.supporting_evidence:
                    add_source(s, is_primary=False)
                    group_block.append(f"  * [{s.source_type} #{s.source_id}] {s.content}")

            if g.contradiction_detected and g.conflict_notes:
                group_block.append(f"- NOTE: {g.conflict_notes}")

            evidence_lines.append("\n".join(group_block))

        evidence_block = "VERIFIED PROJECT SEMANTIC EVIDENCE (CORROBORATED EVIDENCE GROUPS):\n\n" + "\n\n".join(evidence_lines)
        return evidence_block, sources
