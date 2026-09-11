from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

import models
import schemas
from services.risk_engine import RiskEngine
from services.recurring_issue_service import RecurringIssueService
from services.trend_service import TrendService
from services.intelligence_service import IntelligenceService


class DashboardService:
    @classmethod
    def get_manager_dashboard(
        cls,
        db: Session,
        project_id: int,
        days: int = 7,
        site_id: Optional[int] = None,
        area_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Consolidates executive health metrics, prioritized attention items,
        risk assessment, area rankings, safety/PPE analytics, progress,
        operational blockers, trends, and recent activity into a single unified payload.
        """
        project = db.query(models.Project).filter(models.Project.id == project_id).first()
        if not project:
            return None

        cutoff_date = datetime.utcnow() - timedelta(days=days)

        # 1. Project Metadata
        site_count = db.query(func.count(models.Site.id)).filter(models.Site.project_id == project_id).scalar() or 0
        area_count = (
            db.query(func.count(models.Area.id))
            .join(models.Site, models.Area.site_id == models.Site.id)
            .filter(models.Site.project_id == project_id)
            .scalar() or 0
        )
        member_count = db.query(func.count(models.ProjectMember.id)).filter(models.ProjectMember.project_id == project_id).scalar() or 0

        project_meta = {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "location": project.location,
            "status": project.status,
            "start_date": project.start_date,
            "end_date": project.end_date,
            "site_count": site_count,
            "area_count": area_count,
            "member_count": member_count,
            "last_updated": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
        }

        # 2. Consume existing Phase 4 & 5 Services
        risk_eval = RiskEngine.evaluate_risk(db=db, project_id=project_id, site_id=site_id, area_id=area_id, days=days)
        area_risks = IntelligenceService.get_area_risk_ranking(db=db, project_id=project_id, days=days)
        recurring_issues = RecurringIssueService.detect_recurring_issues(db=db, project_id=project_id, site_id=site_id, area_id=area_id, days=days)
        safety_summary = IntelligenceService.get_safety_summary(db=db, project_id=project_id, site_id=site_id, area_id=area_id, days=days)
        progress = IntelligenceService.get_progress_intelligence(db=db, project_id=project_id, site_id=site_id, area_id=area_id, days=days)
        operational_risk = IntelligenceService.get_operational_risk(db=db, project_id=project_id, site_id=site_id, area_id=area_id, days=days)
        trends = TrendService.calculate_project_trends(db=db, project_id=project_id, site_id=site_id, area_id=area_id, days=days)

        # 3. Deterministic "What Needs Attention?" Items Generation
        attention_items: List[Dict[str, Any]] = []

        # A. Risk Score Critical/High Alert
        if risk_eval["level"] == "CRITICAL":
            attention_items.append({
                "id": f"risk-critical-{project_id}",
                "priority": "CRITICAL",
                "title": f"Critical Safety Risk Level ({risk_eval['score']}/100)",
                "description": f"Multiple severe hazards and open issues detected. Top driver: {risk_eval['reasons'][0] if risk_eval['reasons'] else 'High hazard volume'}",
                "category": "RISK",
                "action_url": f"/projects/{project_id}/intelligence",
                "action_label": "Inspect Risk Breakdown"
            })
        elif risk_eval["level"] == "HIGH":
            attention_items.append({
                "id": f"risk-high-{project_id}",
                "priority": "HIGH",
                "title": f"High Safety Risk Level ({risk_eval['score']}/100)",
                "description": f"Site safety indicators require managerial attention: {risk_eval['reasons'][0] if risk_eval['reasons'] else 'Active violations'}",
                "category": "RISK",
                "action_url": f"/projects/{project_id}/intelligence",
                "action_label": "Review Risk Drivers"
            })

        # B. Unresolved High/Critical Human Incidents
        high_crit_incidents = (
            db.query(models.SafetyIncident)
            .filter(
                models.SafetyIncident.project_id == project_id,
                models.SafetyIncident.status.in_(["OPEN", "UNDER_REVIEW"]),
                models.SafetyIncident.severity.in_(["HIGH", "CRITICAL"]),
                models.SafetyIncident.created_at >= cutoff_date
            )
            .all()
        )
        if high_crit_incidents:
            attention_items.append({
                "id": f"inc-high-{project_id}",
                "priority": "CRITICAL",
                "title": f"{len(high_crit_incidents)} High/Critical Safety Incident(s) Unresolved",
                "description": f"Latest: {high_crit_incidents[0].incident_type} ({high_crit_incidents[0].description[:80]}...)",
                "category": "SAFETY_INCIDENT",
                "action_url": f"/projects/{project_id}/incidents",
                "action_label": "Resolve Incidents"
            })

        # C. Failed Inspections
        failed_inspections = (
            db.query(models.InspectionReport)
            .filter(
                models.InspectionReport.project_id == project_id,
                models.InspectionReport.status == "FAILED",
                models.InspectionReport.created_at >= cutoff_date
            )
            .all()
        )
        if failed_inspections:
            attention_items.append({
                "id": f"insp-failed-{project_id}",
                "priority": "CRITICAL",
                "title": f"{len(failed_inspections)} Failed Inspection Report(s)",
                "description": f"Inspection #{failed_inspections[0].id} ({failed_inspections[0].inspection_type}) failed: {failed_inspections[0].findings or 'Requires corrective action'}",
                "category": "INSPECTION",
                "action_url": f"/projects/{project_id}/inspections",
                "action_label": "View Failed Inspections"
            })

        # D. Active Recurring Issues
        for idx, ri in enumerate(recurring_issues):
            attention_items.append({
                "id": f"rec-{idx}-{ri['issue_type']}",
                "priority": "HIGH" if ri["severity"] in ["HIGH", "CRITICAL"] else "MEDIUM",
                "title": f"Recurring {ri['issue_type'].replace('_', ' ')} in {ri['area_name'] or 'Site'}",
                "description": f"Detected {ri['occurrence_count']} occurrences within the last {ri['time_window_days']} days (Category: {ri['issue_category']})",
                "category": "SAFETY_INCIDENT" if ri["issue_category"] == "SAFETY_INCIDENT" else "AI_PPE",
                "action_url": f"/projects/{project_id}/intelligence",
                "action_label": "Review Recurring Zone"
            })

        # E. High Severity AI Findings
        high_ai_findings = (
            db.query(models.AISafetyFinding)
            .filter(
                models.AISafetyFinding.project_id == project_id,
                models.AISafetyFinding.status == "OPEN",
                models.AISafetyFinding.severity.in_(["HIGH", "CRITICAL"]),
                models.AISafetyFinding.created_at >= cutoff_date
            )
            .all()
        )
        if high_ai_findings and not any(a["category"] == "AI_PPE" for a in attention_items):
            attention_items.append({
                "id": f"ai-high-{project_id}",
                "priority": "HIGH",
                "title": f"{len(high_ai_findings)} High-Severity AI PPE Violation(s)",
                "description": f"Automated CV detected critical PPE missing: {high_ai_findings[0].title}",
                "category": "AI_PPE",
                "action_url": f"/projects/{project_id}/photos",
                "action_label": "Review AI Detections"
            })

        # F. Low Stock Materials
        for idx, mat in enumerate(operational_risk["low_stock_materials"]):
            attention_items.append({
                "id": f"mat-low-{mat.id}",
                "priority": "MEDIUM",
                "title": f"Low Stock: {mat.material_name}",
                "description": f"Current stock: {mat.quantity} {mat.unit} (Supplier: {mat.supplier or 'N/A'})",
                "category": "MATERIAL",
                "action_url": f"/projects/{project_id}/materials",
                "action_label": "View Materials"
            })

        # G. Active Daily Report Blockers
        for idx, blocker in enumerate(operational_risk["open_blockers"][:3]):
            attention_items.append({
                "id": f"blocker-{idx}",
                "priority": "MEDIUM",
                "title": "Active Site Blocker Logged",
                "description": blocker,
                "category": "PROGRESS",
                "action_url": f"/projects/{project_id}/daily-reports",
                "action_label": "Inspect Daily Reports"
            })

        # H. Unresolved High Priority Observations
        high_obs = (
            db.query(models.Observation)
            .filter(
                models.Observation.project_id == project_id,
                models.Observation.status.in_(["OPEN", "IN_PROGRESS"]),
                models.Observation.priority == "HIGH",
                models.Observation.created_at >= cutoff_date
            )
            .all()
        )
        if high_obs and not any(a["category"] == "OBSERVATION" for a in attention_items):
            attention_items.append({
                "id": f"obs-high-{project_id}",
                "priority": "MEDIUM",
                "title": f"{len(high_obs)} High-Priority Observation(s) Open",
                "description": f"Latest: {high_obs[0].title} - {high_obs[0].description[:80]}",
                "category": "OBSERVATION",
                "action_url": f"/projects/{project_id}/observations",
                "action_label": "View Observations"
            })

        # Priority Sort Mapping
        priority_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        attention_items.sort(key=lambda x: priority_order.get(x["priority"], 99))

        # 4. Executive Health Summary
        open_safety_count = safety_summary["ai_findings_open"] + safety_summary["human_incidents_open"]
        open_obs_count = safety_summary["observations_open"]
        op_blockers_count = len(operational_risk["low_stock_materials"]) + len(operational_risk["open_blockers"])

        executive_health = {
            "risk_score": risk_eval["score"],
            "risk_level": risk_eval["level"],
            "risk_trend": trends["safety_trend"],
            "risk_change_pct": trends["safety_change_pct"],
            "progress_pct": progress["latest_progress_pct"],
            "progress_trend": progress["progress_trend"],
            "open_safety_issues": open_safety_count,
            "open_observations": open_obs_count,
            "operational_blockers": op_blockers_count,
            "data_confidence": risk_eval["data_confidence"]
        }

        # 5. Recent Activity Stream
        recent_activity: List[schemas.ActivityItemResponse] = []

        # Photos
        for p in db.query(models.SitePhoto).filter(models.SitePhoto.project_id == project_id).order_by(models.SitePhoto.created_at.desc()).limit(3).all():
            recent_activity.append(schemas.ActivityItemResponse(
                id=p.id,
                type="PHOTO",
                title=p.caption or p.file_name,
                description=p.caption or f"Photo uploaded for {p.site.name if p.site else 'Site'}",
                status=None,
                severity_or_priority=None,
                site_name=p.site.name if p.site else None,
                area_name=p.area.name if p.area else None,
                user_name=p.uploader.name if p.uploader else "Unknown User",
                date=p.taken_at or p.created_at.strftime("%Y-%m-%d"),
                created_at=p.created_at
            ))

        # Incidents
        for inc in db.query(models.SafetyIncident).filter(models.SafetyIncident.project_id == project_id).order_by(models.SafetyIncident.created_at.desc()).limit(3).all():
            recent_activity.append(schemas.ActivityItemResponse(
                id=inc.id,
                type="INCIDENT",
                title=f"Safety Incident: {inc.incident_type}",
                description=f"[{inc.severity}] {inc.description[:100]}",
                status=inc.status,
                severity_or_priority=inc.severity,
                site_name=inc.site.name if inc.site else None,
                area_name=inc.area.name if inc.area else None,
                user_name=inc.reporter.name if inc.reporter else "Safety Officer",
                date=inc.incident_date or inc.created_at.strftime("%Y-%m-%d"),
                created_at=inc.created_at
            ))

        # Reports
        for r in db.query(models.DailyReport).filter(models.DailyReport.project_id == project_id).order_by(models.DailyReport.created_at.desc()).limit(3).all():
            recent_activity.append(schemas.ActivityItemResponse(
                id=r.id,
                type="REPORT",
                title=f"Daily Report ({r.report_date})",
                description=f"Progress: {r.progress_percentage or 0}%, Workers: {r.workers_count or 0}",
                status=None,
                severity_or_priority=None,
                site_name=r.site.name if r.site else None,
                area_name=r.area.name if r.area else None,
                user_name=r.reporter.name if r.reporter else "Site Supervisor",
                date=r.report_date,
                created_at=r.created_at
            ))

        # Inspections
        for insp in db.query(models.InspectionReport).filter(models.InspectionReport.project_id == project_id).order_by(models.InspectionReport.created_at.desc()).limit(3).all():
            recent_activity.append(schemas.ActivityItemResponse(
                id=insp.id,
                type="INSPECTION",
                title=f"Inspection: {insp.inspection_type}",
                description=f"Status: {insp.status} - {insp.findings or 'Inspection recorded'}",
                status=insp.status,
                severity_or_priority=None,
                site_name=insp.site.name if insp.site else None,
                area_name=insp.area.name if insp.area else None,
                user_name=insp.inspector.name if insp.inspector else "Inspector",
                date=insp.inspection_date or insp.created_at.strftime("%Y-%m-%d"),
                created_at=insp.created_at
            ))

        # Observations
        for o in db.query(models.Observation).filter(models.Observation.project_id == project_id).order_by(models.Observation.created_at.desc()).limit(3).all():
            recent_activity.append(schemas.ActivityItemResponse(
                id=o.id,
                type="OBSERVATION",
                title=f"Observation: {o.title}",
                description=f"Priority: {o.priority}, Status: {o.status}",
                status=o.status,
                severity_or_priority=o.priority,
                site_name=o.site.name if o.site else None,
                area_name=o.area.name if o.area else None,
                user_name=o.creator.name if o.creator else "User",
                date=o.observed_at or o.created_at.strftime("%Y-%m-%d"),
                created_at=o.created_at
            ))

        # Materials
        for m in db.query(models.Material).filter(models.Material.project_id == project_id).order_by(models.Material.created_at.desc()).limit(3).all():
            recent_activity.append(schemas.ActivityItemResponse(
                id=m.id,
                type="MATERIAL",
                title=f"Material: {m.material_name}",
                description=f"{m.quantity} {m.unit} [{m.status}]",
                status=m.status,
                severity_or_priority=None,
                site_name=m.site.name if m.site else None,
                area_name=m.area.name if m.area else None,
                user_name=m.recorder.name if m.recorder else "User",
                date=m.delivery_date or m.created_at.strftime("%Y-%m-%d"),
                created_at=m.created_at
            ))

        # Sort all recent activity items newest first
        recent_activity.sort(key=lambda x: x.created_at, reverse=True)
        recent_activity = recent_activity[:15]

        return {
            "project": project_meta,
            "executive_health": executive_health,
            "attention_items": attention_items,
            "risk": risk_eval,
            "area_risk": area_risks,
            "recurring_problems": recurring_issues,
            "safety": safety_summary,
            "progress": progress,
            "materials": operational_risk,
            "trends": trends,
            "recent_activity": recent_activity
        }
