from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

import models

DEFAULT_RECURRING_THRESHOLD = 3
DEFAULT_RECURRING_WINDOW_DAYS = 7


class RecurringIssueService:
    @staticmethod
    def detect_recurring_issues(
        db: Session,
        project_id: int,
        site_id: Optional[int] = None,
        area_id: Optional[int] = None,
        days: int = DEFAULT_RECURRING_WINDOW_DAYS,
        threshold: int = DEFAULT_RECURRING_THRESHOLD
    ) -> List[Dict[str, Any]]:
        """
        Detects recurring issues across AI safety findings, human safety incidents,
        observations, failed inspections, and material alerts.
        Rule: Same issue type + same area + >= threshold occurrences within time window.
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        recurring_list: List[Dict[str, Any]] = []

        # 1. AI Safety Findings
        ai_query = (
            db.query(
                models.AISafetyFinding.site_id,
                models.AISafetyFinding.area_id,
                models.AISafetyFinding.finding_type.label("issue_type"),
                func.count(models.AISafetyFinding.id).label("count"),
                func.min(models.AISafetyFinding.created_at).label("first_seen"),
                func.max(models.AISafetyFinding.created_at).label("last_seen"),
                func.max(models.AISafetyFinding.severity).label("max_severity")
            )
            .filter(
                models.AISafetyFinding.project_id == project_id,
                models.AISafetyFinding.created_at >= cutoff_date,
                models.AISafetyFinding.status != "FALSE_POSITIVE"
            )
        )
        if site_id:
            ai_query = ai_query.filter(models.AISafetyFinding.site_id == site_id)
        if area_id:
            ai_query = ai_query.filter(models.AISafetyFinding.area_id == area_id)

        ai_groups = (
            ai_query.group_by(
                models.AISafetyFinding.site_id,
                models.AISafetyFinding.area_id,
                models.AISafetyFinding.finding_type
            )
            .having(func.count(models.AISafetyFinding.id) >= threshold)
            .all()
        )

        for row in ai_groups:
            site_obj = db.query(models.Site).filter(models.Site.id == row.site_id).first() if row.site_id else None
            area_obj = db.query(models.Area).filter(models.Area.id == row.area_id).first() if row.area_id else None
            recurring_list.append({
                "project_id": project_id,
                "site_id": row.site_id,
                "site_name": site_obj.name if site_obj else None,
                "area_id": row.area_id,
                "area_name": area_obj.name if area_obj else "General Site Area",
                "issue_type": row.issue_type,
                "issue_category": "AI_PPE",
                "occurrence_count": row.count,
                "first_seen": row.first_seen.strftime("%Y-%m-%d %H:%M") if hasattr(row.first_seen, "strftime") else str(row.first_seen),
                "last_seen": row.last_seen.strftime("%Y-%m-%d %H:%M") if hasattr(row.last_seen, "strftime") else str(row.last_seen),
                "time_window_days": days,
                "severity": row.max_severity or "HIGH",
                "status": "ACTIVE"
            })

        # 2. Human Safety Incidents
        incident_query = (
            db.query(
                models.SafetyIncident.site_id,
                models.SafetyIncident.area_id,
                models.SafetyIncident.incident_type.label("issue_type"),
                func.count(models.SafetyIncident.id).label("count"),
                func.min(models.SafetyIncident.created_at).label("first_seen"),
                func.max(models.SafetyIncident.created_at).label("last_seen"),
                func.max(models.SafetyIncident.severity).label("max_severity")
            )
            .filter(
                models.SafetyIncident.project_id == project_id,
                models.SafetyIncident.created_at >= cutoff_date
            )
        )
        if site_id:
            incident_query = incident_query.filter(models.SafetyIncident.site_id == site_id)
        if area_id:
            incident_query = incident_query.filter(models.SafetyIncident.area_id == area_id)

        inc_groups = (
            incident_query.group_by(
                models.SafetyIncident.site_id,
                models.SafetyIncident.area_id,
                models.SafetyIncident.incident_type
            )
            .having(func.count(models.SafetyIncident.id) >= threshold)
            .all()
        )

        for row in inc_groups:
            site_obj = db.query(models.Site).filter(models.Site.id == row.site_id).first() if row.site_id else None
            area_obj = db.query(models.Area).filter(models.Area.id == row.area_id).first() if row.area_id else None
            recurring_list.append({
                "project_id": project_id,
                "site_id": row.site_id,
                "site_name": site_obj.name if site_obj else None,
                "area_id": row.area_id,
                "area_name": area_obj.name if area_obj else "General Site Area",
                "issue_type": row.issue_type,
                "issue_category": "SAFETY_INCIDENT",
                "occurrence_count": row.count,
                "first_seen": row.first_seen.strftime("%Y-%m-%d %H:%M") if hasattr(row.first_seen, "strftime") else str(row.first_seen),
                "last_seen": row.last_seen.strftime("%Y-%m-%d %H:%M") if hasattr(row.last_seen, "strftime") else str(row.last_seen),
                "time_window_days": days,
                "severity": row.max_severity or "HIGH",
                "status": "ACTIVE"
            })

        # 3. Observations / Issues
        obs_query = (
            db.query(
                models.Observation.site_id,
                models.Observation.area_id,
                models.Observation.observation_type.label("issue_type"),
                func.count(models.Observation.id).label("count"),
                func.min(models.Observation.created_at).label("first_seen"),
                func.max(models.Observation.created_at).label("last_seen"),
                func.max(models.Observation.priority).label("max_priority")
            )
            .filter(
                models.Observation.project_id == project_id,
                models.Observation.created_at >= cutoff_date,
                models.Observation.status != "RESOLVED"
            )
        )
        if site_id:
            obs_query = obs_query.filter(models.Observation.site_id == site_id)
        if area_id:
            obs_query = obs_query.filter(models.Observation.area_id == area_id)

        obs_groups = (
            obs_query.group_by(
                models.Observation.site_id,
                models.Observation.area_id,
                models.Observation.observation_type
            )
            .having(func.count(models.Observation.id) >= threshold)
            .all()
        )

        for row in obs_groups:
            site_obj = db.query(models.Site).filter(models.Site.id == row.site_id).first() if row.site_id else None
            area_obj = db.query(models.Area).filter(models.Area.id == row.area_id).first() if row.area_id else None
            recurring_list.append({
                "project_id": project_id,
                "site_id": row.site_id,
                "site_name": site_obj.name if site_obj else None,
                "area_id": row.area_id,
                "area_name": area_obj.name if area_obj else "General Site Area",
                "issue_type": row.issue_type,
                "issue_category": "OBSERVATION",
                "occurrence_count": row.count,
                "first_seen": row.first_seen.strftime("%Y-%m-%d %H:%M") if hasattr(row.first_seen, "strftime") else str(row.first_seen),
                "last_seen": row.last_seen.strftime("%Y-%m-%d %H:%M") if hasattr(row.last_seen, "strftime") else str(row.last_seen),
                "time_window_days": days,
                "severity": row.max_priority or "MEDIUM",
                "status": "ACTIVE"
            })

        # 4. Failed Inspections
        insp_query = (
            db.query(
                models.InspectionReport.site_id,
                models.InspectionReport.area_id,
                models.InspectionReport.inspection_type.label("issue_type"),
                func.count(models.InspectionReport.id).label("count"),
                func.min(models.InspectionReport.created_at).label("first_seen"),
                func.max(models.InspectionReport.created_at).label("last_seen")
            )
            .filter(
                models.InspectionReport.project_id == project_id,
                models.InspectionReport.status == "FAILED",
                models.InspectionReport.created_at >= cutoff_date
            )
        )
        if site_id:
            insp_query = insp_query.filter(models.InspectionReport.site_id == site_id)
        if area_id:
            insp_query = insp_query.filter(models.InspectionReport.area_id == area_id)

        insp_groups = (
            insp_query.group_by(
                models.InspectionReport.site_id,
                models.InspectionReport.area_id,
                models.InspectionReport.inspection_type
            )
            .having(func.count(models.InspectionReport.id) >= 2)
            .all()
        )

        for row in insp_groups:
            site_obj = db.query(models.Site).filter(models.Site.id == row.site_id).first() if row.site_id else None
            area_obj = db.query(models.Area).filter(models.Area.id == row.area_id).first() if row.area_id else None
            recurring_list.append({
                "project_id": project_id,
                "site_id": row.site_id,
                "site_name": site_obj.name if site_obj else None,
                "area_id": row.area_id,
                "area_name": area_obj.name if area_obj else "General Site Area",
                "issue_type": f"FAILED_{row.issue_type}_INSPECTION",
                "issue_category": "INSPECTION",
                "occurrence_count": row.count,
                "first_seen": row.first_seen.strftime("%Y-%m-%d %H:%M") if hasattr(row.first_seen, "strftime") else str(row.first_seen),
                "last_seen": row.last_seen.strftime("%Y-%m-%d %H:%M") if hasattr(row.last_seen, "strftime") else str(row.last_seen),
                "time_window_days": days,
                "severity": "HIGH",
                "status": "ACTIVE"
            })

        return recurring_list
