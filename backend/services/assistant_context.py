"""
Hybrid RAG Context Retrieval Service for GenAI Construction Project Assistant.
Combines:
1. Deterministic Intent Classification
2. Authoritative Risk Engine Assessment (Multi-factor score, level, confidence, reasons)
3. Authoritative SQL Aggregations (Exact facts filtered by query intent)
4. Semantic Vector Evidence (pgvector similarity search matching query intent)
5. Clean, Verified Source Traceability
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
from services.rag.retriever import SemanticRetriever

logger = logging.getLogger(__name__)


def classify_user_intent(query: str) -> str:
    """
    Deterministic intent classifier prioritizing specific domains over generic ones.
    Returns one of:
    - MATERIALS
    - SAFETY_INCIDENTS
    - RECOMMENDED_ACTIONS
    - PPE
    - PROGRESS
    - AREA
    - INSPECTIONS
    - OBSERVATIONS
    - RISK
    - GENERAL_PROJECT
    """
    q = query.lower().strip()

    def has_any(keywords: List[str]) -> bool:
        for kw in keywords:
            if " " in kw:
                if kw in q:
                    return True
            else:
                if re.search(r'\b' + re.escape(kw) + r'\b', q):
                    return True
        return False

    # 0. Greetings & Capabilities
    clean_q = re.sub(r'[^\w\s]', '', q).strip()
    if clean_q in [
        "hi", "hii", "hiii", "hello", "hey", "heyy", "greetings", "howdy",
        "good morning", "good afternoon", "good evening", "what can you do",
        "who are you", "help", "start", "welcome"
    ] or (len(clean_q.split()) <= 2 and any(clean_q == g for g in ["hi", "hii", "hello", "hey", "heyy", "howdy"])):
        return "GREETING"

    # 0.1 Out-of-Scope Detection (queries about non-construction topics)
    if has_any([
        "pm of", "prime minister", "president of", "capital of", "who is the prime",
        "who is the president", "who is pm", "weather in tokyo", "weather in london",
        "weather in new york", "weather in delhi", "weather in paris",
        "tell me a joke", "write a poem", "write code for", "recipe for",
        "cricket", "football", "celebrity", "movie", "song", "lyrics",
        "meaning of life", "who won the match", "stock market"
    ]):
        return "OUT_OF_SCOPE"

    # 1. Recommended Actions & Role Assignments (Explicit Manager Instructions)
    if has_any([
        "what are the recommended actions", "recommended action", "recommended actions",
        "what should we do", "recommendation", "recommendations", "next step", "next steps",
        "what to do", "mitigation", "mitigations", "corrective action", "corrective actions",
        "who should be assigned", "who should be assign", "who to assign", "assign action", "assign actions",
        "assign", "assigned", "assignment", "assignments", "who is assigned", "who is responsible",
        "who should handle", "responsibility", "responsible person", "responsible party", "assignee",
        "assignees", "who should do", "who takes care of", "action owner", "action owners",
        "task assignment", "role assignment", "assigned to these actions", "assign these actions", "who should"
    ]):
        return "RECOMMENDED_ACTIONS"

    # 2. Safety Incidents & Accidents
    if has_any([
        "incident", "incidents", "accident", "accidents", "unresolved incident",
        "open incident", "safety incident", "safety incidents", "safety issue", "safety issues",
        "near miss", "injury", "hazard", "unsafe condition"
    ]):
        return "SAFETY_INCIDENTS"

    # 3. PPE & Computer Vision
    if has_any([
        "ppe", "helmet", "hard hat", "gloves", "boots", "goggles", "vest",
        "protective equipment", "safety gear", "ppe violation", "ppe compliance"
    ]):
        return "PPE"

    # 4. Inspections & Audits
    if has_any([
        "inspection", "inspections", "failed inspection", "audit", "safety audit",
        "quality audit", "checklist", "inspector"
    ]):
        return "INSPECTIONS"

    # 5. Observations & Hazards
    if has_any([
        "observation", "observations", "snag", "defect", "site observation", "hazard note"
    ]):
        return "OBSERVATIONS"

    # 6. Materials & Supply Chain
    if has_any([
        "material", "materials", "shortage", "shortages", "stock", "supply",
        "supplier", "delivery", "delayed material", "blocking work", "rebar",
        "concrete", "cement", "steel", "aggregate", "inventory"
    ]):
        return "MATERIALS"

    # 8. Area & Spatial Intelligence
    if has_any([
        "which area", "what area", "area needs", "zone needs", "worst area",
        "area ranking", "affected area", "affected areas", "high risk area", "building block"
    ]):
        return "AREA"

    # 9. Risk & Analytics
    if has_any([
        "why is the project risk", "why is project risk", "risk score", "risk level",
        "why risk", "high risk", "medium risk", "critical risk", "what is the project risk",
        "what is the risk", "risk factors", "explain risk", "how is risk", "risk assessment",
        "safety risk", "major risk", "major risks", "top safety risks"
    ]):
        return "RISK"

    # 10. General Project Overview
    return "GENERAL_PROJECT"


def _parse_time_intent(query: str) -> Optional[Tuple[datetime, Optional[datetime]]]:
    """Extracts explicit time ranges from query strings."""
    q = query.lower()
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)

    if "today" in q:
        return (today_start, None)
    if "yesterday" in q:
        yesterday_start = today_start - timedelta(days=1)
        return (yesterday_start, today_start)
    if "this week" in q or "past week" in q or "last 7 days" in q:
        return (today_start - timedelta(days=7), None)
    if "last week" in q:
        return (today_start - timedelta(days=14), today_start - timedelta(days=7))
    if "two weeks" in q or "last 2 weeks" in q or "past 2 weeks" in q or "14 days" in q:
        return (today_start - timedelta(days=14), None)
    if "this month" in q or "last 30 days" in q:
        return (today_start - timedelta(days=30), None)
    return None


def retrieve_assistant_context(
    db: Session,
    project_id: int,
    query: str
) -> Tuple[str, List[schemas.AssistantSource], List[str], str]:
    """
    Builds a grounded Hybrid RAG prompt context combining exact SQL metrics,
    authoritative Risk Engine scoring, and intent-targeted pgvector semantic retrieval.
    Strictly isolated by project_id.
    """
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        return "", [], [], ""

    project_name = project.name
    query_lower = query.lower()
    intent = classify_user_intent(query_lower)
    time_filter = _parse_time_intent(query_lower)

    # 1. Resolve site and area entity mentions in query for scoped retrieval
    sites = db.query(models.Site).filter(models.Site.project_id == project_id).all()
    matched_site_id = None
    for s in sites:
        if s.name.lower() in query_lower:
            matched_site_id = s.id
            break

    areas = db.query(models.Area).join(models.Site).filter(models.Site.project_id == project_id).all()
    matched_area_ids = []
    for area in areas:
        if area.name.lower() in query_lower:
            matched_area_ids.append(area.id)

    matched_area_id = matched_area_ids[0] if len(matched_area_ids) == 1 else None

    sources: List[schemas.AssistantSource] = []
    data_used: List[str] = []
    seen_source_keys = set()

    def add_source(st: str, sid: str, title: str, detail: Optional[str] = None):
        key = f"{st}_{sid}"
        if key not in seen_source_keys:
            seen_source_keys.add(key)
            sources.append(schemas.AssistantSource(type=st, id=key, title=title, detail=detail))

    # 2. Authoritative Risk Engine Assessment (Deterministic Baseline)
    risk_eval: Dict[str, Any] = {}
    try:
        risk_eval = RiskEngine.evaluate_risk(
            db=db,
            project_id=project_id,
            site_id=matched_site_id,
            area_id=matched_area_id,
            days=7
        )
        r_score = risk_eval.get("score") if risk_eval.get("score") is not None else risk_eval.get("risk_score", 0)
        r_level = risk_eval.get("level") or risk_eval.get("risk_level", "LOW")

        # Only add risk to sources if query is RISK, RECOMMENDED_ACTIONS, or GENERAL_PROJECT
        if intent in ["RISK", "RECOMMENDED_ACTIONS", "GENERAL_PROJECT", "AREA"]:
            add_source(
                st="RISK",
                sid="risk_engine",
                title=f"Risk Engine: Score {r_score}/100 ({r_level})",
                detail="Authoritative multi-factor risk assessment"
            )
            data_used.append("risk_engine")
    except Exception as e:
        logger.warning(f"Error evaluating risk in assistant_context: {e}")

    # 3. Intent-Specific Semantic Vector RAG Retrieval
    source_type_filters = None
    if intent == "MATERIALS":
        source_type_filters = ["MATERIAL"]
    elif intent in ["SAFETY_INCIDENTS", "RECOMMENDED_ACTIONS"]:
        source_type_filters = ["INCIDENT", "INSPECTION"]
    elif intent == "INSPECTIONS":
        source_type_filters = ["INSPECTION"]
    elif intent == "OBSERVATIONS":
        source_type_filters = ["OBSERVATION"]
    elif intent == "PROGRESS":
        source_type_filters = ["DAILY_REPORT"]
    elif intent == "PPE":
        source_type_filters = ["PHOTO", "AI_FINDING", "INCIDENT"]
    elif intent == "AREA":
        source_type_filters = ["AREA", "INCIDENT", "INSPECTION"]

    semantic_matches = []
    try:
        semantic_matches = SemanticRetriever.search(
            db=db,
            project_id=project_id,
            query=query,
            top_k=5,
            site_id=matched_site_id,
            area_id=matched_area_id,
            source_types=source_type_filters,
            min_similarity=0.08
        )
        if semantic_matches:
            data_used.append("semantic_rag")
            for m in semantic_matches:
                st = m["source_type"]
                sid = m["source_id"]
                title = m["title"] or f"{st} #{sid}"
                # Clean up title
                add_source(st=st, sid=str(sid), title=title, detail=f"Semantic evidence match")
    except Exception:
        pass

    # 4. Intent-Targeted SQL Data Retrieval
    context_sections = []

    # Include project baseline metadata
    risk_score = risk_eval.get("score") if risk_eval.get("score") is not None else risk_eval.get("risk_score", 0)
    risk_level = risk_eval.get("level") or risk_eval.get("risk_level", "LOW")
    risk_reasons = risk_eval.get("reasons", ["No elevated risk factors detected."])

    open_incidents_count = db.query(func.count(models.SafetyIncident.id)).filter(
        models.SafetyIncident.project_id == project_id,
        models.SafetyIncident.status.in_(["OPEN", "UNDER_REVIEW"])
    ).scalar() or 0

    context_sections.append(
        f"PROJECT METADATA & AUTHORITATIVE RISK ENGINE:\n"
        f"- Project Name: {project.name}\n"
        f"- Project Status: {project.status}\n"
        f"- Authoritative Risk Score: {risk_score}/100 ({risk_level})\n"
        f"- Data Confidence: {risk_eval.get('data_confidence', 'HIGH')}\n"
        f"- Contributing Risk Factors:\n" + "\n".join([f"  * {r}" for r in risk_reasons])
    )

    context_sections.append(
        f"EXACT FACTS & RECORD COUNTS (SQL):\n"
        f"- Unresolved Safety Incidents: {open_incidents_count}"
    )

    # A. MATERIALS QUERY
    if intent == "MATERIALS":
        mat_q = db.query(models.Material).filter(models.Material.project_id == project_id)
        mat_records = mat_q.order_by(models.Material.id.desc()).limit(10).all()
        mat_bullets = []
        for m in mat_records:
            mat_bullets.append(
                f"- Material #{m.id}: {m.material_name} ({m.category or 'General'}) - Qty: {m.quantity} {m.unit} (Status: {m.status}). Supplier: {m.supplier or 'N/A'}. Notes: {m.notes or 'None'}"
            )
            add_source("MATERIAL", str(m.id), f"Material: {m.material_name}", f"Status: {m.status} ({m.quantity} {m.unit})")
            data_used.append("materials")

        if mat_bullets:
            context_sections.append("MATERIALS & INVENTORY DETAIL (SQL):\n" + "\n".join(mat_bullets))
        else:
            context_sections.append("MATERIALS & INVENTORY DETAIL (SQL):\n- No material records or shortages found in project database.")

    # B. SAFETY INCIDENTS / RISK QUERY
    elif intent in ["SAFETY_INCIDENTS", "RISK", "RECOMMENDED_ACTIONS"]:
        inc_q = db.query(models.SafetyIncident).filter(models.SafetyIncident.project_id == project_id)
        if matched_area_ids:
            inc_q = inc_q.filter(models.SafetyIncident.area_id.in_(matched_area_ids))
        inc_records = inc_q.order_by(models.SafetyIncident.id.desc()).limit(8).all()
        inc_bullets = []
        for inc in inc_records:
            site_n = inc.site.name if inc.site else "Site"
            area_n = inc.area.name if inc.area else "Overall"
            inc_bullets.append(
                f"- Incident #{inc.id} ({inc.severity} {inc.incident_type}, Status: {inc.status}) on {inc.incident_date} at {site_n} -> {area_n}: {inc.description} (Action: {inc.action_taken or 'None'})"
            )
            add_source("INCIDENT", str(inc.id), f"Safety Incident #{inc.id}: {inc.incident_type}", f"{inc.severity} · {inc.status}")
            data_used.append("safety_incidents")

        if inc_bullets:
            context_sections.append("SAFETY INCIDENTS DETAIL (SQL):\n" + "\n".join(inc_bullets))
        else:
            context_sections.append("SAFETY INCIDENTS DETAIL (SQL):\n- No unresolved safety incidents recorded.")

        # Also load failed inspections if risk or actions
        if intent in ["RISK", "RECOMMENDED_ACTIONS"]:
            insp_q = db.query(models.InspectionReport).filter(
                models.InspectionReport.project_id == project_id,
                models.InspectionReport.status == "FAILED"
            ).order_by(models.InspectionReport.id.desc()).limit(5).all()
            insp_bullets = []
            for insp in insp_q:
                area_n = insp.area.name if insp.area else "Overall"
                insp_bullets.append(
                    f"- Failed Inspection #{insp.id} ({insp.inspection_type}) in {area_n}: Findings: {insp.findings or 'None'}. Recommendations: {insp.recommendations or 'None'}."
                )
                add_source("INSPECTION", str(insp.id), f"Inspection #{insp.id}: {insp.inspection_type}", f"Status: {insp.status}")
                data_used.append("inspections")
            if insp_bullets:
                context_sections.append("FAILED INSPECTIONS (SQL):\n" + "\n".join(insp_bullets))

        # Also load project members and roles for action assignments
        if intent == "RECOMMENDED_ACTIONS":
            team_members = db.query(models.ProjectMember).join(models.User).filter(models.ProjectMember.project_id == project_id).all()
            if team_members:
                team_lines = [f"- {pm.user.name} ({pm.role.replace('_', ' ').title()})" for pm in team_members]
                context_sections.append("PROJECT TEAM MEMBERS & ROLES (SQL):\n" + "\n".join(team_lines))

    # C. INSPECTIONS QUERY
    elif intent == "INSPECTIONS":
        insp_q = db.query(models.InspectionReport).filter(models.InspectionReport.project_id == project_id)
        if matched_area_ids:
            insp_q = insp_q.filter(models.InspectionReport.area_id.in_(matched_area_ids))
        insp_records = insp_q.order_by(models.InspectionReport.id.desc()).limit(8).all()
        insp_bullets = []
        for insp in insp_records:
            area_n = insp.area.name if insp.area else "Overall"
            insp_bullets.append(
                f"- Inspection #{insp.id} ({insp.inspection_type}, Status: {insp.status}) on {insp.inspection_date} in {area_n}: Findings: {insp.findings or 'None'}. Recommendations: {insp.recommendations or 'None'}."
            )
            add_source("INSPECTION", str(insp.id), f"Inspection #{insp.id}: {insp.inspection_type}", f"Status: {insp.status}")
            data_used.append("inspections")
        if insp_bullets:
            context_sections.append("INSPECTION REPORTS DETAIL (SQL):\n" + "\n".join(insp_bullets))
        else:
            context_sections.append("INSPECTION REPORTS DETAIL (SQL):\n- No inspection reports found.")

    # D. OBSERVATIONS QUERY
    elif intent == "OBSERVATIONS":
        obs_q = db.query(models.Observation).filter(models.Observation.project_id == project_id)
        if matched_area_ids:
            obs_q = obs_q.filter(models.Observation.area_id.in_(matched_area_ids))
        obs_records = obs_q.order_by(models.Observation.id.desc()).limit(8).all()
        obs_bullets = []
        for obs in obs_records:
            area_n = obs.area.name if obs.area else "Overall"
            obs_bullets.append(
                f"- Observation #{obs.id} [{obs.priority}] '{obs.title}' ({obs.observation_type}, Status: {obs.status}) in {area_n}: {obs.description}"
            )
            add_source("OBSERVATION", str(obs.id), f"Observation #{obs.id}: {obs.title}", f"{obs.priority} · {obs.status}")
            data_used.append("observations")
        if obs_bullets:
            context_sections.append("SITE OBSERVATIONS DETAIL (SQL):\n" + "\n".join(obs_bullets))
        else:
            context_sections.append("SITE OBSERVATIONS DETAIL (SQL):\n- No open observations found.")

    # E. PROGRESS QUERY
    elif intent == "PROGRESS":
        rep_q = db.query(models.DailyReport).filter(models.DailyReport.project_id == project_id)
        rep_records = rep_q.order_by(models.DailyReport.report_date.desc()).limit(5).all()
        rep_bullets = []
        for r in rep_records:
            rep_bullets.append(
                f"- Daily Report #{r.id} ({r.report_date}): Completed: {r.work_completed or 'N/A'}, Workforce: {r.workers_count or 0} workers, Weather: {r.weather or 'Clear'}, Blockers: {r.blockers or 'None'}, Notes: {r.notes or 'None'}"
            )
            add_source("DAILY_REPORT", str(r.id), f"Daily Report ({r.report_date})", f"{r.workers_count or 0} workers · Progress {r.progress_percentage or 0}%")
            data_used.append("daily_reports")
        if rep_bullets:
            context_sections.append("DAILY PROGRESS & WORKFORCE DETAIL (SQL):\n" + "\n".join(rep_bullets))
        else:
            context_sections.append("DAILY PROGRESS & WORKFORCE DETAIL (SQL):\n- No daily report logs recorded.")

    # F. PPE QUERY
    elif intent == "PPE":
        ai_violations_count = db.query(func.count(models.AISafetyFinding.id)).filter(
            models.AISafetyFinding.project_id == project_id,
            models.AISafetyFinding.finding_type.in_(AI_PPE_VIOLATION_TYPES),
            models.AISafetyFinding.status != "FALSE_POSITIVE"
        ).scalar() or 0

        ai_compliance_count = db.query(func.count(models.AISafetyFinding.id)).filter(
            models.AISafetyFinding.project_id == project_id,
            models.AISafetyFinding.finding_type.in_(AI_PPE_COMPLIANCE_TYPES)
        ).scalar() or 0

        context_sections.append(
            f"PPE COMPUTER VISION METRICS (SQL):\n"
            f"- PPE Compliance Findings: {ai_compliance_count} verified detections (Helmets, Vests, Boots, Goggles, Gloves)\n"
            f"- PPE Violations: {ai_violations_count} non-compliance findings (Person without helmet / vest)"
        )
        add_source("PPE", "ppe_vision", "AI PPE Vision Detection", f"Compliance: {ai_compliance_count} · Violations: {ai_violations_count}")
        data_used.append("ppe_vision")

    # G. AREA QUERY / GENERAL PROJECT
    else:
        # Load summary of all domains
        open_incidents_count = db.query(func.count(models.SafetyIncident.id)).filter(
            models.SafetyIncident.project_id == project_id,
            models.SafetyIncident.status.in_(["OPEN", "UNDER_REVIEW"])
        ).scalar() or 0

        context_sections.append(
            f"EXACT FACTS & RECORD COUNTS (SQL):\n"
            f"- Unresolved Safety Incidents: {open_incidents_count}"
        )

        area_rankings = []
        try:
            area_rankings = RiskEngine.get_area_risk_rankings(db=db, project_id=project_id, days=7)
        except Exception:
            pass

        if area_rankings:
            rank_str = "\n".join([f"  * Rank {idx+1}: {r.get('area_name')} (Risk Score: {r.get('risk_score')}, Level: {r.get('risk_level')})" for idx, r in enumerate(area_rankings[:5])])
            context_sections.append(f"AREA SAFETY RANKING:\n{rank_str}")
            for r in area_rankings[:3]:
                if r.get("area_name"):
                    add_source("AREA", str(r.get("area_name")), f"Area: {r.get('area_name')}", f"Risk: {r.get('risk_score')}/100")

    # Include Semantic Evidence if relevant matches exist
    if semantic_matches:
        rag_lines = [f"  * [{m['source_type']}] {m['content']}" for m in semantic_matches]
        context_sections.append(
            f"RELEVANT SEMANTIC EVIDENCE (RAG VECTOR SEARCH):\n" + "\n".join(rag_lines)
        )

    final_context = "\n\n".join(context_sections)
    return final_context, sources, list(set(data_used)), project_name
