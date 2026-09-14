"""
Structured Assistant Response Service (Phase 8.E.1 / Executive Summary Presentation Fix).
Builds intent-targeted, deterministic, and typed response objects directly from:
- Ground-truth PostgreSQL database records
- Authoritative deterministic Risk Engine (0-100) strictly when requested
- Production-Grade Hybrid RAG semantic & lexical evidence
- Dynamic card selection: ONLY populates relevant sections (suppresses generic risk cards for non-risk queries).
- Zero Internal Metadata Leakage: Guarantees executive_summary contains only natural managerial prose.

Eliminates repetitive identical responses and ensures true question-focused Decision Center UX.
"""

import re
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

import models
import schemas
from services.risk_engine import RiskEngine
from services.recurring_issue_service import RecurringIssueService
from services.ppe_constants import AI_PPE_COMPLIANCE_TYPES, AI_PPE_VIOLATION_TYPES
from services.ppe_analyzer import get_project_ppe_summary
from services.rag.retriever import SemanticRetriever
from services.query_understanding import analyze_query, QueryUnderstanding
from services.query_expansion import QueryExpansionService, ExpandedQueryPlan
from services.llm.client import LLMClient

logger = logging.getLogger(__name__)


def _sanitize_executive_summary(raw_summary: str, query: str, project_name: str, db: Session, project_id: int) -> str:
    """
    Cleans raw summary text to ensure NO internal metadata or raw tags leak into the executive view.
    If the summary is corrupted or contains internal tokens, produces a clean natural managerial answer.
    """
    if not raw_summary or not raw_summary.strip():
        return f"Operational overview for **{project_name}**: field activities are proceeding according to the work plan."

    # 1. Strip markdown header titles like '### 📦 ...'
    lines = [l for l in raw_summary.split("\n") if not l.startswith("### ") and not l.startswith("==")]
    
    # 2. Filter out raw evidence tags
    cleaned_lines = []
    for l in lines:
        stripped = l.strip()
        if stripped.startswith("PRIMARY EVIDENCE:") or stripped.startswith("- PRIMARY EVIDENCE:") or stripped.startswith("* PRIMARY EVIDENCE:"):
            continue
        if stripped.startswith("CORROBORATING / SUPPORTING EVIDENCE:") or stripped.startswith("- CORROBORATING"):
            continue
        if stripped.startswith("PROJECT:") or stripped.startswith("HIERARCHY:") or stripped.startswith("SOURCE TYPE:"):
            continue
        if re.search(r'\[(MATERIAL|INCIDENT|INSPECTION|OBSERVATION|DAILY_REPORT|AI_FINDING|PHOTO|PROJECT|SITE|AREA)\s*#\d+\]', stripped):
            continue
        # Strip issue / confidence tags if in line
        stripped = re.sub(r'\[ISSUE\s*\d+\]\s*', '', stripped)
        stripped = re.sub(r'\[EVIDENCE GROUP\s*\d+\]\s*', '', stripped)
        stripped = re.sub(r'\(Confidence:\s*[A-Za-z_]+\)', '', stripped)
        stripped = re.sub(r'TITLE:\s*', '', stripped)
        if stripped:
            cleaned_lines.append(stripped)

    sanitized = "\n".join(cleaned_lines).strip()
    
    # 3. If cleaning removed all lines (because raw output was pure metadata), generate natural manager response
    if not sanitized or len(sanitized) < 15 or any(re.search(p, sanitized, re.IGNORECASE) for p in LLMClient.METADATA_LEAK_PATTERNS):
        return LLMClient._synthesize_grounded_fallback(query=query, context=raw_summary, project_name=project_name)

    return sanitized


def build_structured_assistant_response(
    db: Session,
    project_id: int,
    query: str,
    raw_answer: str,
    data_used: List[str],
    project_name: str
) -> schemas.AssistantStructuredResponse:
    # 1. Expand query and analyze domain concepts (Phase 8.E.1)
    plan = QueryExpansionService.expand_query(db=db, project_id=project_id, query=query)
    intent = plan.primary_topic

    # 2. Retrieve Top Hybrid Evidence matches
    rag_matches = []
    try:
        retriever = SemanticRetriever(db)
        rag_matches = retriever.search(
            project_id=project_id,
            query=query,
            top_k=6,
            site_id=plan.matched_site_id,
            area_id=plan.matched_area_ids[0] if len(plan.matched_area_ids) == 1 else None,
            min_similarity=0.04,
            query_plan=plan
        )
    except Exception as e:
        logger.warning(f"Error in RAG search for structured payload: {e}")

    # Identify if RAG retrieved material blockers or delayed items
    rag_material_ids = [m["source_id"] for m in rag_matches if m["source_type"] == "MATERIAL"]
    rag_incident_ids = [m["source_id"] for m in rag_matches if m["source_type"] == "INCIDENT"]
    rag_observation_ids = [m["source_id"] for m in rag_matches if m["source_type"] == "OBSERVATION"]
    rag_report_ids = [m["source_id"] for m in rag_matches if m["source_type"] == "DAILY_REPORT"]

    # 3. Query Authoritative Risk Engine ONLY if query is about risk
    risk_score = 0
    risk_level = "LOW"
    clean_factors = []
    if plan.is_risk_query or intent == "SAFETY_RISK":
        risk_eval = RiskEngine.evaluate_risk(db=db, project_id=project_id, days=7)
        risk_score = int(risk_eval.get("score") if risk_eval.get("score") is not None else risk_eval.get("risk_score", 0))
        risk_level = str(risk_eval.get("level") or risk_eval.get("risk_level", "LOW")).upper()
        raw_factors = risk_eval.get("reasons", [])
        for f in raw_factors:
            clean_f = re.sub(r'#[\w_]+', '', f).strip(" -*•")
            if clean_f and clean_f != "--":
                clean_factors.append(clean_f)
        if not clean_factors:
            clean_factors = ["All site metrics within normal operating safety parameters."]

    # 4. Resolve team roles for action assignments
    team_members = db.query(models.ProjectMember).join(models.User).filter(models.ProjectMember.project_id == project_id).all()
    role_map = {}
    for pm in team_members:
        canonical_role = (pm.role or "").upper().replace(" ", "_").strip()
        if canonical_role not in role_map:
            role_map[canonical_role] = pm.user.name

    def get_assignee(role_key: str, default_title: str) -> str:
        name = role_map.get(role_key)
        return f"{default_title} ({name})" if name else default_title

    pm_assignee = get_assignee("PROJECT_MANAGER", "Project Manager")
    safety_assignee = get_assignee("SAFETY_OFFICER", "Safety Officer")
    procurement_assignee = get_assignee("PROCUREMENT_MANAGER", "Procurement Lead")

    # Sanitize executive summary to strictly prevent any internal ID/metadata leakage
    formatted_summary = _sanitize_executive_summary(
        raw_summary=raw_answer,
        query=query,
        project_name=project_name,
        db=db,
        project_id=project_id
    )

    # Build clean sources for dedicated Sources section ONLY
    structured_sources = []
    seen_sources = set()
    for m in rag_matches:
        st = m["source_type"]
        sid = m["source_id"]
        title = m["title"] or f"{st} #{sid}"
        clean_title = re.sub(r'#[A-Z0-9_]+', '', title).strip()
        meta = m.get("metadata", {})
        detail = f"Status: {meta.get('status')}" if meta.get("status") else f"Relevance: {round(m['similarity']*100)}%"
        source_key = f"{st}_{sid}"
        if source_key not in seen_sources:
            seen_sources.add(source_key)
            structured_sources.append(schemas.AssistantSource(type=st, id=source_key, title=clean_title, detail=detail))

    # =========================================================================
    # INTENT A: CONVERSATIONAL GREETING & OUT OF SCOPE
    # =========================================================================
    clean_q = re.sub(r'[^\w\s]', '', query.lower()).strip()
    if clean_q in ["hi", "hii", "hello", "hey", "greetings", "help", "who are you"]:
        return schemas.AssistantStructuredResponse(
            query_type="GREETING",
            executive_summary=f"Hello! I am your Construction Site Intelligence Assistant for **{project_name}**.\n\nI can help you monitor site safety, investigate incidents, track material supply blockers, evaluate risk, check PPE compliance, and analyze daily/weekly construction progress.",
            risk=None,
            attention_items=[],
            locations=[],
            recommended_actions=[],
            materials=[],
            progress=None,
            ppe=None,
            sources=[],
            explainability=_build_explainability("Conversational Greeting & Capabilities", 0, risk_score, risk_level),
            suggested_followups=["What is blocking the facade work?", "Summarize the problems reported this week", "Generate a weekly site progress report", "What is the project risk score?"]
        )

    if any(term in query.lower() for term in ["who is the president", "tell me a joke", "recipe for", "cricket"]):
        return schemas.AssistantStructuredResponse(
            query_type="OUT_OF_SCOPE",
            executive_summary=f"I am the Construction Site Intelligence Assistant dedicated to **{project_name}**.\n\nI can only assist with project-specific construction data such as material tracking, site blockers, daily reports, safety incidents, and risk assessments.",
            risk=None,
            attention_items=[],
            locations=[],
            recommended_actions=[],
            materials=[],
            progress=None,
            ppe=None,
            sources=[],
            explainability=_build_explainability("Domain Scope Enforcement", 0, risk_score, risk_level),
            suggested_followups=["What is blocking the facade work?", "Are any materials unavailable?", "What is the project risk score?"]
        )

    # =========================================================================
    # DYNAMIC EVIDENCE-DRIVEN RESPONSE BUILDING (Phase 8.2G)
    # =========================================================================
    # 1. Determine primary query_type for UI metadata/badge
    is_true_progress = (
        any(kw in query.lower() for kw in ["progress", "daily report", "today's report", "milestone velocity", "work completed today"]) and
        not any(kw in query.lower() for kw in ["biggest", "issue", "issues", "problem", "holding", "tower", "crane", "focus today", "what should"])
    )
    is_pure_incident_query = (
        (intent == "SAFETY_INCIDENTS" or 
        (plan.requirements and "INCIDENT" in plan.requirements.requested_source_types and "MATERIAL" not in plan.requirements.requested_source_types and not plan.is_risk_query))
        and not plan.is_ppe_query and intent != "PPE" and not plan.is_material_query and not any(k in query.lower() for k in ["facade", "material", "supplies", "stock", "cable", "tiles"])
    )

    if plan.is_risk_query or intent == "SAFETY_RISK":
        query_type = "SAFETY_RISK"
    elif plan.is_ppe_query or intent == "PPE":
        query_type = "PPE_COMPLIANCE"
    elif intent == "WEEKLY_PROGRESS_REPORT" or (plan.is_progress_query and "week" in query.lower()):
        query_type = "WEEKLY_PROGRESS_REPORT"
    elif is_true_progress or (intent == "DAILY_REPORT" and not plan.is_blocker_query and not any(kw in query.lower() for kw in ["stop", "stoppage", "stall", "halt", "delay", "block", "problem", "issue", "cladding", "facade", "outer", "exterior"])):
        query_type = "DAILY_PROGRESS"
    elif is_pure_incident_query:
        query_type = "SAFETY_ISSUES"
    elif intent == "MATERIALS" or (plan.is_material_query and not plan.is_blocker_query) or any(k in query.lower() for k in ["facade", "cladding", "material", "materials", "supplies", "stock", "delayed material"]):
        query_type = "MATERIALS"
    elif any(kw in query.lower() for kw in ["focus today", "focus on today", "should i do", "what should the project manager", "manager focus"]):
        query_type = "RECOMMENDED_ACTIONS"
    elif bool(plan.matched_area_ids) and not plan.is_material_query and not plan.is_blocker_query:
        query_type = "AREA_SAFETY"
    elif plan.is_blocker_query or any(kw in query.lower() for kw in ["issue", "issues", "holding back", "problem", "problems", "biggest"]):
        query_type = "ISSUES_SUMMARY"
    else:
        query_type = "GENERAL_PROJECT"

    # 2. Risk Card (populated only when user query actually asks about risk)
    risk_card = None
    if plan.is_risk_query or intent == "SAFETY_RISK" or any(w in query.lower() for w in ["risk score", "risk rating", "why is project risk high", "project risk"]):
        risk_card = schemas.AssistantRiskInfo(
            score=risk_score,
            level=risk_level,
            factors=clean_factors[:5],
            summary=f"Site risk is flagged at {risk_level} ({risk_score}/100) due to active field safety hazards and operational constraints."
        )

    # 3. Materials Card: populated whenever material blockers/supplies are relevant or retrieved
    material_items = []
    include_materials = (
        query_type in ["MATERIALS", "ISSUES_SUMMARY", "GENERAL_PROJECT"] or
        plan.is_material_query or plan.is_blocker_query or bool(rag_material_ids) or
        "materials" in data_used or any(w in query.lower() for w in ["material", "materials", "facade", "cladding", "supplies", "stock", "delayed", "unavailable", "shortage", "resource", "resources", "exterior", "outer"])
    )
    if include_materials and not is_pure_incident_query and query_type not in ["PPE_COMPLIANCE", "DAILY_PROGRESS", "WEEKLY_PROGRESS_REPORT"]:
        mat_query = db.query(models.Material).filter(models.Material.project_id == project_id)
        if rag_material_ids:
            matched_mats = db.query(models.Material).filter(models.Material.project_id == project_id, models.Material.id.in_(rag_material_ids)).all()
            other_mats = db.query(models.Material).filter(models.Material.project_id == project_id, ~models.Material.id.in_(rag_material_ids)).all()
            materials_records = matched_mats + other_mats
        else:
            materials_records = mat_query.all()

        for m in materials_records:
            is_delayed_or_problem = m.status in ["DELAYED", "OUT_OF_STOCK", "LOW_STOCK"]
            is_name_match = any(w in m.material_name.lower() for w in plan.entities if len(w) > 2)
            is_rag_match = m.id in rag_material_ids
            is_facade_match = "facade" in m.material_name.lower() and any(w in query.lower() for w in ["facade", "cladding", "exterior", "outer", "install"])

            if is_rag_match or is_name_match or is_facade_match or (is_delayed_or_problem and any(kw in query.lower() for kw in ["material", "materials", "supplies", "stock", "delayed", "unavailable", "shortage", "resource", "resources", "problem", "issue", "affecting", "blocking", "holding", "facade", "cladding", "exterior"])):
                material_items.append(
                    schemas.AssistantMaterialItem(
                        name=m.material_name,
                        status=m.status,
                        quantity=m.quantity,
                        unit=m.unit,
                        category=m.category,
                        supplier=m.supplier,
                        notes=m.notes or f"Stored at site location"
                    )
                )

    # 4. Attention Items: populated from open incidents / observations / risk factors
    attention_items = []
    if query_type == "SAFETY_RISK":
        attention_items = [
            schemas.AssistantAttentionItem(
                title=f,
                description=f"Contributing risk factor to overall score ({risk_score}/100)",
                severity="HIGH" if risk_score > 60 else "MEDIUM",
                status="OPEN"
            ) for f in clean_factors[:4]
        ]
    elif query_type not in ["MATERIALS", "DAILY_PROGRESS", "WEEKLY_PROGRESS_REPORT", "PPE_COMPLIANCE"]:
        open_incidents = db.query(models.SafetyIncident).filter(
            models.SafetyIncident.project_id == project_id,
            models.SafetyIncident.status != "RESOLVED"
        ).order_by(models.SafetyIncident.id.asc()).all()
        for inc in open_incidents:
            attention_items.append(
                schemas.AssistantAttentionItem(
                    title=f"Incident #{inc.id}: {inc.incident_type} ({inc.severity})",
                    description=inc.description,
                    severity=inc.severity if inc.severity in ["LOW", "MEDIUM", "HIGH", "CRITICAL"] else "HIGH",
                    status=inc.status,
                    site_name=inc.site.name if inc.site else None,
                    area_name=inc.area.name if inc.area else None
                )
            )

    # 5. Progress Card: populated for progress queries
    progress_card = None
    if query_type in ["DAILY_PROGRESS", "WEEKLY_PROGRESS_REPORT"] or plan.is_progress_query:
        if "week" in query.lower() or query_type == "WEEKLY_PROGRESS_REPORT":
            reps = db.query(models.DailyReport).filter(
                models.DailyReport.project_id == project_id
            ).order_by(models.DailyReport.report_date.desc()).limit(7).all()
            avg_progress = reps[0].progress_percentage if reps and reps[0].progress_percentage else 0
            total_workers = int(sum(r.workers_count or 0 for r in reps) / max(1, len(reps))) if reps else 0
            all_blockers = [r.blockers for r in reps if r.blockers and r.blockers.lower() != "none"]
            blocker_summary = "; ".join(set(all_blockers)) if all_blockers else "No critical multi-day blockers"
            progress_card = schemas.AssistantProgressInfo(
                report_type="WEEKLY",
                reporting_period=f"{reps[-1].report_date} to {reps[0].report_date}" if len(reps) > 1 else (reps[0].report_date if reps else "Current Week"),
                progress_pct=avg_progress,
                workers_count=total_workers,
                blockers=blocker_summary,
                days_logged=len(reps)
            )
        else:
            today_rep = db.query(models.DailyReport).filter(
                models.DailyReport.project_id == project_id
            ).order_by(models.DailyReport.report_date.desc()).first()
            if today_rep:
                progress_card = schemas.AssistantProgressInfo(
                    report_type="DAILY",
                    reporting_period=today_rep.report_date,
                    progress_pct=today_rep.progress_percentage or 0,
                    workers_count=today_rep.workers_count or 0,
                    work_completed=today_rep.work_completed or "Normal scheduled progress",
                    work_planned=today_rep.work_planned or "Standard operations",
                    blockers=today_rep.blockers or "None reported",
                    weather=today_rep.weather or "Clear"
                )

    # 6. PPE Card: populated for PPE queries
    ppe_card = None
    if query_type == "PPE_COMPLIANCE" or plan.is_ppe_query:
        ppe_summary = get_project_ppe_summary(db=db, project_id=project_id)
        compliance_pct = float(ppe_summary.get("overall_compliance", 100.0))
        violations_cnt = int(ppe_summary.get("workers_with_violations", 0))
        total_workers = int(ppe_summary.get("workers_detected", 0))
        viols_list = ppe_summary.get("violations_list", [])
        comps_list = ppe_summary.get("compliance_list", [])
        ppe_card = schemas.AssistantPPEInfo(
            total_workers=total_workers,
            compliance_pct=compliance_pct,
            violations_count=violations_cnt,
            insight_summary=", ".join(viols_list[:2]) if viols_list else "None",
            violations_list=viols_list[:4],
            compliance_items=comps_list[:4]
        )

    # 7. Recommended Actions: dynamic multi-domain actions
    actions = []
    if query_type == "SAFETY_RISK" and risk_level in ["HIGH", "CRITICAL"]:
        actions.append(schemas.AssistantActionItem(
            title="Convene emergency site safety review",
            description="Halt unpermitted high-risk operations and review site incident trends.",
            priority="HIGH",
            role=pm_assignee
        ))
        actions.append(schemas.AssistantActionItem(
            title="Audit flagged active zones",
            description="Conduct targeted audits in active zones and re-inspect failed areas.",
            priority="HIGH",
            role=safety_assignee
        ))
    if ppe_card and ppe_card.violations_count > 0:
        actions.append(schemas.AssistantActionItem(
            title="Enforce mandatory PPE protocols",
            description=f"Address observed site violations: {ppe_card.insight_summary}.",
            priority="HIGH",
            role=safety_assignee
        ))
    for m in material_items:
        if m.status in ["DELAYED", "OUT_OF_STOCK"] and len(actions) < 3:
            actions.append(schemas.AssistantActionItem(
                title=f"Expedite delivery of {m.name}",
                description=f"Material is {m.status}. Contact supplier {m.supplier or 'vendor'} to accelerate shipment.",
                priority="HIGH",
                role=procurement_assignee
            ))
    for inc in attention_items:
        if inc.severity in ["HIGH", "CRITICAL"] and len(actions) < 3:
            actions.append(schemas.AssistantActionItem(
                title=f"Address {inc.title}",
                description=f"Implement corrective controls at {inc.area_name or 'site zone'}.",
                priority="HIGH",
                role=safety_assignee
            ))
    if progress_card and progress_card.blockers and progress_card.blockers.lower() != "none" and len(actions) < 3:
        actions.append(schemas.AssistantActionItem(
            title="Resolve daily site blocker",
            description=f"Blocker logged: {progress_card.blockers}",
            priority="HIGH",
            role=pm_assignee
        ))

    # Fallback generic actions if needed
    if not actions:
        if attention_items:
            actions.append(schemas.AssistantActionItem(
                title="Review active site items",
                description="Conduct field walk to verify ongoing safety and quality controls.",
                priority="MEDIUM",
                role=pm_assignee
            ))
        else:
            actions.append(schemas.AssistantActionItem(
                title="Maintain daily site monitoring",
                description="Continue tracking scheduled construction milestones.",
                priority="LOW",
                role=pm_assignee
            ))

    pipeline_title = "Hybrid Construction RAG"
    if query_type == "SAFETY_RISK":
        pipeline_title = "Risk Engine Evaluation"
    elif query_type == "MATERIALS":
        pipeline_title = "Material Supply & Inventory RAG"
    elif query_type == "SAFETY_ISSUES":
        pipeline_title = "Authoritative Safety Incidents"
    elif query_type == "DAILY_PROGRESS":
        pipeline_title = "Daily Progress Report"
    elif query_type == "WEEKLY_PROGRESS_REPORT":
        pipeline_title = "Consolidated Weekly Site Progress Report"
    elif query_type == "PPE_COMPLIANCE":
        pipeline_title = "AI PPE Vision Compliance"

    return schemas.AssistantStructuredResponse(
        query_type=query_type,
        executive_summary=formatted_summary,
        risk=risk_card,
        attention_items=attention_items,
        locations=_extract_locations(db, project_id),
        recommended_actions=actions[:3],
        materials=material_items,
        progress=progress_card,
        ppe=ppe_card,
        sources=structured_sources,
        explainability=_build_explainability(pipeline_title, len(structured_sources), risk_score, risk_level),
        suggested_followups=["What is blocking the facade work?", "Summarize the problems reported this week", "What is the project risk score?"]
    )


def _build_explainability(pipeline_desc: str, sources_count: int, risk_score: int, risk_level: str) -> schemas.AssistantExplainability:
    return schemas.AssistantExplainability(
        retrieval_mode="HYBRID_RAG",
        semantic_chunks_count=sources_count,
        risk_engine_score=risk_score,
        risk_engine_level=risk_level,
        llm_model="Gemini 2.5 Flash",
        pipeline_steps=[
            schemas.AssistantPipelineStep(name="Query Expansion", description="Semantic expansion across construction ontology", icon="Search"),
            schemas.AssistantPipelineStep(name="Hybrid Retrieval", description="pgvector dense + lexical multi-query search", icon="Database"),
            schemas.AssistantPipelineStep(name="Evidence Grouping", description="Multi-source corroboration and ranking", icon="CheckCircle")
        ]
    )


def _extract_locations(db: Session, project_id: int) -> List[schemas.AssistantLocationItem]:
    areas = db.query(models.Area).join(models.Site).filter(models.Site.project_id == project_id).all()
    return [schemas.AssistantLocationItem(area_name=a.name, site_name=a.site.name if a.site else None) for a in areas[:4]]
