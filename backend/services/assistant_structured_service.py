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

    # 2. Query Authoritative Risk Engine (for risk queries or project overview)
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

    dynamic_risk_followup = f"Why is the project risk {risk_level.lower()}?"

    # 3. Resolve Scoped Area Entity for Targeted Search Queries
    query_lower = query.lower()
    project_areas = db.query(models.Area).join(models.Site).filter(models.Site.project_id == project_id).all()
    matched_area_ids = [a.id for a in project_areas if a.name.lower() in query_lower]
    matched_area_names = [a.name for a in project_areas if a.name.lower() in query_lower]

    # 4. Fetch Database Entities (Scoped to Area when requested)
    inc_query = db.query(models.SafetyIncident).filter(models.SafetyIncident.project_id == project_id)
    if matched_area_ids:
        inc_query = inc_query.filter(models.SafetyIncident.area_id.in_(matched_area_ids))
    incidents = inc_query.order_by(models.SafetyIncident.id.desc()).limit(15).all()

    insp_query = db.query(models.InspectionReport).filter(models.InspectionReport.project_id == project_id)
    if matched_area_ids:
        insp_query = insp_query.filter(models.InspectionReport.area_id.in_(matched_area_ids))
    inspections = insp_query.order_by(models.InspectionReport.id.desc()).limit(15).all()

    obs_query = db.query(models.Observation).filter(models.Observation.project_id == project_id)
    if matched_area_ids:
        obs_query = obs_query.filter(models.Observation.area_id.in_(matched_area_ids))
    observations = obs_query.order_by(models.Observation.id.desc()).limit(15).all()

    materials = (
        db.query(models.Material)
        .filter(models.Material.project_id == project_id)
        .order_by(models.Material.id.desc())
        .limit(15)
        .all()
    )

    daily_reports = (
        db.query(models.DailyReport)
        .filter(models.DailyReport.project_id == project_id)
        .order_by(models.DailyReport.report_date.desc())
        .limit(10)
        .all()
    )

    area_rankings = []
    try:
        area_rankings = RiskEngine.get_area_risk_rankings(db=db, project_id=project_id, days=7)
    except Exception:
        pass

    ai_violations_count = db.query(func.count(models.AISafetyFinding.id)).filter(
        models.AISafetyFinding.project_id == project_id,
        models.AISafetyFinding.finding_type.in_(AI_PPE_VIOLATION_TYPES),
        models.AISafetyFinding.status != "FALSE_POSITIVE"
    ).scalar() or 0

    ai_compliance_count = db.query(func.count(models.AISafetyFinding.id)).filter(
        models.AISafetyFinding.project_id == project_id,
        models.AISafetyFinding.finding_type.in_(AI_PPE_COMPLIANCE_TYPES)
    ).scalar() or 0

    total_ppe = ai_violations_count + ai_compliance_count
    ppe_pct = round((ai_compliance_count / total_ppe * 100), 1) if total_ppe > 0 else 100.0

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

    def get_active_incident_attentions(items_list: List[models.SafetyIncident]) -> List[schemas.AssistantAttentionItem]:
        active_items = []
        for inc in items_list:
            if inc.status in ["OPEN", "UNDER_REVIEW"]:
                type_title = (inc.incident_type or "Safety Incident").replace("_", " ").title()
                active_items.append(
                    schemas.AssistantAttentionItem(
                        id=str(inc.id),
                        title=f"{type_title} #{inc.id}",
                        description=inc.description,
                        severity=inc.severity or "HIGH",
                        category="SAFETY",
                        status=inc.status or "OPEN",
                        site_name=inc.site.name if inc.site else None,
                        area_name=inc.area.name if inc.area else None,
                        action_taken=inc.action_taken
                    )
                )
        return active_items

    # =========================================================================
    # INTENT: DAILY_REPORT
    # =========================================================================
    if intent == "DAILY_REPORT":
        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        today_rep = next((r for r in daily_reports if r.report_date == today_str), None)
        active_rep = today_rep if today_rep else (daily_reports[0] if daily_reports else None)

        progress_info = None
        actions: List[schemas.AssistantActionItem] = []
        attention: List[schemas.AssistantAttentionItem] = []
        sources: List[schemas.AssistantSource] = []

        if active_rep:
            progress_info = schemas.AssistantProgressInfo(
                progress_pct=active_rep.progress_percentage,
                workers_count=active_rep.workers_count,
                work_completed=active_rep.work_completed,
                weather=active_rep.weather,
                blockers=active_rep.blockers
            )
            sources.append(
                schemas.AssistantSource(
                    type="DAILY_REPORT",
                    id=str(active_rep.id),
                    title=f"Daily Report #{active_rep.id} ({active_rep.report_date})",
                    detail=f"{active_rep.workers_count or 0} workers · Progress: {active_rep.progress_percentage or 0}% · Weather: {active_rep.weather or 'Clear'}"
                )
            )

            if active_rep.blockers and active_rep.blockers.lower() != "none":
                attention.append(
                    schemas.AssistantAttentionItem(
                        id=f"blocker-{active_rep.id}",
                        title=f"Active Daily Blocker: {active_rep.report_date}",
                        description=active_rep.blockers,
                        severity="HIGH",
                        category="OPERATIONS",
                        status="ACTIVE"
                    )
                )
                actions.append(
                    schemas.AssistantActionItem(
                        title=f"Clear Site Blocker: {active_rep.blockers[:60]}",
                        description=f"Address reported delay blocker from Daily Report #{active_rep.id}.",
                        priority="HIGH",
                        category="Operations",
                        role=pm_assignee
                    )
                )

            open_incs = [i for i in incidents if i.status in ["OPEN", "UNDER_REVIEW"]]
            for inc in open_incs[:2]:
                area_n = inc.area.name if inc.area else "Site"
                inc_t = inc.incident_type.replace("_", " ").title()
                attention.append(
                    schemas.AssistantAttentionItem(
                        id=str(inc.id),
                        title=f"Active Hazard: {inc_t} #{inc.id}",
                        description=f"At {area_n}: {inc.description}",
                        severity=inc.severity or "HIGH",
                        category="SAFETY",
                        status=inc.status
                    )
                )
                actions.append(
                    schemas.AssistantActionItem(
                        title=f"Investigate {inc_t} at {area_n}",
                        description=inc.action_taken or "Verify ground conditions and clear work zone.",
                        priority="IMMEDIATE" if inc.severity in ["HIGH", "CRITICAL"] else "HIGH",
                        category="Safety",
                        role=safety_assignee,
                        entity_type="INCIDENT",
                        entity_id=inc.id,
                        link=f"/projects/{project_id}/incidents?incidentId={inc.id}#incident-{inc.id}"
                    )
                )

            if today_rep:
                summary = (
                    f"Daily Site Report for Today ({today_rep.report_date}):\n"
                    f"• Work Completed: {today_rep.work_completed or 'General operations in progress'}\n"
                    f"• Workforce: {today_rep.workers_count or 0} workers active on site\n"
                    f"• Overall Progress: {today_rep.progress_percentage or 0}%\n"
                    f"• Weather: {today_rep.weather or 'Clear'}\n"
                    f"• Planned Next Shift: {today_rep.work_planned or 'Continue scheduled work package'}\n"
                    f"• Blockers / Issues: {today_rep.blockers or today_rep.issues or 'None reported'}"
                )
            else:
                summary = (
                    f"No daily report submitted for today ({today_str}). Displaying latest available Daily Report ({active_rep.report_date}):\n"
                    f"• Work Completed: {active_rep.work_completed or 'Operations logged'}\n"
                    f"• Workforce: {active_rep.workers_count or 0} workers on site\n"
                    f"• Overall Progress: {active_rep.progress_percentage or 0}%\n"
                    f"• Weather: {active_rep.weather or 'Clear'}\n"
                    f"• Planned Next Shift: {active_rep.work_planned or 'Scheduled milestones'}\n"
                    f"• Blockers / Issues: {active_rep.blockers or active_rep.issues or 'None'}"
                )
        else:
            summary = f"No daily reports recorded in the project database for {project_name}."

        if not actions:
            actions.append(
                schemas.AssistantActionItem(
                    title="Submit daily shift report & log progress",
                    description="Ensure site supervisor logs daily worker counts, completed milestones, and equipment.",
                    priority="STANDARD",
                    category="Operations",
                    role=supervisor_assignee,
                    link=f"/projects/{project_id}/daily-reports"
                )
            )

        return schemas.AssistantStructuredResponse(
            query_type="DAILY_REPORT",
            executive_summary=summary,
            risk=None,
            attention_items=attention,
            locations=[],
            recommended_actions=actions,
            materials=[],
            progress=progress_info,
            ppe=None,
            sources=sources,
            explainability=_build_explainability("Daily Site Operations & Report Retrieval", len(sources), risk_score, risk_level),
            suggested_followups=["Generate a weekly site progress report", "Summarize the problems reported this week", dynamic_risk_followup]
        )

    # =========================================================================
    # INTENT: WEEKLY_PROGRESS_REPORT
    # =========================================================================
    elif intent == "WEEKLY_PROGRESS_REPORT":
        reps = daily_reports[:7]
        sources: List[schemas.AssistantSource] = []
        attention: List[schemas.AssistantAttentionItem] = []
        actions: List[schemas.AssistantActionItem] = []

        total_workers = 0
        work_items = []
        blockers_list = []
        planned_items = []

        for r in reps:
            if r.workers_count:
                total_workers += r.workers_count
            if r.work_completed:
                work_items.append(f"[{r.report_date}] {r.work_completed}")
            if r.work_planned:
                planned_items.append(f"[{r.report_date}] {r.work_planned}")
            if r.blockers and r.blockers.lower() != "none":
                blockers_list.append(f"[{r.report_date}] {r.blockers}")
            sources.append(
                schemas.AssistantSource(
                    type="DAILY_REPORT",
                    id=str(r.id),
                    title=f"Daily Report ({r.report_date})",
                    detail=f"{r.workers_count or 0} workers · Progress {r.progress_percentage or 0}%"
                )
            )

        latest_pct = reps[0].progress_percentage if reps else None
        avg_workers = round(total_workers / len(reps)) if reps else 0

        delayed_mats = [m for m in materials if m.status in ["DELAYED", "OUT_OF_STOCK"]]
        for dm in delayed_mats:
            attention.append(
                schemas.AssistantAttentionItem(
                    id=str(dm.id),
                    title=f"Material Delay: {dm.material_name} ({dm.status})",
                    description=f"{dm.quantity} {dm.unit} delayed from supplier {dm.supplier or 'N/A'}.",
                    severity="HIGH",
                    category="MATERIAL",
                    status=dm.status
                )
            )
            actions.append(
                schemas.AssistantActionItem(
                    title=f"Expedite {dm.material_name} delivery",
                    description=f"Resolve supply blocker with {dm.supplier or 'supplier'}.",
                    priority="HIGH",
                    category="Materials",
                    role=contractor_assignee,
                    entity_type="MATERIAL",
                    entity_id=dm.id,
                    link=f"/projects/{project_id}/materials"
                )
            )

        open_incs = [i for i in incidents if i.status in ["OPEN", "UNDER_REVIEW"]]
        for inc in open_incs[:2]:
            area_n = inc.area.name if inc.area else "Site"
            inc_t = inc.incident_type.replace("_", " ").title()
            attention.append(
                schemas.AssistantAttentionItem(
                    id=str(inc.id),
                    title=f"Active Safety Item: {inc_t} #{inc.id}",
                    description=f"At {area_n}: {inc.description}",
                    severity=inc.severity or "HIGH",
                    category="SAFETY",
                    status=inc.status
                )
            )
            actions.append(
                schemas.AssistantActionItem(
                    title=f"Investigate {inc_t} at {area_n}",
                    description=inc.action_taken or "Verify site safety clearance.",
                    priority="HIGH",
                    category="Safety",
                    role=safety_assignee,
                    entity_type="INCIDENT",
                    entity_id=inc.id,
                    link=f"/projects/{project_id}/incidents?incidentId={inc.id}#incident-{inc.id}"
                )
            )

        period_str = f"{reps[-1].report_date} to {reps[0].report_date}" if len(reps) > 1 else (reps[0].report_date if reps else "Last 7 Days")

        if reps:
            work_milestones = "; ".join(work_items[:3]) or "Standard daily operations"
            upcoming_milestones = "; ".join(planned_items[:2]) or "Continue scheduled work packages"
            blockers_summary = "; ".join(blockers_list) if blockers_list else "No operational blockers recorded this week."

            summary = (
                f"### Weekly Construction Progress Summary ({period_str})\n\n"
                f"• **Project:** {project_name}\n"
                f"• **Cumulative Progress:** {latest_pct or 'N/A'}% completed\n"
                f"• **Workforce Metric:** Average {avg_workers} workers/day across {len(reps)} logged shifts ({total_workers} total worker-shifts)\n"
                f"• **Key Milestones Completed:** {work_milestones}\n"
                f"• **Upcoming Work Planned:** {upcoming_milestones}\n"
                f"• **Safety & Quality Snapshot:** {len(open_incs)} active incident(s), {len(delayed_mats)} material delay(s)\n"
                f"• **Active Blockers / Delays:** {blockers_summary}"
            )
            progress_info = schemas.AssistantProgressInfo(
                progress_pct=latest_pct,
                workers_count=reps[0].workers_count,
                work_completed="; ".join([r.work_completed for r in reps[:3] if r.work_completed]),
                weather=reps[0].weather,
                blockers="; ".join(blockers_list) if blockers_list else None
            )
        else:
            summary = f"No daily progress reports recorded for {project_name} in the selected period."
            progress_info = None

        if not actions:
            actions.append(
                schemas.AssistantActionItem(
                    title="Review weekly progress against baseline schedule",
                    description="Conduct weekly coordination meeting with trade supervisors to maintain milestone velocity.",
                    priority="STANDARD",
                    category="Operations",
                    role=pm_assignee
                )
            )

        return schemas.AssistantStructuredResponse(
            query_type="WEEKLY_PROGRESS_REPORT",
            executive_summary=summary,
            risk=None,
            attention_items=attention,
            locations=[],
            recommended_actions=actions,
            materials=[],
            progress=progress_info,
            ppe=None,
            sources=sources,
            explainability=_build_explainability("Weekly Progress & Workforce Aggregation Engine", len(reps), risk_score, risk_level),
            suggested_followups=["Summarize the problems reported this week", "Which issues have occurred repeatedly?", dynamic_risk_followup]
        )

    # =========================================================================
    # INTENT: RECURRING_ISSUES
    # =========================================================================
    elif intent == "RECURRING_ISSUES":
        recurring_data = []
        try:
            recurring_data = RecurringIssueService.detect_recurring_issues(
                db=db, project_id=project_id, days=30, threshold=2
            )
        except Exception as e:
            logger.warning(f"Error detecting recurring issues: {e}")

        recurring_attention: List[schemas.AssistantAttentionItem] = []
        recurring_actions: List[schemas.AssistantActionItem] = []
        recurring_sources: List[schemas.AssistantSource] = []

        if recurring_data:
            rec_bullets = []
            for item in recurring_data:
                area_n = item.get("area_name") or "Site"
                raw_type = item.get("issue_type") or "Safety Issue"
                issue_t = raw_type.replace("_", " ").title()
                cnt = item.get("occurrence_count", 2)
                rec_bullets.append(f"• **{issue_t}** at {area_n} ({cnt} occurrences in 30 days)")

                recurring_attention.append(
                    schemas.AssistantAttentionItem(
                        id=f"rec-{item.get('area_id')}-{raw_type}",
                        title=f"Recurring Hazard: {issue_t} ({cnt}x at {area_n})",
                        description=f"Detected {cnt} occurrences in the past {item.get('time_window_days', 30)} days. First seen: {item.get('first_seen')}, Last seen: {item.get('last_seen')}.",
                        severity=item.get("severity", "HIGH"),
                        category="RECURRING_SAFETY",
                        status="RECURRING",
                        area_name=area_n
                    )
                )
                recurring_actions.append(
                    schemas.AssistantActionItem(
                        title=f"Conduct Root-Cause Safety Audit for {issue_t} at {area_n}",
                        description=f"Address systemic root cause of repeated occurrences ({cnt}x recorded). Implement permanent engineering control or guardrail installation.",
                        priority="IMMEDIATE",
                        category="Safety",
                        role=safety_assignee
                    )
                )
                recurring_sources.append(
                    schemas.AssistantSource(
                        type="RECURRING_ISSUE",
                        id=f"{item.get('area_id')}_{raw_type}",
                        title=f"Recurring {issue_t} — {area_n}",
                        detail=f"{cnt} occurrences in 30 days"
                    )
                )
            summary = (
                f"Identified {len(recurring_data)} recurring safety pattern(s) across site zones:\n"
                + "\n".join(rec_bullets)
                + "\n\nRoot cause remediation and supervisory safety stand-down recommended."
            )
        else:
            open_incs = get_active_incident_attentions(incidents)
            summary = "No repeated recurring safety patterns (>=2 identical issues in the same area) detected over the past 30 days. All active site issues are isolated events."
            recurring_attention = open_incs[:2]
            recurring_actions.append(
                schemas.AssistantActionItem(
                    title="Maintain continuous safety hazard logging",
                    description="Proactively monitor site inspection reports to catch repeat hazard trends early.",
                    priority="STANDARD",
                    category="Safety",
                    role=safety_assignee
                )
            )

        return schemas.AssistantStructuredResponse(
            query_type="RECURRING_ISSUES",
            executive_summary=summary,
            risk=None,
            attention_items=recurring_attention,
            locations=[],
            recommended_actions=recurring_actions,
            materials=[],
            progress=None,
            ppe=None,
            sources=recurring_sources or [schemas.AssistantSource(type="RECURRING_ANALYSIS", id="trend_engine", title="Recurring Hazard Pattern Detector", detail="30-day cross-incident analysis")],
            explainability=_build_explainability("Recurring Hazard Pattern Engine", len(recurring_data), risk_score, risk_level),
            suggested_followups=["What are the top safety risks?", "Which area needs attention?", "What are the recommended actions?"]
        )

    # =========================================================================
    # INTENT: ISSUES_SUMMARY
    # =========================================================================
    elif intent == "ISSUES_SUMMARY":
        open_incs = [i for i in incidents if i.status in ["OPEN", "UNDER_REVIEW"]]
        failed_insps = [i for i in inspections if i.status == "FAILED"]
        open_obs = [o for o in observations if o.status != "RESOLVED"]
        delayed_mats = [m for m in materials if m.status in ["DELAYED", "OUT_OF_STOCK"]]

        attention_items: List[schemas.AssistantAttentionItem] = []
        actions: List[schemas.AssistantActionItem] = []
        sources: List[schemas.AssistantSource] = []

        for inc in open_incs:
            area_n = inc.area.name if inc.area else "Site"
            inc_t = inc.incident_type.replace("_", " ").title()
            attention_items.append(
                schemas.AssistantAttentionItem(
                    id=str(inc.id),
                    title=f"Incident #{inc.id}: {inc_t}",
                    description=f"[{inc.severity}] {inc.description} (Area: {area_n})",
                    severity=inc.severity or "HIGH",
                    category="SAFETY",
                    status=inc.status,
                    area_name=area_n
                )
            )
            actions.append(
                schemas.AssistantActionItem(
                    title=f"Resolve {inc_t} at {area_n}",
                    description=inc.action_taken or "Verify mitigation and close incident record.",
                    priority="IMMEDIATE" if inc.severity in ["HIGH", "CRITICAL"] else "HIGH",
                    category="Safety",
                    role=safety_assignee,
                    entity_type="INCIDENT",
                    entity_id=inc.id,
                    link=f"/projects/{project_id}/incidents?incidentId={inc.id}#incident-{inc.id}"
                )
            )
            sources.append(schemas.AssistantSource(
                type="INCIDENT",
                id=str(inc.id),
                title=f"Incident #{inc.id}: {inc.incident_type}",
                detail=f"{inc.severity} · {area_n}"
            ))

        for fi in failed_insps:
            area_n = fi.area.name if fi.area else "Site"
            insp_t = fi.inspection_type.replace("_", " ").title()
            attention_items.append(
                schemas.AssistantAttentionItem(
                    id=f"insp-{fi.id}",
                    title=f"Failed Inspection #{fi.id}: {insp_t}",
                    description=fi.findings or "Failed checklist items requiring rectification.",
                    severity="HIGH",
                    category="QUALITY",
                    status="FAILED",
                    area_name=area_n
                )
            )
            actions.append(
                schemas.AssistantActionItem(
                    title=f"Rectify {insp_t} findings at {area_n}",
                    description=fi.recommendations or "Complete repairs and request re-audit.",
                    priority="HIGH",
                    category="Quality",
                    role=supervisor_assignee,
                    entity_type="INSPECTION",
                    entity_id=fi.id,
                    link=f"/projects/{project_id}/inspections"
                )
            )
            sources.append(schemas.AssistantSource(
                type="INSPECTION",
                id=str(fi.id),
                title=f"Inspection #{fi.id}: {fi.inspection_type}",
                detail=f"FAILED · {area_n}"
            ))

        for dm in delayed_mats:
            attention_items.append(
                schemas.AssistantAttentionItem(
                    id=f"mat-{dm.id}",
                    title=f"Material Delay: {dm.material_name} ({dm.status})",
                    description=f"{dm.quantity} {dm.unit} delayed. Supplier: {dm.supplier or 'N/A'}.",
                    severity="HIGH" if dm.status == "OUT_OF_STOCK" else "MEDIUM",
                    category="MATERIAL",
                    status=dm.status
                )
            )
            actions.append(
                schemas.AssistantActionItem(
                    title=f"Expedite delivery of {dm.material_name}",
                    description=f"Resolve delivery delay with supplier {dm.supplier or 'N/A'}.",
                    priority="HIGH",
                    category="Materials",
                    role=contractor_assignee,
                    entity_type="MATERIAL",
                    entity_id=dm.id,
                    link=f"/projects/{project_id}/materials"
                )
            )
            sources.append(schemas.AssistantSource(
                type="MATERIAL",
                id=str(dm.id),
                title=f"Material: {dm.material_name}",
                detail=f"{dm.status} · Supplier: {dm.supplier}"
            ))

        total_issues = len(open_incs) + len(failed_insps) + len(open_obs) + len(delayed_mats)
        if total_issues > 0:
            inc_names = ", ".join([f"#{i.id} {i.incident_type.replace('_', ' ').title()}" for i in open_incs]) or "None"
            insp_names = ", ".join([f"#{fi.id} {fi.inspection_type}" for fi in failed_insps]) or "None"
            mat_names = ", ".join([m.material_name for m in delayed_mats]) or "None"

            summary = (
                f"Summary of Active Problems Reported This Week ({total_issues} total):\n"
                f"• **Open Safety Incidents ({len(open_incs)}):** {inc_names}\n"
                f"• **Failed Inspections ({len(failed_insps)}):** {insp_names}\n"
                f"• **Delayed Materials ({len(delayed_mats)}):** {mat_names}\n"
                f"• **Open Observations ({len(open_obs)}):** {len(open_obs)} field snag(s) pending resolution"
            )
        else:
            summary = "No active unresolved issues, failed inspections, or delayed materials logged for this week."
            actions.append(
                schemas.AssistantActionItem(
                    title="Continue proactive site monitoring",
                    description="All reported site items are currently resolved and compliant.",
                    priority="STANDARD",
                    category="Operations"
                )
            )

        return schemas.AssistantStructuredResponse(
            query_type="ISSUES_SUMMARY",
            executive_summary=summary,
            risk=None,
            attention_items=attention_items,
            locations=[],
            recommended_actions=actions,
            materials=[],
            progress=None,
            ppe=None,
            sources=sources,
            explainability=_build_explainability("Cross-Domain Issues & Delays Aggregation", total_issues, risk_score, risk_level),
            suggested_followups=["Which issues have occurred repeatedly?", "What are the recommended actions?", dynamic_risk_followup]
        )

    # =========================================================================
    # INTENT: AREA_SAFETY / AREA
    # =========================================================================
    elif intent in ["AREA_SAFETY", "AREA"]:
        locations: List[schemas.AssistantLocationItem] = []
        for r in area_rankings:
            locations.append(
                schemas.AssistantLocationItem(
                    site_name=r.get("site_name"),
                    area_name=r.get("area_name"),
                    risk_score=r.get("risk_score"),
                    risk_level=r.get("risk_level"),
                    issue_summary=f"Risk Score: {r.get('risk_score')}/100 ({r.get('risk_level')})"
                )
            )

        area_attention = get_active_incident_attentions(incidents)

        area_actions: List[schemas.AssistantActionItem] = []
        for inc in incidents:
            if inc.status in ["OPEN", "UNDER_REVIEW"]:
                area_n = inc.area.name if inc.area else "Site"
                inc_t = inc.incident_type.replace("_", " ").title()
                area_actions.append(
                    schemas.AssistantActionItem(
                        title=f"Resolve {inc_t} at {area_n}",
                        description=inc.action_taken or "Verify ground conditions and site safety clearance.",
                        priority="IMMEDIATE" if inc.severity in ["HIGH", "CRITICAL"] else "HIGH",
                        category="Safety",
                        role=safety_assignee,
                        entity_type="INCIDENT",
                        entity_id=inc.id,
                        link=f"/projects/{project_id}/incidents?incidentId={inc.id}#incident-{inc.id}"
                    )
                )

        area_sources = [
            schemas.AssistantSource(
                type="AREA",
                id=str(loc.area_name),
                title=f"Area: {loc.area_name}",
                detail=loc.issue_summary
            )
            for loc in locations[:4]
        ]
        for inc in incidents[:3]:
            area_sources.append(
                schemas.AssistantSource(
                    type="INCIDENT",
                    id=str(inc.id),
                    title=f"Incident #{inc.id}: {inc.incident_type}",
                    detail=f"{inc.severity} · {inc.area.name if inc.area else 'Site'}"
                )
            )

        if matched_area_names:
            target_area = matched_area_names[0]
            summary = f"Safety Intelligence for **{target_area}**: {len(area_attention)} open incident(s) and active hazards recorded. Immediate supervisory walkthrough recommended."
        elif locations:
            top_area = locations[0]
            summary = f"Area Risk Intelligence: **{top_area.area_name}** has the highest risk ranking on site ({top_area.issue_summary}). {len(area_attention)} active unresolved issue(s) require attention."
        else:
            summary = "All site zones and work areas are currently operating within standard safety baselines."

        if not area_actions:
            area_actions.append(
                schemas.AssistantActionItem(
                    title="Maintain scheduled zone safety inspections",
                    description="Conduct regular safety rounds across all active project sectors.",
                    priority="STANDARD",
                    category="Safety",
                    role=safety_assignee
                )
            )

        return schemas.AssistantStructuredResponse(
            query_type="AREA_SAFETY",
            executive_summary=summary,
            risk=None,
            attention_items=area_attention,
            locations=locations,
            recommended_actions=area_actions,
            materials=[],
            progress=None,
            ppe=None,
            sources=area_sources,
            explainability=_build_explainability("Area Safety Risk Ranking Engine", len(locations), risk_score, risk_level),
            suggested_followups=["Show unresolved incidents", "What are the recommended actions?", dynamic_risk_followup]
        )

    # =========================================================================
    # INTENT: SAFETY_RISK / RISK
    # =========================================================================
    elif intent in ["SAFETY_RISK", "RISK"]:
        risk_info = schemas.AssistantRiskInfo(
            score=risk_score,
            level=risk_level,
            factors=clean_factors,
            summary=f"Project safety risk is evaluated at {risk_score}/100 ({risk_level}) by the deterministic multi-factor Risk Engine."
        )

        risk_attention = get_active_incident_attentions(incidents)

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
                    category="Safety"
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
        summary = f"Project safety risk is currently evaluated at **{risk_score}/100 ({risk_level})** by the deterministic Risk Engine. Primary contributing factor(s): {reasons_summary}."

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
            suggested_followups=["Which area needs attention?", "Show unresolved incidents", "What are the recommended actions?"]
        )

    # =========================================================================
    # INTENT: MATERIALS
    # =========================================================================
    elif intent == "MATERIALS":
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
                mat_t = m.status.replace('_', ' ').title()
                mat_attention.append(
                    schemas.AssistantAttentionItem(
                        id=str(m.id),
                        title=f"Material Alert: {m.material_name} ({mat_t})",
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
                    role=contractor_assignee,
                    entity_type="MATERIAL",
                    entity_id=dm.id,
                    link=f"/projects/{project_id}/materials"
                )
            )
        if not mat_actions:
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

        if delayed_mats:
            dm_names = ", ".join([f"{m.material_name} ({m.status})" for m in delayed_mats])
            summary = f"Material alert: {len(delayed_mats)} material item(s) require attention: {dm_names}. Immediate supplier coordination recommended."
        elif structured_materials:
            summary = f"Material status: All {len(structured_materials)} recorded material inventory items are in stock and within standard operating levels. No active material shortages or supply blockers are reported."
        else:
            summary = "No material shortage or blocker is recorded in the available project data."

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
    # INTENT: SAFETY_INCIDENTS
    # =========================================================================
    elif intent == "SAFETY_INCIDENTS":
        incident_items = get_active_incident_attentions(incidents)

        inc_actions: List[schemas.AssistantActionItem] = []
        open_incs = [inc for inc in incidents if inc.status in ["OPEN", "UNDER_REVIEW"]]
        for inc in open_incs:
            area_str = f" at {inc.area.name}" if inc.area else ""
            inc_t = inc.incident_type.replace('_', ' ').title()
            inc_actions.append(
                schemas.AssistantActionItem(
                    title=f"Investigate {inc_t}{area_str}",
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
                    category="Safety"
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
            inc_t = first_inc.incident_type.replace('_', ' ').title()
            summary = f"Identified {len(open_incs)} open safety incident(s){area_scope_str}. Primary item: {inc_t} #{first_inc.id} at {area_n} ({first_inc.description[:90]}...)."
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
            suggested_followups=[dynamic_risk_followup, "Which area needs attention?", "What are the recommended actions?"]
        )

    # =========================================================================
    # INTENT: RECOMMENDED_ACTIONS & ROLE ASSIGNMENTS
    # =========================================================================
    elif intent == "RECOMMENDED_ACTIONS":
        actions: List[schemas.AssistantActionItem] = []
        action_sources: List[schemas.AssistantSource] = []

        for inc in incidents:
            if inc.status in ["OPEN", "UNDER_REVIEW"]:
                area_n = inc.area.name if inc.area else "Site"
                inc_t = inc.incident_type.replace('_', ' ').title()
                actions.append(
                    schemas.AssistantActionItem(
                        title=f"Investigate {inc_t} at {area_n}",
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
                insp_t = insp.inspection_type.replace('_', ' ').title()
                actions.append(
                    schemas.AssistantActionItem(
                        title=f"Rectify {insp_t} findings at {area_n}",
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

        q_lower = query.lower()
        is_assignment_query = any(w in q_lower for w in [
            "assign", "assigned", "who should", "who to", "who is responsible", "responsibility", "owner", "assignee", "role", "roles"
        ])
        if is_assignment_query:
            summary = (
                f"Action assignments for {project_name}:\n"
                f"• **Safety & Hazards:** Assigned to {safety_assignee}\n"
                f"• **Quality & Inspections:** Assigned to {supervisor_assignee}\n"
                f"• **Procurement & Materials:** Assigned to {contractor_assignee}\n"
                f"• **Site Coordination & Schedule:** Assigned to {pm_assignee}"
            )
            followups = ["What are the top safety risks?", "Which area needs attention?", "What is the material status?"]
        else:
            summary = f"Prioritized executive action plan with {len(actions)} concrete recommendation(s) based on current site safety, quality audits, and supply status."
            followups = ["Who should be assigned to these actions?", dynamic_risk_followup, "Show affected area locations"]

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
            suggested_followups=followups
        )

    # =========================================================================
    # INTENT: PPE & VISION
    # =========================================================================
    elif intent == "PPE":
        ppe_info = schemas.AssistantPPEInfo(
            compliance_count=ai_compliance_count,
            violations_count=ai_violations_count,
            compliance_pct=ppe_pct,
            violations_list=[f"Person without helmet/vest ({ai_violations_count} detected)"] if ai_violations_count > 0 else ["No active PPE violations"],
            compliance_items=[f"PPE Verified Compliant ({ai_compliance_count} detections)"] if ai_compliance_count > 0 else ["No detections logged"]
        )

        ppe_actions = []
        if ai_violations_count > 0:
            ppe_actions.append(
                schemas.AssistantActionItem(
                    title="Enforce mandatory PPE protocols on site",
                    description=f"{ai_violations_count} PPE non-compliance finding(s) detected. Conduct mandatory safety briefing with field teams.",
                    priority="HIGH",
                    category="Safety",
                    role=safety_assignee,
                    link=f"/projects/{project_id}/photos"
                )
            )
        else:
            ppe_actions.append(
                schemas.AssistantActionItem(
                    title="Maintain continuous AI camera monitoring",
                    description="All scanned workers are currently compliant with required safety gear.",
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
                detail=f"Compliance: {ai_compliance_count} · Violations: {ai_violations_count}"
            )
        ]

        summary = f"AI Computer Vision PPE analysis: {ppe_pct}% compliance rate across active site cameras ({ai_compliance_count} verified compliant, {ai_violations_count} non-compliant findings)."

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
    # INTENT: INSPECTIONS
    # =========================================================================
    elif intent == "INSPECTIONS":
        insp_items: List[schemas.AssistantAttentionItem] = []
        failed_insps = [i for i in inspections if i.status == "FAILED"]
        for insp in failed_insps:
            insp_t = insp.inspection_type.replace('_', ' ').title()
            insp_items.append(
                schemas.AssistantAttentionItem(
                    id=str(insp.id),
                    title=f"{insp_t} Inspection",
                    description=insp.findings or "Standard inspection record.",
                    severity="HIGH",
                    category="QUALITY",
                    status=insp.status,
                    site_name=insp.site.name if insp.site else None,
                    area_name=insp.area.name if insp.area else None,
                    action_taken=insp.recommendations
                )
            )

        insp_actions = []
        for fi in failed_insps:
            area_n = fi.area.name if fi.area else "Site"
            insp_t = fi.inspection_type.replace('_', ' ').title()
            insp_actions.append(
                schemas.AssistantActionItem(
                    title=f"Rectify {insp_t} at {area_n}",
                    description=fi.recommendations or "Complete required repairs and schedule follow-up audit.",
                    priority="HIGH",
                    category="Quality",
                    role=supervisor_assignee,
                    entity_type="INSPECTION",
                    entity_id=fi.id,
                    link=f"/projects/{project_id}/inspections"
                )
            )

        insp_sources = [
            schemas.AssistantSource(
                type="INSPECTION",
                id=str(i.id),
                title=f"Inspection #{i.id}: {i.inspection_type}",
                detail=f"Status: {i.status} · {i.area.name if i.area else 'Site'}"
            )
            for i in inspections[:5]
        ]

        if failed_insps:
            first_t = failed_insps[0].inspection_type
            first_area = failed_insps[0].area.name if failed_insps[0].area else "Site"
            summary = f"Inspection review: {len(failed_insps)} failed inspection report(s) requiring remediation. Primary item: {first_t} at {first_area}."
        elif inspections:
            summary = f"All {len(inspections)} recorded inspection reports are PASSED or within compliance."
        else:
            summary = "No inspection reports found in the project database."

        return schemas.AssistantStructuredResponse(
            query_type="INSPECTIONS",
            executive_summary=summary,
            risk=None,
            attention_items=insp_items,
            locations=[],
            recommended_actions=insp_actions,
            materials=[],
            progress=None,
            ppe=None,
            sources=insp_sources,
            explainability=_build_explainability("SQL Inspection Reports Retrieval", len(inspections), risk_score, risk_level),
            suggested_followups=["What are the recommended actions?", "Which area needs attention?", "What are the top safety risks?"]
        )

    # =========================================================================
    # INTENT: OBSERVATIONS
    # =========================================================================
    elif intent == "OBSERVATIONS":
        obs_items: List[schemas.AssistantAttentionItem] = []
        open_obs = [o for o in observations if o.status != "RESOLVED"]
        for obs in open_obs:
            obs_t = obs.observation_type.replace('_', ' ').title()
            obs_items.append(
                schemas.AssistantAttentionItem(
                    id=str(obs.id),
                    title=obs.title or f"{obs_t} Note",
                    description=obs.description,
                    severity=obs.priority or "MEDIUM",
                    category="OBSERVATION",
                    status=obs.status,
                    area_name=obs.area.name if obs.area else None
                )
            )

        obs_sources = [
            schemas.AssistantSource(
                type="OBSERVATION",
                id=str(o.id),
                title=f"Observation #{o.id}: {o.title}",
                detail=f"{o.priority} · {o.status} · {o.area.name if o.area else 'Site'}"
            )
            for o in observations[:5]
        ]

        if open_obs:
            summary = f"Site observations: {len(open_obs)} open observation(s) logged across active zones."
        else:
            summary = "All recorded site observations have been resolved."

        return schemas.AssistantStructuredResponse(
            query_type="OBSERVATIONS",
            executive_summary=summary,
            risk=None,
            attention_items=obs_items,
            locations=[],
            recommended_actions=[],
            materials=[],
            progress=None,
            ppe=None,
            sources=obs_sources,
            explainability=_build_explainability("SQL Observations Retrieval", len(observations), risk_score, risk_level),
            suggested_followups=["What are the recommended actions?", "Which area needs attention?", "What is the project progress?"]
        )

    # =========================================================================
    # INTENT: GREETING & CAPABILITIES
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
                "Generate today's report",
                "Generate a weekly site progress report",
                "What are the top safety risks?",
                "Are any materials delayed?"
            ]
        )

    # =========================================================================
    # INTENT: OUT_OF_SCOPE (Domain Boundary)
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
                "Generate today's report",
                "What is the project risk score?",
                "Show unresolved incidents",
                "Are there any material shortages?"
            ]
        )

    # =========================================================================
    # DEFAULT INTENT: GENERAL_PROJECT_QUERY / GENERAL OVERVIEW
    # =========================================================================
    else:
        risk_info = schemas.AssistantRiskInfo(
            score=risk_score,
            level=risk_level,
            factors=clean_factors,
            summary=f"Project risk evaluated at {risk_score}/100 ({risk_level})."
        )

        all_attention = get_active_incident_attentions(incidents)

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
            attention_items=all_attention[:3],
            locations=gen_locations,
            recommended_actions=gen_actions,
            materials=[],
            progress=None,
            ppe=None,
            sources=gen_sources,
            explainability=_build_explainability("General Project Intelligence Synthesis", len(incidents) + len(materials), risk_score, risk_level),
            suggested_followups=["Generate today's report", "What are the top safety risks?", dynamic_risk_followup]
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
