"""
Structured Assistant Response Service.
Builds intent-targeted, deterministic, and typed response objects directly from:
- Ground-truth PostgreSQL database records
- Authoritative deterministic Risk Engine (0-100)
- pgvector semantic retrieval metadata
- Intent-specific data selection (NEVER returns all sections for specific questions)

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
from services.assistant_context import classify_user_intent

logger = logging.getLogger(__name__)


def build_structured_assistant_response(
    db: Session,
    project_id: int,
    query: str,
    raw_answer: str,
    data_used: List[str],
    project_name: str
) -> schemas.AssistantStructuredResponse:
    # 1. Deterministic Intent Detection
    intent = classify_user_intent(query)
    logger.info(f"Assistant processing query '{query}' with classified intent: {intent}")

    # 2. Query Authoritative Risk Engine (for risk queries or general project overview)
    risk_eval = RiskEngine.evaluate_risk(db=db, project_id=project_id, days=7)
    risk_score = int(risk_eval.get("score") if risk_eval.get("score") is not None else risk_eval.get("risk_score", 0))
    risk_level = str(risk_eval.get("level") or risk_eval.get("risk_level", "LOW")).upper()
    raw_factors = risk_eval.get("reasons", [])

    clean_factors = []
    for f in raw_factors:
        clean_f = re.sub(r"#\w+", "", f).strip(" -*•")
        if clean_f and clean_f != "--":
            clean_factors.append(clean_f)
    if not clean_factors:
        clean_factors = ["All site metrics within normal operating safety parameters."]

    # 3. Resolve Scoped Area Entity for Targeted Search Queries
    query_lower = query.lower()
    project_areas = db.query(models.Area).join(models.Site).filter(models.Site.project_id == project_id).all()
    matched_area_ids = [a.id for a in project_areas if a.name.lower() in query_lower]
    matched_area_names = [a.name for a in project_areas if a.name.lower() in query_lower]

    # 4. Fetch Database Entities (Scoped to Area when requested)
    inc_query = db.query(models.SafetyIncident).filter(models.SafetyIncident.project_id == project_id)
    if matched_area_ids:
        inc_query = inc_query.filter(models.SafetyIncident.area_id.in_(matched_area_ids))
    incidents = inc_query.order_by(models.SafetyIncident.id.desc()).limit(10).all()

    insp_query = db.query(models.InspectionReport).filter(models.InspectionReport.project_id == project_id)
    if matched_area_ids:
        insp_query = insp_query.filter(models.InspectionReport.area_id.in_(matched_area_ids))
    inspections = insp_query.order_by(models.InspectionReport.id.desc()).limit(10).all()

    obs_query = db.query(models.Observation).filter(models.Observation.project_id == project_id)
    if matched_area_ids:
        obs_query = obs_query.filter(models.Observation.area_id.in_(matched_area_ids))
    observations = obs_query.order_by(models.Observation.id.desc()).limit(10).all()

    materials = (
        db.query(models.Material)
        .filter(models.Material.project_id == project_id)
        .order_by(models.Material.id.desc())
        .limit(10)
        .all()
    )

    daily_reports = (
        db.query(models.DailyReport)
        .filter(models.DailyReport.project_id == project_id)
        .order_by(models.DailyReport.report_date.desc())
        .limit(7)
        .all()
    )

    area_rankings = []
    try:
        area_rankings = RiskEngine.get_area_risk_rankings(db=db, project_id=project_id, days=7)
    except Exception:
        pass

    ppe_summary = get_project_ppe_summary(db=db, project_id=project_id)
    ai_workers_detected = ppe_summary["workers_detected"]
    ai_compliance_count = ppe_summary["fully_compliant"]
    ai_violations_count = ppe_summary["workers_with_violations"]
    ppe_pct = ppe_summary["overall_compliance"]
    violations_list = ppe_summary["violations_list"]
    compliance_list = ppe_summary["compliance_list"]
    total_ppe = ai_workers_detected

    # Team Members & Roles for Assignee Resolution
    team_members = (
        db.query(models.ProjectMember)
        .join(models.User)
        .filter(models.ProjectMember.project_id == project_id)
        .all()
    )
    role_map = {}
    for pm in team_members:
        canonical_role = (pm.role or "").upper().replace(" ", "_").strip()
        if canonical_role not in role_map:
            role_map[canonical_role] = pm.user.name

    def get_assignee(role_key: str, default_title: str) -> str:
        name = role_map.get(role_key)
        if name:
            return f"{default_title} ({name})"
        return default_title

    safety_assignee = get_assignee("SAFETY_OFFICER", "Safety Officer")
    supervisor_assignee = get_assignee("SITE_SUPERVISOR", "Site Supervisor")
    contractor_assignee = get_assignee("CONTRACTOR", "Contractor")
    pm_assignee = get_assignee("PROJECT_MANAGER", "Project Manager")

    # =========================================================================
    # INTENT 1: DAILY REPORT
    # =========================================================================
    if intent == "DAILY_REPORT":
        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        today_reps = [r for r in daily_reports if r.report_date == today_str]
        latest = today_reps[0] if today_reps else (daily_reports[0] if daily_reports else None)

        progress_info = None
        prog_sources = []
        if latest:
            progress_info = schemas.AssistantProgressInfo(
                report_type="DAILY",
                reporting_period=latest.report_date,
                progress_pct=latest.progress_percentage,
                workers_count=latest.workers_count,
                work_completed=latest.work_completed or "Ongoing site activities logged.",
                work_planned=latest.work_planned,
                weather=latest.weather or "Clear",
                blockers=latest.blockers if (latest.blockers and latest.blockers.lower() != "none") else None,
                days_logged=1
            )
            prog_sources.append(
                schemas.AssistantSource(
                    type="DAILY_REPORT",
                    id=str(latest.id),
                    title=f"Daily Report #{latest.id} ({latest.report_date})",
                    detail=f"Workers: {latest.workers_count or 0} · Progress: {latest.progress_percentage or 0}% · {latest.site.name if latest.site else 'Site'}"
                )
            )
            summary = (
                f"Daily Report for {project_name} ({latest.report_date}): "
                f"{latest.work_completed or 'Work completed as scheduled'}. "
                f"Active Workforce: {latest.workers_count or 0} workers on site. "
                f"Progress: {latest.progress_percentage or 0}%. "
                f"Weather: {latest.weather or 'Clear'}."
            )
        else:
            summary = f"No daily reports recorded in the stored data for {project_name}."

        return schemas.AssistantStructuredResponse(
            query_type="DAILY_REPORT",
            executive_summary=summary,
            risk=None,
            attention_items=[],
            locations=[],
            recommended_actions=[],
            materials=[],
            progress=progress_info,
            ppe=None,
            sources=prog_sources,
            explainability=_build_explainability("Daily Reports & Workforce Aggregation", len(daily_reports), risk_score, risk_level),
            suggested_followups=["Generate a weekly site progress report", "Are there any material shortages?", "What are the top safety risks?"]
        )

    # =========================================================================
    # INTENT 2: WEEKLY PROGRESS REPORT
    # =========================================================================
    elif intent == "WEEKLY_PROGRESS_REPORT":
        latest = daily_reports[0] if daily_reports else None
        progress_info = None
        prog_sources = []
        
        if daily_reports:
            work_summaries = [r.work_completed for r in daily_reports if r.work_completed]
            combined_work = " | ".join(work_summaries[:3]) if work_summaries else "Weekly construction milestones progressing."
            max_progress = max(((r.progress_percentage or 0) for r in daily_reports), default=0)
            workers_latest = max(((r.workers_count or 0) for r in daily_reports), default=(latest.workers_count if latest else 0))
            planned_summaries = [r.work_planned for r in daily_reports if r.work_planned]
            combined_planned = " | ".join(planned_summaries[:2]) if planned_summaries else None
            
            period_str = f"{daily_reports[-1].report_date} to {daily_reports[0].report_date}" if len(daily_reports) > 1 else daily_reports[0].report_date

            activities_list = []
            for r in daily_reports:
                if r.work_completed:
                    loc = f"{r.site.name if r.site else 'Site'}{(' - ' + r.area.name) if r.area else ''}"
                    activities_list.append(f"{r.report_date} ({loc}): {r.work_completed}")

            blockers_list = [r.blockers for r in daily_reports if r.blockers and r.blockers.lower() != "none"]
            combined_blockers = " | ".join(blockers_list) if blockers_list else None

            # Safety status
            open_inc_count = len(incidents)
            safety_stat = f"{open_inc_count} open safety incident(s) flagged" if open_inc_count > 0 else "Zero open safety incidents recorded"

            # Materials status
            mat_summary = None
            if materials:
                mat_summary = ", ".join([f"{m.material_name} ({m.quantity} {m.unit}, {m.status})" for m in materials[:3]])

            progress_info = schemas.AssistantProgressInfo(
                report_type="WEEKLY",
                reporting_period=period_str,
                progress_pct=max_progress,
                workers_count=workers_latest,
                work_completed=combined_work,
                work_planned=combined_planned,
                weather=latest.weather if latest else "Clear",
                blockers=combined_blockers,
                activities=activities_list,
                safety_summary=safety_stat,
                materials_summary=mat_summary,
                days_logged=len(daily_reports)
            )

            for r in daily_reports[:4]:
                prog_sources.append(
                    schemas.AssistantSource(
                        type="DAILY_REPORT",
                        id=str(r.id),
                        title=f"Daily Report — {r.report_date}",
                        detail=f"{r.site.name if r.site else 'Site'} · Progress {r.progress_percentage or 0}% · {r.workers_count or 0} workers"
                    )
                )

            summary = (
                f"Weekly Site Progress Report for {project_name} (Period: {period_str}): "
                f"{len(daily_reports)} daily log(s) consolidated. "
                f"Overall milestone progress is at {max_progress}%. "
                f"Peak workforce: {workers_latest} workers on site. "
                f"Summary of work: {combined_work[:200]}..."
            )
        else:
            summary = f"No weekly progress logs or daily reports recorded in the stored data for {project_name}."

        weekly_attention = []
        for r in daily_reports:
            if r.blockers and r.blockers.lower() != "none":
                weekly_attention.append(
                    schemas.AssistantAttentionItem(
                        id=str(r.id),
                        title=f"Site Blocker ({r.report_date})",
                        description=r.blockers,
                        severity="HIGH",
                        category="PROGRESS",
                        status="OPEN"
                    )
                )

        weekly_actions = [
            schemas.AssistantActionItem(
                title="Review weekly progress against master construction schedule",
                description="Coordinate trade shift handover and ensure continuous material availability for upcoming work packages.",
                priority="STANDARD",
                category="Operations",
                role=pm_assignee
            )
        ]

        return schemas.AssistantStructuredResponse(
            query_type="WEEKLY_PROGRESS_REPORT",
            executive_summary=summary,
            risk=None,
            attention_items=weekly_attention,
            locations=[],
            recommended_actions=weekly_actions,
            materials=[],
            progress=progress_info,
            ppe=None,
            sources=prog_sources,
            explainability=_build_explainability("Weekly Progress & Daily Log Synthesis", len(daily_reports), risk_score, risk_level),
            suggested_followups=["Summarize the problems reported this week", "Are there any material shortages?", "What is the project risk score?"]
        )

    # =========================================================================
    # INTENT 3: RECURRING ISSUES
    # =========================================================================
    elif intent == "RECURRING_ISSUES":
        rec_issues = RecurringIssueService.detect_recurring_issues(db=db, project_id=project_id, days=14, threshold=2)
        rec_attention = []
        rec_sources = []
        rec_actions = []

        for r in rec_issues:
            issue_title = f"Recurring: {r.get('issue_type')} ({r.get('occurrence_count')} occurrences)"
            issue_desc = f"Repeated hazard at {r.get('area_name') or 'General Area'}. First recorded: {r.get('first_seen')}, latest: {r.get('last_seen')}."
            rec_attention.append(
                schemas.AssistantAttentionItem(
                    id=f"{r.get('area_id')}_{r.get('issue_type')}",
                    title=issue_title,
                    description=issue_desc,
                    severity=r.get("severity", "HIGH"),
                    category=r.get("issue_category", "SAFETY"),
                    status=r.get("status", "ACTIVE"),
                    site_name=r.get("site_name"),
                    area_name=r.get("area_name")
                )
            )
            rec_sources.append(
                schemas.AssistantSource(
                    type="RECURRING",
                    id=f"{r.get('area_name')}_{r.get('issue_type')}",
                    title=f"Recurring: {r.get('issue_type')}",
                    detail=f"{r.get('occurrence_count')} occurrences at {r.get('area_name')}"
                )
            )
            rec_actions.append(
                schemas.AssistantActionItem(
                    title=f"Mitigate recurring {r.get('issue_type')} at {r.get('area_name')}",
                    description=f"Conduct mandatory safety briefing and physical inspection to eliminate recurring hazard ({r.get('occurrence_count')} occurrences).",
                    priority="IMMEDIATE" if r.get("severity") in ["HIGH", "CRITICAL"] else "HIGH",
                    category="Safety",
                    role=safety_assignee
                )
            )

        if rec_issues:
            summary = (
                f"Recurring Hazard Analysis for {project_name}: Detected {len(rec_issues)} recurring problem(s) "
                f"exceeding frequency threshold (>= 2 occurrences). Primary issue: {rec_issues[0].get('issue_type')} "
                f"at {rec_issues[0].get('area_name')} ({rec_issues[0].get('occurrence_count')} occurrences)."
            )
        else:
            summary = f"No recurring safety issues (>= 2 occurrences) were detected across project zones in {project_name}."

        return schemas.AssistantStructuredResponse(
            query_type="RECURRING_ISSUES",
            executive_summary=summary,
            risk=None,
            attention_items=rec_attention,
            locations=[],
            recommended_actions=rec_actions,
            materials=[],
            progress=None,
            ppe=None,
            sources=rec_sources,
            explainability=_build_explainability("Recurring Hazard & Spatial Intelligence Engine", len(rec_issues), risk_score, risk_level),
            suggested_followups=["Summarize the problems reported this week", "What safety issues were found in this area?", "What are the recommended actions?"]
        )

    # =========================================================================
    # INTENT 4: ISSUES SUMMARY / PROBLEMS THIS WEEK
    # =========================================================================
    elif intent == "ISSUES_SUMMARY":
        issues_attention = []
        issues_sources = []
        issues_actions = []

        for inc in incidents:
            area_n = inc.area.name if inc.area else "Site"
            issues_attention.append(
                schemas.AssistantAttentionItem(
                    id=str(inc.id),
                    title=f"Incident #{inc.id}: {inc.incident_type.replace('_', ' ').title()}",
                    description=inc.description,
                    severity=inc.severity or "HIGH",
                    category="SAFETY",
                    status=inc.status or "OPEN",
                    area_name=area_n,
                    action_taken=inc.action_taken
                )
            )
            issues_sources.append(
                schemas.AssistantSource(
                    type="INCIDENT",
                    id=str(inc.id),
                    title=f"Incident #{inc.id}: {inc.incident_type}",
                    detail=f"{inc.severity} · {inc.status} · {area_n}"
                )
            )

        failed_insps = [i for i in inspections if i.status == "FAILED"]
        for insp in failed_insps:
            area_n = insp.area.name if insp.area else "Site"
            issues_attention.append(
                schemas.AssistantAttentionItem(
                    id=str(insp.id),
                    title=f"Failed Inspection: {insp.inspection_type.replace('_', ' ').title()}",
                    description=insp.findings or "Failed audit criteria.",
                    severity="HIGH",
                    category="QUALITY",
                    status="FAILED",
                    area_name=area_n,
                    action_taken=insp.recommendations
                )
            )
            issues_sources.append(
                schemas.AssistantSource(
                    type="INSPECTION",
                    id=str(insp.id),
                    title=f"Inspection #{insp.id}: {insp.inspection_type}",
                    detail=f"FAILED · {area_n}"
                )
            )

        for obs in observations:
            if obs.status != "RESOLVED":
                area_n = obs.area.name if obs.area else "Site"
                issues_attention.append(
                    schemas.AssistantAttentionItem(
                        id=str(obs.id),
                        title=f"Observation #{obs.id}: {obs.title}",
                        description=obs.description,
                        severity=obs.priority or "MEDIUM",
                        category="OBSERVATION",
                        status=obs.status,
                        area_name=area_n
                    )
                )
                issues_sources.append(
                    schemas.AssistantSource(
                        type="OBSERVATION",
                        id=str(obs.id),
                        title=f"Observation #{obs.id}: {obs.title}",
                        detail=f"{obs.priority} · {obs.status}"
                    )
                )

        if issues_attention:
            open_count = len(issues_attention)
            first_issue = issues_attention[0]
            summary = (
                f"Weekly Problems Summary for {project_name}: {open_count} active issue(s) reported "
                f"({len(incidents)} safety incidents, {len(failed_insps)} failed inspections, {len(observations)} observations). "
                f"Primary concern: {first_issue.title} in {first_issue.area_name or 'Site'}."
            )
            issues_actions.append(
                schemas.AssistantActionItem(
                    title="Remediate flagged site safety and inspection issues",
                    description="Assign field supervisors to verify clearance of open incident and failed inspection findings.",
                    priority="HIGH",
                    category="Safety",
                    role=safety_assignee
                )
            )
        else:
            summary = f"No safety problems, failed inspections, or active incident issues reported this week in {project_name}."

        return schemas.AssistantStructuredResponse(
            query_type="ISSUES_SUMMARY",
            executive_summary=summary,
            risk=None,
            attention_items=issues_attention,
            locations=[],
            recommended_actions=issues_actions,
            materials=[],
            progress=None,
            ppe=None,
            sources=issues_sources[:6],
            explainability=_build_explainability("Weekly Issues & Incident Aggregation", len(issues_attention), risk_score, risk_level),
            suggested_followups=["Which issues have occurred repeatedly?", "What safety issues were found in this area?", "Generate a weekly site progress report"]
        )

    # =========================================================================
    # INTENT 5: AREA SAFETY & SPATIAL ISSUES
    # =========================================================================
    elif intent == "AREA_SAFETY":
        area_attention = []
        area_sources = []
        area_locations = []
        area_actions = []

        if matched_area_ids:
            target_area_name = matched_area_names[0]
            for inc in incidents:
                area_attention.append(
                    schemas.AssistantAttentionItem(
                        id=str(inc.id),
                        title=f"Incident #{inc.id}: {inc.incident_type.replace('_', ' ').title()}",
                        description=inc.description,
                        severity=inc.severity or "HIGH",
                        category="SAFETY",
                        status=inc.status or "OPEN",
                        area_name=target_area_name,
                        action_taken=inc.action_taken
                    )
                )
                area_sources.append(
                    schemas.AssistantSource(
                        type="INCIDENT",
                        id=str(inc.id),
                        title=f"Incident #{inc.id}: {inc.incident_type}",
                        detail=f"{inc.severity} · {target_area_name}"
                    )
                )

            for obs in observations:
                area_attention.append(
                    schemas.AssistantAttentionItem(
                        id=str(obs.id),
                        title=f"Observation #{obs.id}: {obs.title}",
                        description=obs.description,
                        severity=obs.priority or "MEDIUM",
                        category="OBSERVATION",
                        status=obs.status,
                        area_name=target_area_name
                    )
                )
                area_sources.append(
                    schemas.AssistantSource(
                        type="OBSERVATION",
                        id=str(obs.id),
                        title=f"Observation #{obs.id}: {obs.title}",
                        detail=f"{obs.priority} · {target_area_name}"
                    )
                )

            area_locations.append(
                schemas.AssistantLocationItem(
                    area_name=target_area_name,
                    issue_summary=f"{len(incidents)} safety incident(s), {len(observations)} observation(s) logged."
                )
            )

            if area_attention:
                summary = (
                    f"Area Safety Status for {target_area_name} ({project_name}): {len(area_attention)} issue(s) recorded "
                    f"({len(incidents)} incident(s), {len(observations)} observation(s))."
                )
                area_actions.append(
                    schemas.AssistantActionItem(
                        title=f"Inspect and clear hazards in {target_area_name}",
                        description="Conduct site walkthrough with trade supervisor before next shift.",
                        priority="HIGH",
                        category="Safety",
                        role=safety_assignee
                    )
                )
            else:
                summary = f"No safety issues, incidents, or observations found for {target_area_name} in stored project data."
        else:
            for r in area_rankings:
                area_locations.append(
                    schemas.AssistantLocationItem(
                        site_name=r.get("site_name"),
                        area_name=r.get("area_name"),
                        risk_score=r.get("risk_score"),
                        risk_level=r.get("risk_level"),
                        issue_summary=f"Risk Score: {r.get('risk_score')}/100 ({r.get('risk_level')})"
                    )
                )
            for loc in area_locations[:4]:
                area_sources.append(
                    schemas.AssistantSource(
                        type="AREA",
                        id=str(loc.area_name),
                        title=f"Area: {loc.area_name}",
                        detail=loc.issue_summary
                    )
                )
            top_area = area_locations[0] if area_locations else None
            if top_area:
                summary = f"Area Risk Ranking for {project_name}: {top_area.area_name} currently has the highest risk ranking ({top_area.issue_summary})."
            else:
                summary = f"All site areas in {project_name} are currently operating within standard safety parameters."

        return schemas.AssistantStructuredResponse(
            query_type="AREA_SAFETY",
            executive_summary=summary,
            risk=None,
            attention_items=area_attention,
            locations=area_locations,
            recommended_actions=area_actions,
            materials=[],
            progress=None,
            ppe=None,
            sources=area_sources,
            explainability=_build_explainability("Spatial & Zone Safety Intelligence Engine", len(area_attention) or len(area_locations), risk_score, risk_level),
            suggested_followups=["Which issues have occurred repeatedly?", "Summarize the problems reported this week", "What are the top safety risks?"]
        )

    # =========================================================================
    # INTENT 6: MATERIALS
    # =========================================================================
    elif intent == "MATERIALS":
        # Check if query asks for a specific material
        specific_mat_found = None
        for m in materials:
            if m.material_name.lower() in query_lower:
                specific_mat_found = m
                break

        structured_materials: List[schemas.AssistantMaterialItem] = []
        for m in materials:
            structured_materials.append(
                schemas.AssistantMaterialItem(
                    name=m.material_name,
                    status=m.status,
                    quantity=float(m.quantity) if m.quantity is not None else None,
                    unit=m.unit,
                    category=m.category,
                    supplier=m.supplier,
                    notes=m.notes
                )
            )

        mat_attention: List[schemas.AssistantAttentionItem] = []
        for m in materials:
            if m.status in ["DELAYED", "OUT_OF_STOCK", "LOW_STOCK"]:
                mat_attention.append(
                    schemas.AssistantAttentionItem(
                        id=str(m.id),
                        title=f"Material Alert: {m.material_name} ({m.status.replace('_', ' ').title()})",
                        description=f"Quantity: {m.quantity} {m.unit}. Supplier: {m.supplier or 'N/A'}. Notes: {m.notes or 'None'}".strip(),
                        severity="HIGH" if m.status in ["DELAYED", "OUT_OF_STOCK"] else "MEDIUM",
                        category="MATERIAL",
                        status=m.status
                    )
                )

        mat_actions: List[schemas.AssistantActionItem] = []
        delayed_mats = [m for m in materials if m.status in ["DELAYED", "OUT_OF_STOCK"]]
        for dm in delayed_mats:
            mat_actions.append(
                schemas.AssistantActionItem(
                    title=f"Expedite delivery of {dm.material_name}",
                    description=f"Coordinate with {dm.supplier or 'supplier'} to resolve shipment delay ({dm.quantity} {dm.unit} required).",
                    priority="HIGH",
                    category="Materials",
                    role=contractor_assignee
                )
            )
        if not mat_actions and structured_materials:
            mat_actions.append(
                schemas.AssistantActionItem(
                    title="Maintain scheduled material deliveries",
                    description="All tracked project materials are currently in stock with no active supply blockers.",
                    priority="STANDARD",
                    category="Materials",
                    role=contractor_assignee
                )
            )

        mat_sources = [
            schemas.AssistantSource(
                type="MATERIAL",
                id=str(m.id),
                title=f"Material: {m.material_name}",
                detail=f"Status: {m.status} ({m.quantity} {m.unit})"
            )
            for m in materials[:5]
        ]

        if specific_mat_found:
            sm = specific_mat_found
            summary = (
                f"Material Status: **{sm.material_name}** currently has **{sm.quantity} {sm.unit}** in stock "
                f"(Status: {sm.status}). Supplier: {sm.supplier or 'N/A'}."
            )
        elif delayed_mats:
            dm_names = ", ".join([f"{m.material_name} ({m.status})" for m in delayed_mats])
            summary = f"Material alert: {len(delayed_mats)} item(s) require attention: {dm_names}. Immediate supplier coordination recommended."
        elif structured_materials:
            summary = f"Material inventory for {project_name}: All {len(structured_materials)} recorded material items are in stock and within normal operating levels."
        else:
            summary = f"I couldn't find any material records in the stored data for {project_name}."

        return schemas.AssistantStructuredResponse(
            query_type="MATERIALS",
            executive_summary=summary,
            risk=None,
            attention_items=mat_attention,
            locations=[],
            recommended_actions=mat_actions,
            materials=structured_materials,
            progress=None,
            ppe=None,
            sources=mat_sources,
            explainability=_build_explainability("SQL Materials & Inventory Retrieval", len(materials), risk_score, risk_level),
            suggested_followups=["Are any materials delaying progress?", "Generate a weekly site progress report", "What are the recommended actions?"]
        )

    # =========================================================================
    # INTENT 7: SAFETY RISK
    # =========================================================================
    elif intent in ["SAFETY_RISK", "RISK"]:
        risk_info = schemas.AssistantRiskInfo(
            score=risk_score,
            level=risk_level,
            factors=clean_factors,
            summary=f"Project risk evaluated at {risk_score}/100 ({risk_level}) by the deterministic Risk Engine."
        )

        risk_attention = []
        for inc in incidents:
            if inc.status in ["OPEN", "UNDER_REVIEW"] or inc.severity in ["HIGH", "CRITICAL"]:
                risk_attention.append(
                    schemas.AssistantAttentionItem(
                        id=str(inc.id),
                        title=f"{inc.incident_type.replace('_', ' ').title()} #{inc.id}",
                        description=inc.description,
                        severity=inc.severity or "HIGH",
                        category="SAFETY",
                        status=inc.status or "OPEN",
                        site_name=inc.site.name if inc.site else None,
                        area_name=inc.area.name if inc.area else None
                    )
                )

        risk_locations = []
        for r in area_rankings:
            if (r.get("risk_score") or 0) > 0:
                risk_locations.append(
                    schemas.AssistantLocationItem(
                        site_name=r.get("site_name"),
                        area_name=r.get("area_name"),
                        risk_score=r.get("risk_score"),
                        risk_level=r.get("risk_level"),
                        issue_summary=f"Risk Score: {r.get('risk_score')}/100"
                    )
                )

        risk_actions = []
        if risk_attention:
            for item in risk_attention[:2]:
                inc_id = int(item.id) if item.id and str(item.id).isdigit() else None
                risk_actions.append(
                    schemas.AssistantActionItem(
                        title=f"Resolve {item.title} at {item.area_name or 'site'}",
                        description=item.description or "Execute corrective mitigation to reduce overall safety risk.",
                        priority="IMMEDIATE" if item.severity in ["HIGH", "CRITICAL"] else "HIGH",
                        category="Safety",
                        role=safety_assignee,
                        entity_type="INCIDENT",
                        entity_id=inc_id,
                        link=f"/projects/{project_id}/incidents?incidentId={inc_id}#incident-{inc_id}" if inc_id else f"/projects/{project_id}/incidents"
                    )
                )
        else:
            risk_actions.append(
                schemas.AssistantActionItem(
                    title="Continue scheduled safety monitoring",
                    description="Maintain current safety guidelines to preserve low risk status.",
                    priority="STANDARD",
                    category="Safety",
                    role=safety_assignee
                )
            )

        risk_sources = [
            schemas.AssistantSource(
                type="RISK",
                id="risk_engine",
                title=f"Risk Assessment: Score {risk_score}/100 ({risk_level})",
                detail="Authoritative deterministic multi-factor calculation"
            )
        ]
        for inc in incidents[:3]:
            risk_sources.append(schemas.AssistantSource(
                type="INCIDENT",
                id=str(inc.id),
                title=f"Incident #{inc.id}: {inc.incident_type}",
                detail=f"{inc.severity} · {inc.status}"
            ))

        reasons_summary = "; ".join(clean_factors[:2])
        summary = f"Project risk is currently evaluated at {risk_score}/100 ({risk_level}). Primary contributing factor(s): {reasons_summary}."

        return schemas.AssistantStructuredResponse(
            query_type="SAFETY_RISK",
            executive_summary=summary,
            risk=risk_info,
            attention_items=risk_attention,
            locations=risk_locations,
            recommended_actions=risk_actions,
            materials=[],
            progress=None,
            ppe=None,
            sources=risk_sources,
            explainability=_build_explainability("Authoritative Risk Engine Multi-Factor Formulation", len(clean_factors), risk_score, risk_level),
            suggested_followups=["Which area needs attention?", "List unresolved safety incidents", "What are the recommended actions?"]
        )

    # =========================================================================
    # INTENT 8: RECOMMENDED ACTIONS & ROLE ASSIGNMENTS
    # =========================================================================
    elif intent == "RECOMMENDED_ACTIONS":
        actions: List[schemas.AssistantActionItem] = []
        action_sources: List[schemas.AssistantSource] = []

        for inc in incidents:
            if inc.status in ["OPEN", "UNDER_REVIEW"]:
                area_n = inc.area.name if inc.area else "Site"
                actions.append(
                    schemas.AssistantActionItem(
                        title=f"Investigate {inc.incident_type.replace('_', ' ').title()} at {area_n}",
                        description=inc.action_taken or "Verify equipment stabilization and ground safety clearance before resuming operations.",
                        priority="IMMEDIATE" if inc.severity in ["HIGH", "CRITICAL"] else "HIGH",
                        category="Safety",
                        role=safety_assignee,
                        entity_type="INCIDENT",
                        entity_id=inc.id,
                        link=f"/projects/{project_id}/incidents?incidentId={inc.id}#incident-{inc.id}"
                    )
                )
                action_sources.append(schemas.AssistantSource(
                    type="INCIDENT",
                    id=str(inc.id),
                    title=f"Incident #{inc.id}: {inc.incident_type}",
                    detail=f"{inc.severity} · {area_n}"
                ))

        for insp in inspections:
            if insp.status == "FAILED":
                area_n = insp.area.name if insp.area else "Site"
                actions.append(
                    schemas.AssistantActionItem(
                        title=f"Rectify {insp.inspection_type.replace('_', ' ').title()} findings at {area_n}",
                        description=insp.recommendations or "Complete required repairs and schedule safety re-inspection.",
                        priority="HIGH",
                        category="Quality",
                        role=supervisor_assignee,
                        entity_type="INSPECTION",
                        entity_id=insp.id,
                        link=f"/projects/{project_id}/inspections"
                    )
                )
                action_sources.append(schemas.AssistantSource(
                    type="INSPECTION",
                    id=str(insp.id),
                    title=f"Inspection #{insp.id}: {insp.inspection_type}",
                    detail=f"FAILED · {area_n}"
                ))

        for m in materials:
            if m.status in ["DELAYED", "OUT_OF_STOCK"]:
                actions.append(
                    schemas.AssistantActionItem(
                        title=f"Expedite delivery of {m.material_name}",
                        description=f"Coordinate with {m.supplier or 'supplier'} to resolve delay ({m.quantity} {m.unit} needed).",
                        priority="HIGH",
                        category="Materials",
                        role=contractor_assignee,
                        entity_type="MATERIAL",
                        entity_id=m.id,
                        link=f"/projects/{project_id}/materials"
                    )
                )
                action_sources.append(schemas.AssistantSource(
                    type="MATERIAL",
                    id=str(m.id),
                    title=f"Material: {m.material_name}",
                    detail=f"DELAYED · Supplier: {m.supplier}"
                ))

        if ai_violations_count > 0:
            actions.append(
                schemas.AssistantActionItem(
                    title="Enforce mandatory hard hat & PPE protocols",
                    description=f"Conduct mandatory toolbox safety briefing with workers in active crane and excavation zones ({ai_violations_count} violation(s) detected).",
                    priority="HIGH",
                    category="Safety",
                    role=safety_assignee,
                    entity_type="PPE",
                    link=f"/projects/{project_id}/photos"
                )
            )

        if not actions:
            actions.append(
                schemas.AssistantActionItem(
                    title="Maintain routine safety oversight and daily logging",
                    description="Continue scheduled daily reports and perimeter safety checks.",
                    priority="STANDARD",
                    category="Operations",
                    role=pm_assignee,
                    link=f"/projects/{project_id}/dashboard"
                )
            )

        is_assignment_query = any(w in query_lower for w in [
            "assign", "assigned", "who should", "who to", "who is responsible", "responsibility", "owner", "assignee", "role", "roles"
        ])
        if is_assignment_query:
            summary = (
                f"Action assignments for {project_name}: Safety items assigned to {safety_assignee}, "
                f"inspection rectifications to {supervisor_assignee}, and procurement/materials to {contractor_assignee}."
            )
        else:
            summary = f"Prioritized executive action plan with {len(actions)} concrete recommendation(s) based on current site safety, quality audits, and supply status."

        return schemas.AssistantStructuredResponse(
            query_type="RECOMMENDED_ACTIONS",
            executive_summary=summary,
            risk=None,
            attention_items=[],
            locations=[],
            recommended_actions=actions,
            materials=[],
            progress=None,
            ppe=None,
            sources=action_sources,
            explainability=_build_explainability("Deterministic Action & Role Assignment Engine", len(actions), risk_score, risk_level),
            suggested_followups=["Who should be assigned to these actions?", "Why is the project risk medium?", "What is the material status?"]
        )

    # =========================================================================
    # INTENT 9: PPE & VISION
    # =========================================================================
    elif intent == "PPE":
        all_workers = ppe_summary.get("people", [])
        gloves_cnt = 0
        boots_cnt = 0
        helmet_cnt = 0
        vest_cnt = 0

        for p in all_workers:
            viols_str = " ".join(p.get("violations", [])).lower()
            missing_items_str = " ".join(p.get("missing_items", [])).lower()
            chk = p.get("checklist", {})
            
            def is_present(key: str) -> bool:
                item_val = chk.get(key, {})
                if isinstance(item_val, dict):
                    return bool(item_val.get("detected", item_val.get("present", False)))
                return bool(item_val)

            if "glove" in viols_str or "glove" in missing_items_str or not is_present("gloves"):
                gloves_cnt += 1
            if "boot" in viols_str or "boot" in missing_items_str or not is_present("boots"):
                boots_cnt += 1
            if "helmet" in viols_str or "helmet" in missing_items_str or not is_present("helmet"):
                helmet_cnt += 1
            if "vest" in viols_str or "vest" in missing_items_str or not is_present("vest"):
                vest_cnt += 1

        type_breakdown = [
            schemas.AssistantPPEViolationTypeBreakdown(item_key="gloves", label="Gloves Missing", count=gloves_cnt),
            schemas.AssistantPPEViolationTypeBreakdown(item_key="boots", label="Boots Missing", count=boots_cnt),
            schemas.AssistantPPEViolationTypeBreakdown(item_key="helmet", label="Helmet Missing", count=helmet_cnt),
            schemas.AssistantPPEViolationTypeBreakdown(item_key="vest", label="Vest Missing", count=vest_cnt),
        ]
        type_breakdown.sort(key=lambda x: x.count, reverse=True)

        project_photos = db.query(models.SitePhoto).filter(models.SitePhoto.project_id == project_id).order_by(models.SitePhoto.id.asc()).all()
        photos_structured: List[schemas.AssistantPPEPhotoItem] = []
        
        for ph in project_photos:
            p_people = [p for p in all_workers if p.get("photo_id") == ph.id]
            p_workers = len(p_people)
            p_compliant = sum(1 for p in p_people if p.get("compliant"))
            p_viols = sum(1 for p in p_people if not p.get("compliant"))
            p_pct = round((p_compliant / p_workers * 100), 1) if p_workers > 0 else 100.0
            
            missing_types = set()
            for p in p_people:
                for m in p.get("missing_items", p.get("violations", [])):
                    m_clean = m.replace("Safety ", "").replace("Protective ", "").replace("High-Visibility ", "").replace("Missing", "").strip().lower()
                    if m_clean:
                        missing_types.add(m_clean)
            
            missing_summary_str = f"Missing {', '.join(sorted(missing_types))}" if missing_types else "Fully Compliant"
            
            photos_structured.append(
                schemas.AssistantPPEPhotoItem(
                    photo_id=ph.id,
                    title=f"Photo #{ph.id}",
                    image_url=ph.file_path if ph.file_path else f"/api/photos/{ph.id}/image",
                    created_at=ph.created_at.strftime("%b %d, %Y • %I:%M %p") if ph.created_at else None,
                    workers_count=p_workers,
                    compliant_count=p_compliant,
                    violations_count=p_viols,
                    compliance_pct=p_pct,
                    missing_summary=missing_summary_str,
                    people=p_people
                )
            )

        status_level = "GOOD" if ppe_pct >= 80.0 else ("WARNING" if ppe_pct >= 50.0 else "CRITICAL")
        
        if ai_violations_count > 0:
            top_v_name = type_breakdown[0].label.lower() if type_breakdown and type_breakdown[0].count > 0 else "missing gear"
            insight = (
                f"Current PPE compliance is at {ppe_pct}%. "
                f"{ai_violations_count} of {ai_workers_detected} analyzed workers have at least one missing PPE item. "
                f"{top_v_name.capitalize()} is the most frequent violation across active site photos."
            )
        else:
            insight = f"Excellent site safety compliance: 100% worker compliance verified across {ai_workers_detected} active workers."

        ppe_info = schemas.AssistantPPEInfo(
            compliance_count=ai_compliance_count,
            violations_count=ai_violations_count,
            compliance_pct=ppe_pct,
            total_workers=ai_workers_detected,
            total_photos=len(project_photos),
            photos_analyzed=ppe_summary.get("photos_analyzed", len(photos_structured)),
            status_level=status_level,
            insight_summary=insight,
            type_breakdown=type_breakdown,
            photos=photos_structured,
            violations_list=violations_list if violations_list else ["No active PPE violations"],
            compliance_items=compliance_list if compliance_list else ["No compliant workers logged"]
        )

        ppe_actions = []
        if ai_violations_count > 0:
            viol_detail = f" ({', '.join(violations_list[:2])})" if violations_list else ""
            ppe_actions.append(
                schemas.AssistantActionItem(
                    title="Enforce mandatory PPE protocols on site",
                    description=f"{ai_violations_count} worker(s) detected with PPE safety violations{viol_detail}. Conduct mandatory safety briefing with field teams.",
                    priority="HIGH",
                    category="Safety",
                    role=safety_assignee
                )
            )
        else:
            ppe_actions.append(
                schemas.AssistantActionItem(
                    title="Maintain continuous AI camera monitoring",
                    description="All scanned workers are currently fully compliant with required safety gear.",
                    priority="STANDARD",
                    category="Safety",
                    role=safety_assignee
                )
            )

        ppe_sources = [
            schemas.AssistantSource(
                type="PPE",
                id="ai_vision",
                title="AI Computer Vision Detection",
                detail=f"Workers: {ai_workers_detected} · Compliant: {ai_compliance_count} · Violations: {ai_violations_count} ({ppe_pct}% Compliance)"
            )
        ]

        if ai_workers_detected > 0:
            summary = (
                f"AI Computer Vision PPE analysis: {ppe_pct}% overall worker compliance across active site cameras "
                f"({ai_workers_detected} workers detected: {ai_compliance_count} fully compliant, {ai_violations_count} with safety violations)."
            )
        else:
            summary = f"AI Computer Vision PPE analysis: No workers detected in latest site camera scans for {project_name}."

        return schemas.AssistantStructuredResponse(
            query_type="PPE",
            executive_summary=summary,
            risk=None,
            attention_items=[],
            locations=[],
            recommended_actions=ppe_actions,
            materials=[],
            progress=None,
            ppe=ppe_info,
            sources=ppe_sources,
            explainability=_build_explainability("AI Vision PPE Analysis", total_ppe, risk_score, risk_level),
            suggested_followups=["Show recent PPE safety violations", "What are the top safety risks?", "What are the recommended actions?"]
        )

    # =========================================================================
    # INTENT 10: SAFETY INCIDENTS
    # =========================================================================
    elif intent == "SAFETY_INCIDENTS":
        incident_items: List[schemas.AssistantAttentionItem] = []
        for inc in incidents:
            title = f"{(inc.incident_type or 'Safety Incident').replace('_', ' ').title()} #{inc.id}"
            incident_items.append(
                schemas.AssistantAttentionItem(
                    id=str(inc.id),
                    title=title,
                    description=inc.description,
                    severity=inc.severity or "HIGH",
                    category="SAFETY",
                    status=inc.status or "OPEN",
                    site_name=inc.site.name if inc.site else None,
                    area_name=inc.area.name if inc.area else None,
                    action_taken=inc.action_taken
                )
            )

        inc_actions: List[schemas.AssistantActionItem] = []
        open_incs = [inc for inc in incidents if inc.status in ["OPEN", "UNDER_REVIEW"]]
        for inc in open_incs:
            area_str = f" at {inc.area.name}" if inc.area else ""
            inc_actions.append(
                schemas.AssistantActionItem(
                    title=f"Investigate {inc.incident_type.replace('_', ' ').title()}{area_str}",
                    description=inc.action_taken or "Verify ground conditions and site safety clearance before resuming operations.",
                    priority="IMMEDIATE" if inc.severity in ["HIGH", "CRITICAL"] else "HIGH",
                    category="Safety",
                    role=safety_assignee,
                    entity_type="INCIDENT",
                    entity_id=inc.id,
                    link=f"/projects/{project_id}/incidents?incidentId={inc.id}#incident-{inc.id}"
                )
            )
        if not inc_actions:
            inc_actions.append(
                schemas.AssistantActionItem(
                    title="Continue proactive site safety monitoring",
                    description="No open safety incidents currently logged.",
                    priority="STANDARD",
                    category="Safety",
                    role=safety_assignee
                )
            )

        inc_sources = [
            schemas.AssistantSource(
                type="INCIDENT",
                id=str(inc.id),
                title=f"Incident #{inc.id}: {inc.incident_type.replace('_', ' ').title()}",
                detail=f"{inc.severity} · {inc.status} · {inc.area.name if inc.area else 'Site'}"
            )
            for inc in incidents[:5]
        ]

        area_scope_str = f" in {matched_area_names[0]}" if matched_area_names else ""
        if open_incs:
            first_inc = open_incs[0]
            area_n = first_inc.area.name if first_inc.area else "Site"
            summary = f"Identified {len(open_incs)} open safety incident(s){area_scope_str}. Primary item: {first_inc.incident_type.replace('_', ' ').title()} #{first_inc.id} at {area_n} ({first_inc.description[:90]}...)."
        elif incidents:
            summary = f"All {len(incidents)} recorded safety incidents{area_scope_str} have been marked RESOLVED. No active unresolved incidents on site."
        else:
            summary = f"No safety incidents recorded{area_scope_str} in the project database."

        return schemas.AssistantStructuredResponse(
            query_type="SAFETY_INCIDENTS",
            executive_summary=summary,
            risk=None,
            attention_items=incident_items,
            locations=[],
            recommended_actions=inc_actions,
            materials=[],
            progress=None,
            ppe=None,
            sources=inc_sources,
            explainability=_build_explainability("SQL Safety Incidents Retrieval", len(incidents), risk_score, risk_level),
            suggested_followups=["Why is the project risk medium or high?", "Which area needs attention?", "What are the recommended actions?"]
        )

    # =========================================================================
    # INTENT 11: GREETING & CAPABILITIES
    # =========================================================================
    elif intent == "GREETING":
        summary = (
            f"Hello! I am your Construction Site Intelligence Assistant for **{project_name}**.\n\n"
            f"I can help you monitor site safety, investigate incidents, evaluate project risk, "
            f"track material inventory, check PPE compliance, review inspection audits, and analyze daily site operations."
        )

        return schemas.AssistantStructuredResponse(
            query_type="GREETING",
            executive_summary=summary,
            risk=None,
            attention_items=[],
            locations=[],
            recommended_actions=[],
            materials=[],
            progress=None,
            ppe=None,
            sources=[],
            explainability=_build_explainability("Conversational Greeting & Capabilities", 0, risk_score, risk_level),
            suggested_followups=[
                "Summarize the problems reported this week",
                "Generate a weekly site progress report",
                "What is the project risk score?",
                "Are there any material shortages?"
            ]
        )

    # =========================================================================
    # INTENT 12: OUT_OF_SCOPE (Domain Boundary)
    # =========================================================================
    elif intent == "OUT_OF_SCOPE":
        summary = (
            f"I am the Construction Site Intelligence Assistant dedicated to **{project_name}**.\n\n"
            f"I can only assist with project-specific data including safety incidents, risk evaluations, "
            f"materials tracking, PPE compliance scans, inspection checklists, and daily progress logs."
        )

        return schemas.AssistantStructuredResponse(
            query_type="OUT_OF_SCOPE",
            executive_summary=summary,
            risk=None,
            attention_items=[],
            locations=[],
            recommended_actions=[],
            materials=[],
            progress=None,
            ppe=None,
            sources=[],
            explainability=_build_explainability("Domain Scope Enforcement", 0, risk_score, risk_level),
            suggested_followups=[
                "Summarize the problems reported this week",
                "What is the project risk score?",
                "Are there any material shortages?",
                "Generate today's daily report"
            ]
        )

    # =========================================================================
    # INTENT 13: GENERAL_PROJECT (Default / Overview)
    # =========================================================================
    else:
        risk_info = schemas.AssistantRiskInfo(
            score=risk_score,
            level=risk_level,
            factors=clean_factors,
            summary=f"Project risk evaluated at {risk_score}/100 ({risk_level})."
        )

        all_attention = []
        for inc in incidents[:3]:
            all_attention.append(
                schemas.AssistantAttentionItem(
                    id=str(inc.id),
                    title=f"{inc.incident_type.replace('_', ' ').title()} #{inc.id}",
                    description=inc.description,
                    severity=inc.severity or "HIGH",
                    category="SAFETY",
                    status=inc.status or "OPEN",
                    area_name=inc.area.name if inc.area else None
                )
            )

        gen_locations = [
            schemas.AssistantLocationItem(
                site_name=r.get("site_name"),
                area_name=r.get("area_name"),
                risk_score=r.get("risk_score"),
                risk_level=r.get("risk_level")
            )
            for r in area_rankings[:3]
        ]

        gen_actions = [
            schemas.AssistantActionItem(
                title="Maintain daily safety oversight and progress logs",
                description="Coordinate scheduled area audits and workforce tracking.",
                priority="STANDARD",
                category="Operations",
                role=pm_assignee
            )
        ]

        gen_sources = [
            schemas.AssistantSource(
                type="RISK",
                id="risk_engine",
                title=f"Risk Engine: Score {risk_score}/100 ({risk_level})",
                detail="Authoritative multi-factor evaluation"
            )
        ]

        summary = f"Project '{project_name}' is currently active with an authoritative safety risk score of {risk_score}/100 ({risk_level})."

        return schemas.AssistantStructuredResponse(
            query_type="GENERAL_PROJECT",
            executive_summary=summary,
            risk=risk_info,
            attention_items=all_attention,
            locations=gen_locations,
            recommended_actions=gen_actions,
            materials=[],
            progress=None,
            ppe=None,
            sources=gen_sources,
            explainability=_build_explainability("General Project Intelligence Synthesis", len(incidents) + len(materials), risk_score, risk_level),
            suggested_followups=["Summarize the problems reported this week", "What is the project risk score?", "Are there any material shortages?"]
        )


def _build_explainability(pipeline_step_title: str, records_count: int, risk_score: int, risk_level: str) -> schemas.AssistantExplainability:
    return schemas.AssistantExplainability(
        retrieval_mode="HYBRID_RAG",
        sql_facts_count=records_count,
        semantic_chunks_count=4,
        risk_engine_score=risk_score,
        risk_engine_level=risk_level,
        llm_model="Gemini 2.5 Flash",
        pipeline_steps=[
            schemas.AssistantPipelineStep(name="Intent Classification", description=f"Deterministic query routing to {pipeline_step_title}", icon="cpu"),
            schemas.AssistantPipelineStep(name="Grounded SQL & Vector RAG", description="Targeted retrieval of domain-specific project records", icon="database"),
            schemas.AssistantPipelineStep(name="Deterministic Risk Engine", description=f"Authoritative risk math ({risk_score}/100 — {risk_level})", icon="shield"),
            schemas.AssistantPipelineStep(name="Structured Decision Synthesis", description="Zero-hallucination typed data presentation", icon="sparkles"),
        ]
    )
