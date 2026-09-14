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
from services.ppe_analyzer import get_project_ppe_summary
from services.rag.retriever import SemanticRetriever

logger = logging.getLogger(__name__)


def classify_user_intent(query: str) -> str:
    """
    Deterministic intent classifier prioritizing specific domains and reports over generic ones.
    Returns one of:
    - DAILY_REPORT
    - WEEKLY_PROGRESS_REPORT
    - RECURRING_ISSUES
    - ISSUES_SUMMARY
    - AREA_SAFETY
    - SAFETY_RISK
    - SAFETY_INCIDENTS
    - RECOMMENDED_ACTIONS
    - PPE
    - INSPECTIONS
    - OBSERVATIONS
    - MATERIALS
    - GREETING
    - OUT_OF_SCOPE
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

    # 1. DAILY REPORT QUERIES
    # Explicit phrases & semantic pattern: (today / daily) + (report / progress / activity / work / update / what happened / shift / site)
    is_daily = has_any([
        "generate today's report", "generate the today report", "generate todays report",
        "generate today report", "generate a daily report", "generate daily report",
        "create today's daily report", "create todays daily report", "create today daily report",
        "today's site report", "todays site report", "today site report",
        "today's report", "todays report", "today report", "daily site report", "daily report",
        "today's site progress", "todays site progress", "today site progress",
        "show today's progress", "show todays progress", "show today progress",
        "today's progress", "todays progress", "today progress", "daily progress",
        "what happened today", "today's activity", "todays activity", "today activity",
        "today's activities", "todays activities", "today activities",
        "today's work", "todays work", "work completed today", "give me daily report",
        "give me a daily report", "give me today's report", "give me todays report", "give me today report"
    ]) or bool(
        re.search(r'\b(today|todays|today\'s|daily)\b', q) and
        re.search(r'\b(report|reports|progress|activity|activities|work|update|summary|status|what happened|shift)\b', q)
    )
    if is_daily:
        return "DAILY_REPORT"

    # 2. WEEKLY PROGRESS REPORT QUERIES
    # Explicit phrases & semantic pattern: (weekly / this week / past week / 7 days) + (report / progress / summary / update / construction / site / what happened)
    has_issue_specific_keyword = bool(re.search(r'\b(problem|problems|recurring|repeated)\b', q))
    has_explicit_report_progress = bool(re.search(r'\b(progress|milestone|milestones|work completed|site report|weekly report|weekly progress|daily report)\b', q))

    is_weekly = has_any([
        "generate a weekly site progress report", "generate weekly site progress report",
        "generate a weekly progress report", "generate weekly progress report",
        "generate weekly report", "generate a weekly report", "generate a weekly site report", "generate weekly site report",
        "weekly site progress report", "weekly progress report", "weekly site report", "weekly project report",
        "weekly report", "weekly reports", "weekly progress", "weekly summary",
        "give me weekly report", "give me a weekly report", "give me weekly progress", "give me a weekly progress report",
        "give me this week's report", "give me this weeks report", "give me this week report",
        "give me this week's site progress", "give me this weeks site progress",
        "show me this week's report", "show me this weeks report", "show this week's report", "show this weeks report",
        "show this week's progress", "show this weeks progress", "show weekly progress", "show weekly report",
        "summarize this week's construction progress", "summarize this weeks construction progress",
        "summarize this week's progress", "summarize this weeks progress",
        "summarize weekly progress", "summarize weekly construction progress",
        "create the weekly project report", "create weekly project report",
        "this week's progress", "this weeks progress", "this week progress",
        "this week's report", "this weeks report", "this week report",
        "week's construction progress", "weeks construction progress",
        "what happened this week in the project", "what happened this week",
        "overall progress", "project progress", "construction progress",
        "progress report", "progress update", "site progress report"
    ]) or (
        bool(
            re.search(r'\b(weekly|this\s+week|this\s+week\'s|this\s+weeks|past\s+week|last\s+7\s+days|7-day|7\s+days)\b', q) and
            (
                re.search(r'\b(report|reports|progress|summary|update|activity|activities|work|milestone|milestones|status|construction|site|project|what happened)\b', q) or
                len(q.split()) <= 4
            )
        ) and (not has_issue_specific_keyword or has_explicit_report_progress)
    )
    if is_weekly:
        return "WEEKLY_PROGRESS_REPORT"

    # 3. RECURRING ISSUES
    if has_any([
        "which issues have occurred repeatedly", "which problems have occurred repeatedly",
        "what are the recurring problems", "what are the recurring issues",
        "recurring problem", "recurring problems", "recurring issue", "recurring issues",
        "recurring hazard", "recurring hazards", "occurred repeatedly", "happened repeatedly",
        "repeated issues", "repeated problems", "frequent issues", "frequent problems"
    ]):
        return "RECURRING_ISSUES"

    # 4. ISSUES SUMMARY / PROBLEMS THIS WEEK
    if has_any([
        "summarize the problems reported this week", "summarize problems reported this week",
        "show issues from this week", "show problems from this week",
        "problems reported this week", "issues reported this week",
        "problems this week", "issues this week", "summary of problems",
        "summary of issues", "list of problems", "site issues summary"
    ]):
        return "ISSUES_SUMMARY"

    # 5. AREA SAFETY & ZONE ISSUES
    if has_any([
        "what safety issues were found in", "show safety issues in", "safety issues in",
        "safety incidents in", "incidents in", "hazards in", "issues in area",
        "which area needs attention", "which area needs", "what area needs", "zone needs",
        "worst area", "area ranking", "affected area", "affected areas", "high risk area",
        "building block", "which area", "what area"
    ]):
        return "AREA_SAFETY"

    # 6. SAFETY RISK / RISK ASSESSMENT
    if has_any([
        "what are the top safety risks", "top safety risks", "top safety risk",
        "why is the project risk high", "why is the project risk medium", "why is the project risk critical",
        "why is project risk high", "why is project risk medium", "why is project risk critical",
        "why is the project risk", "why is project risk", "show current safety risks", "current safety risks",
        "which areas are high risk", "risk score", "risk level", "why risk", "high risk", "medium risk",
        "critical risk", "what is the project risk", "what is the risk", "risk factors", "explain risk",
        "how is risk", "risk assessment", "safety risk", "major risk", "major risks"
    ]):
        return "SAFETY_RISK"

    # 7. Recommended Actions & Role Assignments (Explicit Manager Instructions)
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

    # 8. Safety Incidents & Accidents
    if has_any([
        "incident", "incidents", "accident", "accidents", "unresolved incident", "unresolved incidents",
        "open incident", "open incidents", "show unresolved incidents", "safety incident", "safety incidents",
        "safety issue", "safety issues", "near miss", "injury", "hazard", "unsafe condition"
    ]):
        return "SAFETY_INCIDENTS"

    # 9. PPE & Computer Vision
    if has_any([
        "ppe", "helmet", "hard hat", "gloves", "boots", "goggles", "vest",
        "protective equipment", "safety gear", "ppe violation", "ppe compliance"
    ]):
        return "PPE"

    # 10. Inspections & Audits
    if has_any([
        "inspection", "inspections", "failed inspection", "audit", "safety audit",
        "quality audit", "checklist", "inspector"
    ]):
        return "INSPECTIONS"

    # 11. Observations & Hazards
    if has_any([
        "observation", "observations", "snag", "defect", "site observation", "hazard note"
    ]):
        return "OBSERVATIONS"

    # 12. Materials & Supply Chain
    if has_any([
        "material", "materials", "shortage", "shortages", "stock", "supply",
        "supplier", "delivery", "delayed material", "blocking work", "rebar",
        "concrete", "cement", "steel", "aggregate", "inventory"
    ]):
        return "MATERIALS"

    # 13. General Project Overview (Default)
    return "GENERAL_PROJECT_QUERY"


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
    matched_area_names = []
    for area in areas:
        if area.name.lower() in query_lower:
            matched_area_ids.append(area.id)
            matched_area_names.append(area.name)

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
    elif intent in ["SAFETY_INCIDENTS", "SAFETY_RISK", "RECOMMENDED_ACTIONS"]:
        source_type_filters = ["INCIDENT", "INSPECTION"]
    elif intent == "INSPECTIONS":
        source_type_filters = ["INSPECTION"]
    elif intent == "OBSERVATIONS":
        source_type_filters = ["OBSERVATION"]
    elif intent in ["DAILY_REPORT", "WEEKLY_PROGRESS_REPORT"]:
        source_type_filters = ["DAILY_REPORT"]
    elif intent == "PPE":
        source_type_filters = ["PHOTO", "AI_FINDING", "INCIDENT"]
    elif intent in ["AREA_SAFETY", "RECURRING_ISSUES"]:
        source_type_filters = ["AREA", "INCIDENT", "OBSERVATION", "INSPECTION"]
    elif intent == "ISSUES_SUMMARY":
        source_type_filters = ["INCIDENT", "OBSERVATION", "INSPECTION", "DAILY_REPORT"]

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

    if intent in ["SAFETY_RISK", "RISK", "GENERAL_PROJECT_QUERY", "RECOMMENDED_ACTIONS"]:
        context_sections.append(
            f"PROJECT METADATA & AUTHORITATIVE RISK ENGINE:\n"
            f"- Project Name: {project.name}\n"
            f"- Project Status: {project.status}\n"
            f"- Authoritative Risk Score: {risk_score}/100 ({risk_level})\n"
            f"- Data Confidence: {risk_eval.get('data_confidence', 'HIGH')}\n"
            f"- Contributing Risk Factors:\n" + "\n".join([f"  * {r}" for r in risk_reasons])
        )

    # A. DAILY REPORT INTENT
    if intent == "DAILY_REPORT":
        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        all_reps = (
            db.query(models.DailyReport)
            .filter(models.DailyReport.project_id == project_id)
            .order_by(models.DailyReport.report_date.desc())
            .all()
        )
        today_reps = [r for r in all_reps if r.report_date == today_str]
        chosen_reps = today_reps if today_reps else (all_reps[:1] if all_reps else [])
        
        rep_bullets = []
        if today_reps:
            rep_bullets.append(f"STATUS: Stored daily report(s) found for today ({today_str}).")
        elif all_reps:
            rep_bullets.append(f"STATUS: No daily report has been submitted for today ({today_str}). Showing latest available report ({all_reps[0].report_date}).")
        else:
            rep_bullets.append("STATUS: No daily reports recorded in project database.")

        for r in chosen_reps:
            site_n = r.site.name if r.site else "Site"
            area_n = r.area.name if r.area else "Area"
            rep_bullets.append(
                f"- Daily Report #{r.id} (Date: {r.report_date}, Site: {site_n}, Area: {area_n}):\n"
                f"  * Progress: {r.progress_percentage if r.progress_percentage is not None else 'Not reported'}%\n"
                f"  * Workers Active: {r.workers_count if r.workers_count is not None else 'Not reported'}\n"
                f"  * Weather: {r.weather or 'Not reported'}\n"
                f"  * Work Completed: {r.work_completed or 'Not reported'}\n"
                f"  * Planned Work / Next Shift: {r.work_planned or 'Not reported'}\n"
                f"  * Equipment Used: {r.equipment_used or 'Not reported'}\n"
                f"  * Materials Used: {r.materials_used or 'Not reported'}\n"
                f"  * Issues/Delays: {r.issues or 'Not reported'}\n"
                f"  * Blockers: {r.blockers or 'Not reported'}\n"
                f"  * Notes: {r.notes or 'Not reported'}"
            )
            add_source("DAILY_REPORT", str(r.id), f"Daily Report — {r.report_date}", f"{site_n} · {r.workers_count or 0} workers")
            data_used.append("daily_reports")

        context_sections.append("DAILY REPORT DETAIL (SQL):\n" + "\n".join(rep_bullets))

        # Include safety snapshot
        open_incs = db.query(models.SafetyIncident).filter(
            models.SafetyIncident.project_id == project_id,
            models.SafetyIncident.status.in_(["OPEN", "UNDER_REVIEW"])
        ).count()
        open_obs = db.query(models.Observation).filter(
            models.Observation.project_id == project_id,
            models.Observation.status != "RESOLVED"
        ).count()
        failed_insps = db.query(models.InspectionReport).filter(
            models.InspectionReport.project_id == project_id,
            models.InspectionReport.status == "FAILED"
        ).count()
        context_sections.append(
            f"SAFETY SNAPSHOT:\n"
            f"- Open Safety Incidents: {open_incs}\n"
            f"- Open Hazard Observations: {open_obs}\n"
            f"- Failed Inspections: {failed_insps}"
        )

    # B. WEEKLY PROGRESS REPORT INTENT
    elif intent == "WEEKLY_PROGRESS_REPORT":
        all_reps = (
            db.query(models.DailyReport)
            .filter(models.DailyReport.project_id == project_id)
            .order_by(models.DailyReport.report_date.desc())
            .limit(7)
            .all()
        )
        rep_bullets = []
        if all_reps:
            period_str = f"{all_reps[-1].report_date} to {all_reps[0].report_date}" if len(all_reps) > 1 else all_reps[0].report_date
            rep_bullets.append(f"REPORTING PERIOD: {period_str} ({len(all_reps)} daily report(s) retrieved)")
            for r in all_reps:
                site_n = r.site.name if r.site else "Site"
                area_n = r.area.name if r.area else "Area"
                rep_bullets.append(
                    f"- Report #{r.id} ({r.report_date} at {site_n} - {area_n}): Progress: {r.progress_percentage if r.progress_percentage is not None else 'Not reported'}%, Workers: {r.workers_count if r.workers_count is not None else 'Not reported'}, Weather: {r.weather or 'Not reported'}, Work Completed: {r.work_completed or 'Not reported'}, Work Planned: {r.work_planned or 'Not reported'}, Equipment: {r.equipment_used or 'Not reported'}, Materials: {r.materials_used or 'Not reported'}, Issues: {r.issues or 'Not reported'}, Blockers: {r.blockers or 'Not reported'}"
                )
                add_source("DAILY_REPORT", str(r.id), f"Daily Report — {r.report_date}", f"{site_n} · {area_n} · {r.workers_count or 0} workers")
                data_used.append("daily_reports")
        else:
            rep_bullets.append("No daily reports found in the project database for the reporting period.")

        context_sections.append("WEEKLY DAILY REPORTS BREAKDOWN (SQL):\n" + "\n".join(rep_bullets))

        # Materials detail for weekly report
        mat_records = db.query(models.Material).filter(models.Material.project_id == project_id).limit(6).all()
        if mat_records:
            mat_lines = [f"- {m.material_name}: {m.quantity} {m.unit} (Status: {m.status}, Supplier: {m.supplier or 'Not reported'})" for m in mat_records]
            context_sections.append("PROJECT MATERIALS USED / IN STOCK (SQL):\n" + "\n".join(mat_lines))

        # Safety & Quality summary
        open_incs = db.query(models.SafetyIncident).filter(
            models.SafetyIncident.project_id == project_id,
            models.SafetyIncident.status.in_(["OPEN", "UNDER_REVIEW"])
        ).all()
        inc_lines = [f"- Incident #{i.id}: {i.incident_type} ({i.severity}, Status: {i.status}) - {i.description}" for i in open_incs]
        context_sections.append(
            f"SAFETY & QUALITY SUMMARY (SQL):\n"
            f"- Open Safety Incidents ({len(open_incs)}):\n" + ("\n".join(inc_lines) if inc_lines else "  * None")
        )

    # C. RECURRING ISSUES INTENT
    elif intent == "RECURRING_ISSUES":
        rec_issues = RecurringIssueService.detect_recurring_issues(db=db, project_id=project_id, days=14, threshold=2)
        rec_bullets = []
        for r in rec_issues:
            site_n = r.get("site_name") or "Site"
            area_n = r.get("area_name") or "Area"
            rec_bullets.append(
                f"- Recurring Problem: {r.get('title')} at {site_n} -> {area_n} ({r.get('count')} occurrences, Severity: {r.get('severity')}). Description: {r.get('description')}"
            )
            add_source("RECURRING", f"{r.get('area_name')}_{r.get('title')}", f"Recurring: {r.get('title')}", f"{r.get('count')} occurrences at {area_n}")
            data_used.append("recurring_issues")

        if rec_bullets:
            context_sections.append("RECURRING SITE PROBLEMS (SQL):\n" + "\n".join(rec_bullets))
        else:
            context_sections.append("RECURRING SITE PROBLEMS (SQL):\n- No recurring issues (>= 2 occurrences) detected across project zones.")

    # D. ISSUES SUMMARY INTENT
    elif intent == "ISSUES_SUMMARY":
        inc_q = db.query(models.SafetyIncident).filter(models.SafetyIncident.project_id == project_id).order_by(models.SafetyIncident.id.desc()).limit(6).all()
        obs_q = db.query(models.Observation).filter(models.Observation.project_id == project_id).order_by(models.Observation.id.desc()).limit(6).all()
        insp_q = db.query(models.InspectionReport).filter(models.InspectionReport.project_id == project_id, models.InspectionReport.status == "FAILED").order_by(models.InspectionReport.id.desc()).limit(6).all()

        issue_lines = []
        for inc in inc_q:
            area_n = inc.area.name if inc.area else "Site"
            issue_lines.append(f"- Safety Incident #{inc.id} ({inc.severity}, Status: {inc.status}) in {area_n}: {inc.description}")
            add_source("INCIDENT", str(inc.id), f"Incident #{inc.id}: {inc.incident_type}", f"{inc.severity} · {inc.status}")
        for obs in obs_q:
            area_n = obs.area.name if obs.area else "Site"
            issue_lines.append(f"- Observation #{obs.id} [{obs.priority}, Status: {obs.status}] in {area_n}: {obs.title} - {obs.description}")
            add_source("OBSERVATION", str(obs.id), f"Observation #{obs.id}: {obs.title}", f"{obs.priority} · {obs.status}")
        for insp in insp_q:
            area_n = insp.area.name if insp.area else "Site"
            issue_lines.append(f"- Failed Inspection #{insp.id} ({insp.inspection_type}) in {area_n}: {insp.findings or 'Failed audit'}")
            add_source("INSPECTION", str(insp.id), f"Inspection #{insp.id}: {insp.inspection_type}", f"Status: FAILED")

        if issue_lines:
            context_sections.append("PROJECT ISSUES & PROBLEMS SUMMARY (SQL):\n" + "\n".join(issue_lines))
        else:
            context_sections.append("PROJECT ISSUES & PROBLEMS SUMMARY (SQL):\n- No active site issues or safety problems recorded.")

    # E. MATERIALS QUERY
    elif intent == "MATERIALS":
        mat_q = db.query(models.Material).filter(models.Material.project_id == project_id)
        mat_records = mat_q.order_by(models.Material.id.desc()).all()
        
        # Check if query asks for a specific material
        specific_mat_found = None
        for m in mat_records:
            if m.material_name.lower() in query_lower:
                specific_mat_found = m
                break
        
        mat_bullets = []
        if specific_mat_found:
            m = specific_mat_found
            mat_bullets.append(
                f"- Specific Material Match: {m.material_name} ({m.category or 'General'}) - Current Stock: {m.quantity} {m.unit} (Status: {m.status}). Supplier: {m.supplier or 'N/A'}. Notes: {m.notes or 'None'}"
            )
            add_source("MATERIAL", str(m.id), f"Material: {m.material_name}", f"Stock: {m.quantity} {m.unit} · Status: {m.status}")
            data_used.append("materials")
        elif mat_records:
            for m in mat_records[:10]:
                mat_bullets.append(
                    f"- Material #{m.id}: {m.material_name} ({m.category or 'General'}) - Qty: {m.quantity} {m.unit} (Status: {m.status}). Supplier: {m.supplier or 'N/A'}. Notes: {m.notes or 'None'}"
                )
                add_source("MATERIAL", str(m.id), f"Material: {m.material_name}", f"Status: {m.status} ({m.quantity} {m.unit})")
                data_used.append("materials")
        else:
            mat_bullets.append("No material records or inventory found in project database.")

        context_sections.append("MATERIALS & INVENTORY DETAIL (SQL):\n" + "\n".join(mat_bullets))

    # F. SAFETY INCIDENTS / SAFETY RISK / RECOMMENDED ACTIONS / AREA SAFETY
    elif intent in ["SAFETY_INCIDENTS", "SAFETY_RISK", "RECOMMENDED_ACTIONS", "AREA_SAFETY"]:
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
            area_note = f" for {matched_area_names[0]}" if matched_area_names else ""
            context_sections.append(f"SAFETY INCIDENTS DETAIL (SQL):\n- No safety incidents recorded{area_note} in this project.")

        # If Area Safety, also load observations in that area
        if intent == "AREA_SAFETY" and matched_area_ids:
            area_obs = db.query(models.Observation).filter(
                models.Observation.project_id == project_id,
                models.Observation.area_id.in_(matched_area_ids)
            ).order_by(models.Observation.id.desc()).limit(5).all()
            if area_obs:
                obs_lines = [f"- Observation #{o.id} [{o.priority}, Status: {o.status}]: {o.title} - {o.description}" for o in area_obs]
                context_sections.append("AREA OBSERVATIONS (SQL):\n" + "\n".join(obs_lines))
                for o in area_obs:
                    add_source("OBSERVATION", str(o.id), f"Observation #{o.id}: {o.title}", f"{o.priority} · {o.status}")
                    data_used.append("observations")

        # Also load failed inspections if risk, actions, or area safety
        if intent in ["SAFETY_RISK", "RECOMMENDED_ACTIONS", "AREA_SAFETY"]:
            insp_q = db.query(models.InspectionReport).filter(
                models.InspectionReport.project_id == project_id,
                models.InspectionReport.status == "FAILED"
            )
            if matched_area_ids:
                insp_q = insp_q.filter(models.InspectionReport.area_id.in_(matched_area_ids))
            insp_records = insp_q.order_by(models.InspectionReport.id.desc()).limit(5).all()
            insp_bullets = []
            for insp in insp_records:
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

    # G. INSPECTIONS QUERY
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

    # H. OBSERVATIONS QUERY
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

    # I. PPE QUERY
    elif intent == "PPE":
        ppe_summary = get_project_ppe_summary(db=db, project_id=project_id, site_id=matched_site_id, area_id=matched_area_id)
        workers_cnt = ppe_summary["workers_detected"]
        compliant_cnt = ppe_summary["fully_compliant"]
        violating_cnt = ppe_summary["workers_with_violations"]
        compliance_pct = ppe_summary["overall_compliance"]
        viols_list = ppe_summary["violations_list"]

        viols_str = "\n".join([f"  * {v}" for v in viols_list]) if viols_list else "  * No active PPE safety violations detected across scanned workers."

        context_sections.append(
            f"PPE COMPUTER VISION METRICS (SQL):\n"
            f"- Total Workers Detected: {workers_cnt}\n"
            f"- Fully Compliant Workers: {compliant_cnt}\n"
            f"- Workers with Violations: {violating_cnt}\n"
            f"- Overall Worker Compliance Rate: {compliance_pct}%\n"
            f"- Specific Worker Violations:\n{viols_str}"
        )
        add_source("PPE", "ppe_vision", "AI PPE Vision Detection", f"Workers: {workers_cnt} · Compliant: {compliant_cnt} · Violations: {violating_cnt} ({compliance_pct}%)")
        data_used.append("ppe_vision")

    # J. GENERAL PROJECT OVERVIEW
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
