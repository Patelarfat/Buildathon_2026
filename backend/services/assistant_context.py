"""
Context retrieval service for GenAI Construction Project Assistant.
Aggregates relevant, grounded project data from PostgreSQL and the Risk Engine,
enforcing strict project isolation and zero hallucination.
"""

import re
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
    if "this month" in q or "last 30 days" in q:
        return (today_start - timedelta(days=30), None)
    return None


def retrieve_assistant_context(
    db: Session,
    project_id: int,
    query: str
) -> Tuple[str, List[schemas.AssistantSource], List[str], str]:
    """
    Builds a grounded, topic-focused prompt context by querying project data
    strictly scoped to project_id.
    """
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        return "", [], [], ""

    project_name = project.name
    query_lower = query.lower()
    time_filter = _parse_time_intent(query_lower)

    # Resolve area names
    areas = db.query(models.Area).join(models.Site).filter(models.Site.project_id == project_id).all()
    matched_area_ids = []
    for area in areas:
        if area.name.lower() in query_lower:
            matched_area_ids.append(area.id)

    # Routing intent flags
    is_risk = any(k in query_lower for k in ["risk", "safety score", "why is", "high risk", "score", "level", "explain risk"])
    is_incident = any(k in query_lower for k in ["incident", "accident", "injury", "near miss", "hazard", "unresolved", "open incident"])
    is_inspection = any(k in query_lower for k in ["inspection", "failed", "audit", "checklist", "inspector", "safety netting"])
    is_observation = any(k in query_lower for k in ["observation", "hazard", "defect", "warning", "snag"])
    is_material = any(k in query_lower for k in ["material", "rebar", "concrete", "delivery", "shortage", "delayed", "supply", "blocker", "stock"])
    is_daily_report = any(k in query_lower for k in ["daily report", "log", "work completed", "work planned", "weather", "today", "yesterday", "activities", "workforce", "workers"])
    is_recurring = any(k in query_lower for k in ["recurring", "repeated", "repeat", "trend", "worst area", "area ranking", "frequent"])
    is_ppe_violation = any(k in query_lower for k in ["ppe violation", "without helmet", "no helmet", "no vest", "no gloves", "violating", "violations", "unsafe"])
    is_ppe_compliance = any(k in query_lower for k in ["ppe compliance", "compliant", "helmet detected", "wearing", "protective equipment"])
    is_summary = any(k in query_lower for k in ["summary", "overview", "status", "health", "brief", "how is", "everything", "all"])

    # Default fallback: show summary if nothing matches specifically
    if not any([is_risk, is_incident, is_inspection, is_observation, is_material, is_daily_report, is_recurring, is_ppe_violation, is_ppe_compliance]):
        is_summary = True

    context_blocks = []
    sources: List[schemas.AssistantSource] = []
    data_used: List[str] = []

    # Block 1: Project Metadata & Authoritative Risk Engine Output
    if is_risk or is_summary or is_recurring:
        try:
            risk_eval = RiskEngine.evaluate_risk(db=db, project_id=project_id, days=7)
            risk_block = (
                f"[PROJECT RISK ENGINE EVALUATION]\n"
                f"Project: {project.name} (Status: {project.status})\n"
                f"Authoritative Risk Score: {risk_eval.get('risk_score')}/100\n"
                f"Risk Level: {risk_eval.get('risk_level')}\n"
                f"Data Confidence: {risk_eval.get('data_confidence')}\n"
                f"Key Contributing Factors:\n" +
                "\n".join([f"  - {r}" for r in risk_eval.get("reasons", ["No elevated risk factors detected."])])
            )
            context_blocks.append(risk_block)
            sources.append(schemas.AssistantSource(
                type="RISK",
                id="risk_engine",
                title=f"Risk Engine: Score {risk_eval.get('risk_score')} ({risk_eval.get('risk_level')})",
                detail="Deterministic multi-factor risk assessment"
            ))
            data_used.append("risk_engine")
        except Exception:
            pass

    # Block 2: Recurring Issues & Area Rankings
    if is_recurring or is_risk or is_summary:
        try:
            recurring = RecurringIssueService.detect_recurring_issues(db=db, project_id=project_id, days=14)
            area_rankings = RiskEngine.get_area_risk_rankings(db=db, project_id=project_id, days=7)
            
            rec_lines = [f"  * [{rec.get('severity')}] {rec.get('issue_type')} in {rec.get('area_name')} ({rec.get('count')} occurrences)" for rec in recurring]
            rank_lines = [f"  * Rank {idx+1}: {r.get('area_name')} (Score: {r.get('risk_score')}, Level: {r.get('risk_level')})" for idx, r in enumerate(area_rankings[:5])]
            
            rec_joined = "\n".join(rec_lines) if rec_lines else "  * No recurring issues detected (all issue clusters < 3 occurrences)."
            rank_joined = "\n".join(rank_lines) if rank_lines else "  * No area risk rankings available."

            rec_block = (
                f"[RECURRING ISSUES & AREA SAFETY RANKING]\n"
                f"Recurring Problems (>=3 occurrences):\n"
                f"{rec_joined}\n"
                f"Area Risk Ranking (Highest risk first):\n"
                f"{rank_joined}"
            )
            context_blocks.append(rec_block)
            sources.append(schemas.AssistantSource(
                type="RECURRING",
                id="recurring_analysis",
                title="Area Risk Ranking & Recurring Issue Detector",
                detail=f"{len(recurring)} recurring issue(s), {len(area_rankings)} ranked area(s)"
            ))
            data_used.append("recurring_issues")
        except Exception:
            pass

    # Block 3: Safety Incidents
    if is_incident or is_risk or is_summary or matched_area_ids:
        inc_query = db.query(models.SafetyIncident).filter(models.SafetyIncident.project_id == project_id)
        if matched_area_ids:
            inc_query = inc_query.filter(models.SafetyIncident.area_id.in_(matched_area_ids))
        if time_filter:
            inc_query = inc_query.filter(models.SafetyIncident.incident_date >= str(time_filter[0].date()))
            if time_filter[1]:
                inc_query = inc_query.filter(models.SafetyIncident.incident_date <= str(time_filter[1].date()))

        incidents = inc_query.order_by(models.SafetyIncident.id.desc()).limit(15).all()
        if incidents:
            inc_lines = []
            for inc in incidents:
                site_name = inc.site.name if inc.site else 'Unknown Site'
                area_name = inc.area.name if inc.area else 'General'
                inc_lines.append(
                    f"  * Incident #{inc.id}: [{inc.severity}] {inc.incident_type} (Status: {inc.status}) on {inc.incident_date} at {site_name} -> {area_name}. Description: {inc.description}. Action Taken: {inc.action_taken or 'None'}"
                )
                sources.append(schemas.AssistantSource(
                    type="INCIDENT",
                    id=f"incident_{inc.id}",
                    title=f"Safety Incident #{inc.id}: {inc.incident_type} ({inc.severity})",
                    detail=f"Status: {inc.status} · Area: {area_name}"
                ))
            context_blocks.append(f"[SAFETY INCIDENTS]\n" + "\n".join(inc_lines))
            data_used.append("safety_incidents")
        elif is_incident:
            context_blocks.append("[SAFETY INCIDENTS]\nNo safety incidents recorded matching the query.")
            data_used.append("safety_incidents")

    # Block 4: Inspections
    if is_inspection or is_risk or is_summary or matched_area_ids:
        insp_query = db.query(models.InspectionReport).filter(models.InspectionReport.project_id == project_id)
        if matched_area_ids:
            insp_query = insp_query.filter(models.InspectionReport.area_id.in_(matched_area_ids))
        if time_filter:
            insp_query = insp_query.filter(models.InspectionReport.inspection_date >= str(time_filter[0].date()))
            if time_filter[1]:
                insp_query = insp_query.filter(models.InspectionReport.inspection_date <= str(time_filter[1].date()))

        inspections = insp_query.order_by(models.InspectionReport.id.desc()).limit(15).all()
        if inspections:
            insp_lines = []
            for insp in inspections:
                area_name = insp.area.name if insp.area else 'General'
                insp_lines.append(
                    f"  * Inspection #{insp.id}: {insp.inspection_type} - Status: {insp.status} on {insp.inspection_date} in {area_name}. Findings: {insp.findings or 'None'}. Recommendations: {insp.recommendations or 'None'}"
                )
                sources.append(schemas.AssistantSource(
                    type="INSPECTION",
                    id=f"inspection_{insp.id}",
                    title=f"Inspection #{insp.id}: {insp.inspection_type} ({insp.status})",
                    detail=f"Status: {insp.status} · Date: {insp.inspection_date}"
                ))
            context_blocks.append(f"[INSPECTION REPORTS]\n" + "\n".join(insp_lines))
            data_used.append("inspections")
        elif is_inspection:
            context_blocks.append("[INSPECTION REPORTS]\nNo inspection reports recorded matching the query.")
            data_used.append("inspections")

    # Block 5: Observations & Issues
    if is_observation or is_risk or is_summary or matched_area_ids:
        obs_query = db.query(models.Observation).filter(models.Observation.project_id == project_id)
        if matched_area_ids:
            obs_query = obs_query.filter(models.Observation.area_id.in_(matched_area_ids))

        observations = obs_query.order_by(models.Observation.id.desc()).limit(15).all()
        if observations:
            obs_lines = []
            for obs in observations:
                area_name = obs.area.name if obs.area else 'General'
                obs_lines.append(
                    f"  * Observation #{obs.id}: [{obs.priority}] '{obs.title}' ({obs.observation_type}, Status: {obs.status}) in {area_name}. Description: {obs.description}"
                )
                sources.append(schemas.AssistantSource(
                    type="OBSERVATION",
                    id=f"observation_{obs.id}",
                    title=f"Observation #{obs.id}: {obs.title} ({obs.priority})",
                    detail=f"Type: {obs.observation_type} · Status: {obs.status}"
                ))
            context_blocks.append(f"[SITE OBSERVATIONS & HAZARDS]\n" + "\n".join(obs_lines))
            data_used.append("observations")
        elif is_observation:
            context_blocks.append("[SITE OBSERVATIONS & HAZARDS]\nNo site observations recorded matching the query.")
            data_used.append("observations")

    # Block 6: Materials & Operational Blockers
    if is_material or is_summary:
        materials = db.query(models.Material).filter(models.Material.project_id == project_id).order_by(models.Material.id.desc()).limit(20).all()
        if materials:
            mat_lines = []
            for m in materials:
                is_alert = m.status in ["LOW_STOCK", "OUT_OF_STOCK", "DELAYED"]
                mat_lines.append(
                    f"  * Material #{m.id}: {m.material_name} ({m.category or 'General'}) - Quantity: {m.quantity} {m.unit} - Status: {m.status} Notes: {m.notes or 'None'} {'[SHORTAGE/BLOCKER ALERT]' if is_alert else ''}"
                )
                if is_alert or is_material:
                    sources.append(schemas.AssistantSource(
                        type="MATERIAL",
                        id=f"material_{m.id}",
                        title=f"Material #{m.id}: {m.material_name} ({m.status})",
                        detail=f"Quantity: {m.quantity} {m.unit} · Status: {m.status}"
                    ))
            context_blocks.append(f"[MATERIALS & INVENTORY]\n" + "\n".join(mat_lines))
            data_used.append("materials")
        elif is_material:
            context_blocks.append("[MATERIALS & INVENTORY]\nNo material records found for this project.")
            data_used.append("materials")

    # Block 7: PPE Vision & Safety Findings
    if is_ppe_violation or is_ppe_compliance or is_risk or is_summary:
        findings_query = db.query(models.AISafetyFinding).filter(models.AISafetyFinding.project_id == project_id)
        if matched_area_ids:
            findings_query = findings_query.filter(models.AISafetyFinding.area_id.in_(matched_area_ids))

        findings = findings_query.order_by(models.AISafetyFinding.id.desc()).limit(25).all()
        
        violations = [f for f in findings if f.finding_type in AI_PPE_VIOLATION_TYPES or "WITHOUT" in f.finding_type or f.severity in ["MEDIUM", "HIGH", "CRITICAL"]]
        compliances = [f for f in findings if f.finding_type in AI_PPE_COMPLIANCE_TYPES or "DETECTED" in f.finding_type or f.severity in ["INFO", "LOW"]]

        if is_ppe_compliance or is_summary:
            comp_lines = [f"  * Verified PPE Compliance #{c.id}: {c.title} ({c.finding_type}) - Confidence: {round(c.confidence*100)}% · Status: {c.status}" for c in compliances]
            context_blocks.append(f"[PPE COMPLIANCE CONFIRMATIONS]\n" + ("\n".join(comp_lines) if comp_lines else "No verified PPE compliance records currently recorded."))
            for c in compliances[:5]:
                sources.append(schemas.AssistantSource(type="AI_PPE", id=f"finding_{c.id}", title=c.title, detail=f"Type: {c.finding_type}"))
            data_used.append("ppe_compliance")

        if is_ppe_violation or is_risk or is_summary:
            viol_lines = [f"  * AI Safety Violation #{v.id}: [{v.severity}] {v.title} ({v.finding_type}) - Status: {v.status} · Confidence: {round(v.confidence*100)}%" for v in violations]
            context_blocks.append(f"[AI PPE SAFETY VIOLATIONS]\n" + ("\n".join(viol_lines) if viol_lines else "No active AI PPE safety violations detected."))
            for v in violations[:5]:
                sources.append(schemas.AssistantSource(type="AI_PPE", id=f"finding_{v.id}", title=f"Violation: {v.title} ({v.severity})", detail=f"Status: {v.status}"))
            data_used.append("ppe_violations")

    # Block 8: Daily Reports & Progress
    if is_daily_report or is_summary or matched_area_ids:
        rep_query = db.query(models.DailyReport).filter(models.DailyReport.project_id == project_id)
        if time_filter:
            rep_query = rep_query.filter(models.DailyReport.report_date >= str(time_filter[0].date()))
            if time_filter[1]:
                rep_query = rep_query.filter(models.DailyReport.report_date <= str(time_filter[1].date()))

        reports = rep_query.order_by(models.DailyReport.report_date.desc()).limit(7).all()
        if reports:
            rep_lines = []
            for r in reports:
                rep_lines.append(
                    f"  * Daily Report #{r.id} ({r.report_date}): Completed: {r.work_completed or 'N/A'} · Workforce: {r.workers_count or 0} workers. Weather: {r.weather or 'N/A'}. Notes: {r.notes or 'None'}. Blockers: {r.blockers or 'None'}"
                )
                sources.append(schemas.AssistantSource(
                    type="DAILY_REPORT",
                    id=f"report_{r.id}",
                    title=f"Daily Report ({r.report_date})",
                    detail=f"Workforce: {r.workers_count or 0} workers · Notes: {r.notes or 'None'}"
                ))
            context_blocks.append(f"[DAILY SITE REPORTS & PROGRESS]\n" + "\n".join(rep_lines))
            data_used.append("daily_reports")
        elif is_daily_report:
            context_blocks.append("[DAILY SITE REPORTS & PROGRESS]\nNo daily reports found matching the query.")
            data_used.append("daily_reports")

    final_context = "\n\n".join(context_blocks)
    return final_context, sources, data_used, project_name
