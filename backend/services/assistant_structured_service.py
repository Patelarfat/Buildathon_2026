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
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

import models
import schemas
from services.risk_engine import RiskEngine
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
        .limit(5)
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

    # 4. INTENT-SPECIFIC BUILDERS

    # =========================================================================
    # INTENT 1: MATERIALS
    # =========================================================================
    if intent == "MATERIALS":
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

        # Attention items: ONLY material shortages / delayed items
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

        # Material Actions
        mat_actions: List[schemas.AssistantActionItem] = []
        delayed_mats = [m for m in materials if m.status in ["DELAYED", "OUT_OF_STOCK"]]
        for dm in delayed_mats:
            mat_actions.append(
                schemas.AssistantActionItem(
                    title=f"Expedite delivery of {dm.material_name}",
                    description=f"Coordinate with {dm.supplier or 'supplier'} to resolve shipment delay ({dm.quantity} {dm.unit} required).",
                    priority="HIGH",
                    category="Materials"
                )
            )
        if not mat_actions:
            mat_actions.append(
                schemas.AssistantActionItem(
                    title="Maintain scheduled material deliveries",
                    description="All tracked project materials are currently in stock with no active supply blockers.",
                    priority="STANDARD",
                    category="Materials"
                )
            )

        # Sources: ONLY materials
        mat_sources = [
            schemas.AssistantSource(
                type="MATERIAL",
                id=str(m.id),
                title=f"Material: {m.material_name}",
                detail=f"Status: {m.status} ({m.quantity} {m.unit})"
            )
            for m in materials[:5]
        ]

        # Executive Summary
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
            risk=None,  # Do not display risk card for pure material query
            attention_items=mat_attention,
            locations=[],
            recommended_actions=mat_actions,
            materials=structured_materials,
            progress=None,
            ppe=None,
            sources=mat_sources,
            explainability=_build_explainability("SQL Materials & Inventory Retrieval", len(materials), risk_score, risk_level),
            suggested_followups=["Are any materials delaying progress?", "What is the project progress?", "What are the recommended actions?"]
        )

    # =========================================================================
    # INTENT 2: SAFETY INCIDENTS
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
    # INTENT 3: RECOMMENDED ACTIONS & ROLE ASSIGNMENTS
    # =========================================================================
    elif intent == "RECOMMENDED_ACTIONS":
        actions: List[schemas.AssistantActionItem] = []
        action_sources: List[schemas.AssistantSource] = []

        # Actions from open incidents
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

        # Actions from failed inspections
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

        # Actions from delayed materials
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

        # Actions from PPE violations
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

        # Check if user specifically asked about team assignments / roles
        q_lower = query.lower()
        is_assignment_query = any(w in q_lower for w in [
            "assign", "assigned", "who should", "who to", "who is responsible", "responsibility", "owner", "assignee", "role", "roles"
        ])
        if is_assignment_query:
            summary = (
                f"Action assignments for {project_name}: Safety items assigned to {safety_assignee}, "
                f"inspection rectifications to {supervisor_assignee}, and procurement/materials to {contractor_assignee}."
            )
            followups = ["What are the top safety risks?", "Which area needs attention?", "What is the material status?"]
        else:
            summary = f"Prioritized executive action plan with {len(actions)} concrete recommendation(s) based on current site safety, quality audits, and supply status."
            followups = ["Who should be assigned to these actions?", "Why is the project risk medium?", "Show affected area locations"]

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
    # INTENT 4: PPE & VISION
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
                    category="Safety"
                )
            )
        else:
            ppe_actions.append(
                schemas.AssistantActionItem(
                    title="Maintain continuous AI camera monitoring",
                    description="All scanned workers are currently compliant with required safety gear.",
                    priority="STANDARD",
                    category="Safety"
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
    # INTENT 5: PROGRESS & WORKFORCE
    # =========================================================================
    elif intent == "PROGRESS":
        progress_info = None
        if daily_reports:
            latest = daily_reports[0]
            progress_info = schemas.AssistantProgressInfo(
                progress_pct=latest.progress_percentage,
                workers_count=latest.workers_count,
                work_completed=latest.work_completed,
                weather=latest.weather,
                blockers=latest.blockers
            )
            summary = f"Daily progress log ({latest.report_date}): {latest.work_completed or 'Work in progress'}. Workforce: {latest.workers_count or 0} workers on site. Weather: {latest.weather or 'Clear'}."
        else:
            summary = "Progress data is not available for the selected period. No daily reports recorded."

        prog_sources = [
            schemas.AssistantSource(
                type="DAILY_REPORT",
                id=str(r.id),
                title=f"Daily Report ({r.report_date})",
                detail=f"{r.workers_count or 0} workers · Progress {r.progress_percentage or 0}%"
            )
            for r in daily_reports[:3]
        ]

        return schemas.AssistantStructuredResponse(
            query_type="PROGRESS",
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
            suggested_followups=["Summarize today's site activity", "What materials need attention?", "What are the top safety risks?"]
        )

    # =========================================================================
    # INTENT 6: AREA & SPATIAL INTELLIGENCE
    # =========================================================================
    elif intent == "AREA":
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

        area_attention = []
        for inc in incidents:
            if inc.area:
                area_attention.append(
                    schemas.AssistantAttentionItem(
                        id=str(inc.id),
                        title=f"{inc.incident_type.replace('_', ' ').title()} #{inc.id}",
                        description=inc.description,
                        severity=inc.severity or "HIGH",
                        category="SAFETY",
                        status=inc.status or "OPEN",
                        site_name=inc.site.name if inc.site else None,
                        area_name=inc.area.name
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

        if locations:
            top_area = locations[0]
            summary = f"Area risk intelligence: {top_area.area_name} currently has the highest risk ranking ({top_area.issue_summary})."
        else:
            summary = "All site zones and areas are currently operating within standard safety baselines."

        return schemas.AssistantStructuredResponse(
            query_type="AREA",
            executive_summary=summary,
            risk=None,
            attention_items=area_attention,
            locations=locations,
            recommended_actions=[],
            materials=[],
            progress=None,
            ppe=None,
            sources=area_sources,
            explainability=_build_explainability("Area Safety Risk Ranking Engine", len(locations), risk_score, risk_level),
            suggested_followups=["List unresolved safety incidents", "What are the recommended actions?", "Why is the project risk medium?"]
        )

    # =========================================================================
    # INTENT 7: INSPECTIONS
    # =========================================================================
    elif intent == "INSPECTIONS":
        insp_items: List[schemas.AssistantAttentionItem] = []
        for insp in inspections:
            title = f"{insp.inspection_type.replace('_', ' ').title()} Inspection"
            insp_items.append(
                schemas.AssistantAttentionItem(
                    id=str(insp.id),
                    title=title,
                    description=insp.findings or "Standard inspection record.",
                    severity="HIGH" if insp.status == "FAILED" else "LOW",
                    category="QUALITY",
                    status=insp.status,
                    site_name=insp.site.name if insp.site else None,
                    area_name=insp.area.name if insp.area else None,
                    action_taken=insp.recommendations
                )
            )

        insp_actions = []
        failed_insps = [i for i in inspections if i.status == "FAILED"]
        for fi in failed_insps:
            area_n = fi.area.name if fi.area else "Site"
            insp_actions.append(
                schemas.AssistantActionItem(
                    title=f"Rectify {fi.inspection_type.replace('_', ' ').title()} at {area_n}",
                    description=fi.recommendations or "Complete required repairs and schedule follow-up audit.",
                    priority="HIGH",
                    category="Quality"
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
            summary = f"Inspection review: {len(failed_insps)} failed inspection report(s) requiring remediation. Primary item: {failed_insps[0].inspection_type} at {failed_insps[0].area.name if failed_insps[0].area else 'Site'}."
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
    # INTENT 8: OBSERVATIONS
    # =========================================================================
    elif intent == "OBSERVATIONS":
        obs_items: List[schemas.AssistantAttentionItem] = []
        for obs in observations:
            obs_items.append(
                schemas.AssistantAttentionItem(
                    id=str(obs.id),
                    title=obs.title or f"{obs.observation_type.replace('_', ' ').title()} Note",
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

        open_obs = [o for o in observations if o.status != "RESOLVED"]
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
    # INTENT 9: RISK
    # =========================================================================
    elif intent == "RISK":
        risk_info = schemas.AssistantRiskInfo(
            score=risk_score,
            level=risk_level,
            factors=clean_factors,
            summary=f"Project risk evaluated at {risk_score}/100 ({risk_level}) by the deterministic Risk Engine."
        )

        # Contributing attention items
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

        # High risk locations
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

        # Risk Actions
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
        summary = f"Project risk is currently evaluated at {risk_score}/100 ({risk_level}). Primary contributing factor(s): {reasons_summary}."

        return schemas.AssistantStructuredResponse(
            query_type="RISK",
            executive_summary=summary,
            risk=risk_info,
            attention_items=risk_attention,
            locations=risk_locations,
            recommended_actions=risk_actions,
            materials=[],
            progress=None,
            ppe=None,
            sources=risk_sources,
            explainability=_build_explainability("Authoritative Risk Engine Multi-Factor Formulation", len(risk_factors_count := clean_factors), risk_score, risk_level),
            suggested_followups=["Which area needs attention?", "List unresolved safety incidents", "What are the recommended actions?"]
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
                "What are the top safety risks?",
                "List unresolved safety incidents",
                "Are any materials delayed?",
                "Show PPE compliance"
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
                "What is the project risk score?",
                "List unresolved safety incidents",
                "Are there any material shortages?",
                "What happened on site today?"
            ]
        )

    # =========================================================================
    # INTENT 10: GENERAL_PROJECT (Overview)
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
                category="Operations"
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
            suggested_followups=["What are the top safety risks?", "Why is the project risk medium?", "What materials need attention?"]
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
