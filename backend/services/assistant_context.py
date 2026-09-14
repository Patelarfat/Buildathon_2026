"""
Hybrid RAG Context Retrieval Service for GenAI Construction Project Assistant (Phase 8.E.1).
Combines:
1. Structured Query Understanding & Semantic Query Expansion (services.query_expansion)
2. Authoritative Risk Engine Assessment (evaluated strictly when relevant)
3. Exact SQL Facts & Counts (retrieved strictly when relevant)
4. Production-Grade Hybrid RAG Semantic & Lexical Evidence (services.rag.retriever)
5. Evidence Grouping, Reranking & Corroboration Engine (services.rag.evidence_grouper)
6. Clean, Verified Source Provenance strictly isolated by project_id.
"""

import re
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

import models
import schemas
from services.risk_engine import RiskEngine
from services.recurring_issue_service import RecurringIssueService
from services.trend_service import TrendService
from services.ppe_constants import AI_PPE_COMPLIANCE_TYPES, AI_PPE_VIOLATION_TYPES
from services.ppe_analyzer import get_project_ppe_summary
from services.rag.retriever import SemanticRetriever
from services.rag.evidence_grouper import EvidenceGrouper, EvidenceGroup
from services.query_understanding import analyze_query, QueryUnderstanding, QueryRequirements
from services.query_expansion import QueryExpansionService, ExpandedQueryPlan

logger = logging.getLogger(__name__)


def classify_user_intent(query: str) -> str:
    """
    Backwards-compatible convenience wrapper returning primary topic string.
    """
    q = query.lower().strip()
    clean_q = re.sub(r'[^\w\s]', '', q).strip()

    if clean_q in ["hi", "hii", "hello", "hey", "greetings", "help", "who are you"]:
        return "GREETING"

    # Daily Report & General Progress
    if any(kw in q for kw in ["generate today's report", "today's report", "daily report", "what happened today", "today's progress", "project progress", "construction progress", "site progress", "what is the progress", "what is the project progress", "current progress"]) or bool(re.search(r'\b(today|daily|progress)\b', q) and not re.search(r'\b(weekly|this\s+week)\b', q)):
        return "DAILY_REPORT"

    # Weekly Report
    if any(kw in q for kw in ["generate a weekly site progress report", "weekly site progress report", "weekly progress report", "weekly report", "this week's progress report", "what progress was made this week", "summarize this week's construction progress"]) or bool(re.search(r'\b(weekly|this\s+week)\b', q) and re.search(r'\b(report|progress|milestone|construction)\b', q)):
        return "WEEKLY_PROGRESS_REPORT"

    # Recurring Issues
    if any(kw in q for kw in ["recurring problem", "recurring issue", "occurred repeatedly", "repeated issues", "frequent problems"]):
        return "RECURRING_ISSUES"

    # Issues Summary
    if any(kw in q for kw in ["problems reported this week", "issues reported this week", "summarize the problems reported this week", "issues this week"]):
        return "ISSUES_SUMMARY"

    # Risk Queries
    if any(kw in q for kw in ["why is the project risk high", "why is project risk high", "what is the project risk score", "what is the project risk", "risk assessment", "risk factors", "current rating", "risk flagged", "risk rating"]):
        return "SAFETY_RISK"

    # Materials
    if any(kw in q for kw in ["material", "materials", "shortage", "delayed material", "stock", "facade", "rebar", "cement", "tiles", "cable", "resources", "supplies", "procurement"]):
        return "MATERIALS"

    # PPE
    if any(kw in q for kw in ["ppe", "helmet", "gloves", "boots", "goggles", "vest", "ppe violation"]):
        return "PPE"

    # Area
    if any(kw in q for kw in ["safety issues in", "safety issues were found in", "tower crane area", "area needs attention"]):
        return "AREA_SAFETY"

    return "GENERAL_PROJECT_QUERY"


def retrieve_assistant_context(
    db: Session,
    project_id: int,
    query: str
) -> Tuple[str, List[schemas.AssistantSource], List[str], str]:
    """
    Builds a grounded Hybrid RAG prompt context strictly isolated to project_id.
    - Expands and analyzes query intent & entities (Phase 8.E.1).
    - Executes multi-query pgvector semantic + lexical hybrid search across project records.
    - Groups and corroborates multi-source evidence (Phase 8.2C).
    - Appends exact SQL facts and Risk Engine only when relevant to the question.
    """
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        return "", [], [], ""

    project_name = project.name
    
    # 1. Semantic Query Expansion (Phase 8.E.1)
    plan = QueryExpansionService.expand_query(db=db, project_id=project_id, query=query)
    intent = plan.primary_topic

    sources: List[schemas.AssistantSource] = []
    data_used: List[str] = []
    seen_source_keys = set()

    def add_source(st: str, sid: str, title: str, detail: Optional[str] = None):
        key = f"{st}_{sid}"
        if key not in seen_source_keys:
            seen_source_keys.add(key)
            sources.append(schemas.AssistantSource(type=st, id=key, title=title, detail=detail))

    # Conversational Queries (Greeting / Out of Scope)
    clean_q = re.sub(r'[^\w\s]', '', query.lower()).strip()
    if clean_q in ["hi", "hii", "hello", "hey", "greetings", "help", "who are you"]:
        return f"User Greeting for {project_name}.", [], ["conversational"], project_name
    if any(term in query.lower() for term in ["who is the president", "tell me a joke", "recipe for", "cricket"]):
        return f"Out of Scope query regarding {project_name}.", [], ["domain_scope"], project_name

    context_sections = []

    # 2. Authoritative Structured Data Retrieval (Phase 8.2E)
    from services.rag.structured_retriever import StructuredDataRetriever
    reqs = plan.requirements or QueryRequirements()
    structured_facts = StructuredDataRetriever.retrieve_authoritative_facts(db=db, project_id=project_id, requirements=reqs)
    structured_block = StructuredDataRetriever.format_authoritative_facts_block(structured_facts)
    if structured_block:
        context_sections.append(f"<AUTHORITATIVE_STRUCTURED_FACTS>\n{structured_block}\n</AUTHORITATIVE_STRUCTURED_FACTS>")
        for s in structured_facts.get("sources", []):
            add_source(st=s.type, sid=s.id, title=s.title, detail=s.detail)
        for du in structured_facts.get("data_used", []):
            if du not in data_used:
                data_used.append(du)

    # 3. Hybrid RAG Search & Evidence Grouping (Phase 8.2B + Phase 8.2C + Phase 8.E.1 + Phase 8.2E)
    evidence_groups: List[EvidenceGroup] = []
    if plan.needs_semantic_rag:
        try:
            retriever = SemanticRetriever(db)
            search_res = retriever.search(
                project_id=project_id,
                query=query,
                primary_topic=plan.primary_topic,
                extracted_entities=plan.entities,
                top_k=8,
                query_plan=plan
            )
            if search_res:
                if "semantic_rag" not in data_used:
                    data_used.append("semantic_rag")
                # Group & Rerank evidence
                evidence_groups = EvidenceGrouper.group_and_rerank(search_res, query=query, top_groups=5, project_id=project_id)
                evidence_text, group_sources = EvidenceGrouper.format_grouped_evidence_block(evidence_groups)
                if evidence_text:
                    context_sections.append(f"<SEMANTIC_SUPPORTING_EVIDENCE>\n{evidence_text}\n</SEMANTIC_SUPPORTING_EVIDENCE>")
                for s in group_sources:
                    add_source(st=s.type, sid=s.id, title=s.title, detail=s.detail)
        except Exception as e:
            logger.warning(f"Semantic RAG retrieval error: {e}")

    # 4. PPE Vision Summary (when PPE requested)
    if intent == "PPE" or plan.is_ppe_query or "PPE" in reqs.requested_source_types:
        ppe_summary = get_project_ppe_summary(db=db, project_id=project_id)
        compliance_pct = ppe_summary.get("overall_compliance", 100.0)
        violations_cnt = ppe_summary.get("workers_with_violations", 0)
        scanned_cnt = ppe_summary.get("workers_detected", 0)
        viols_list = ppe_summary.get("violations_list", [])
        context_sections.append(
            f"AI PPE VISION COMPLIANCE (SQL FACTS):\n"
            f"- Scanned Workers: {scanned_cnt}\n"
            f"- Overall Compliance: {compliance_pct}%\n"
            f"- Violations: {violations_cnt}\n"
            f"- Recent Observations: {', '.join(viols_list[:3]) if viols_list else 'All personnel verified compliant'}"
        )
        add_source("PPE_VISION", "summary", f"AI PPE Vision ({compliance_pct}%)", f"Violations: {violations_cnt}")
        if "ppe_vision" not in data_used:
            data_used.append("ppe_vision")

    # 5. Authoritative Risk Engine Assessment (Strictly Isolated & Scoped)
    if plan.needs_risk_engine or reqs.is_risk_query or intent in ["SAFETY_RISK", "SAFETY_ISSUES", "SAFETY"] or any(w in query.lower() for w in ["risk", "safety issue", "safety problem"]):
        risk_eval = RiskEngine.evaluate_risk(db=db, project_id=project_id, days=7)
        r_score = risk_eval.get("score") if risk_eval.get("score") is not None else risk_eval.get("risk_score", 0)
        r_level = risk_eval.get("level") or risk_eval.get("risk_level", "LOW")
        r_reasons = risk_eval.get("reasons", [])
        
        risk_lines = [f"- {r}" for r in r_reasons]
        context_sections.append(
            f"<AUTHORITATIVE_RISK_ENGINE>\n"
            f"AUTHORITATIVE RISK ENGINE EVALUATION (STRICT SINGLE-SOURCE-OF-TRUTH):\n"
            f"- Authoritative Risk Score: {r_score}/100 ({r_level})\n"
            f"- Project Risk Score: {r_score}/100 ({r_level})\n"
            f"- Primary Contributing Factors:\n" + "\n".join(risk_lines) +
            f"\n</AUTHORITATIVE_RISK_ENGINE>"
        )
        add_source("RISK_ENGINE", "assessment", f"Site Risk Rating: {r_score}/100 ({r_level})", f"Active Contributing Factors: {len(r_reasons)}")
        if "risk_engine" not in data_used:
            data_used.append("risk_engine")

    full_context = "\n\n".join(context_sections)
    return full_context, sources, data_used, project_name
