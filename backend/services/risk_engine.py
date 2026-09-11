from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

import models
from services.recurring_issue_service import RecurringIssueService
from services.trend_service import TrendService


class RiskEngine:
    AI_FINDING_WEIGHTS = {"LOW": 5.0, "MEDIUM": 10.0, "HIGH": 20.0, "CRITICAL": 30.0}
    AI_FINDING_CAP = 30.0

    INCIDENT_WEIGHTS = {"LOW": 8.0, "MEDIUM": 15.0, "HIGH": 25.0, "CRITICAL": 35.0}
    INCIDENT_CAP = 30.0

    OBSERVATION_WEIGHTS = {"LOW": 3.0, "MEDIUM": 6.0, "HIGH": 10.0}
    OBSERVATION_CAP = 15.0

    INSPECTION_WEIGHT = 10.0
    INSPECTION_CAP = 15.0

    RECURRING_WEIGHT = 10.0
    RECURRING_CAP = 15.0

    @classmethod
    def evaluate_risk(
        cls,
        db: Session,
        project_id: int,
        site_id: Optional[int] = None,
        area_id: Optional[int] = None,
        days: int = 7
    ) -> Dict[str, Any]:
        """
        Calculates explainable 0-100 safety risk score, components, level,
        data confidence rating, and human-readable reasons.
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        reasons: List[str] = []

        # -------------------------------------------------------------
        # 1. Component A: AI Safety Findings (OPEN only)
        # -------------------------------------------------------------
        ai_query = db.query(models.AISafetyFinding).filter(
            models.AISafetyFinding.project_id == project_id,
            models.AISafetyFinding.status == "OPEN",
            models.AISafetyFinding.created_at >= cutoff_date
        )
        if site_id:
            ai_query = ai_query.filter(models.AISafetyFinding.site_id == site_id)
        if area_id:
            ai_query = ai_query.filter(models.AISafetyFinding.area_id == area_id)

        open_ai_findings = ai_query.all()
        raw_ai_score = sum(cls.AI_FINDING_WEIGHTS.get(f.severity.upper(), 5.0) for f in open_ai_findings)
        ai_score = min(raw_ai_score, cls.AI_FINDING_CAP)

        high_ai = sum(1 for f in open_ai_findings if f.severity.upper() in ["HIGH", "CRITICAL"])
        if open_ai_findings:
            msg = f"{len(open_ai_findings)} open AI PPE safety violation(s)"
            if high_ai > 0:
                msg += f" (including {high_ai} high/critical severity)"
            reasons.append(msg)

        # -------------------------------------------------------------
        # 2. Component B: Human Safety Incidents (OPEN / UNDER_REVIEW)
        # -------------------------------------------------------------
        inc_query = db.query(models.SafetyIncident).filter(
            models.SafetyIncident.project_id == project_id,
            models.SafetyIncident.status.in_(["OPEN", "UNDER_REVIEW"]),
            models.SafetyIncident.created_at >= cutoff_date
        )
        if site_id:
            inc_query = inc_query.filter(models.SafetyIncident.site_id == site_id)
        if area_id:
            inc_query = inc_query.filter(models.SafetyIncident.area_id == area_id)

        open_incidents = inc_query.all()
        raw_inc_score = sum(cls.INCIDENT_WEIGHTS.get(i.severity.upper(), 8.0) for i in open_incidents)
        inc_score = min(raw_inc_score, cls.INCIDENT_CAP)

        if open_incidents:
            reasons.append(f"{len(open_incidents)} unresolved human-reported safety incident(s)")

        # -------------------------------------------------------------
        # 3. Component C: Open Observations (OPEN / IN_PROGRESS)
        # -------------------------------------------------------------
        obs_query = db.query(models.Observation).filter(
            models.Observation.project_id == project_id,
            models.Observation.status.in_(["OPEN", "IN_PROGRESS"]),
            models.Observation.created_at >= cutoff_date
        )
        if site_id:
            obs_query = obs_query.filter(models.Observation.site_id == site_id)
        if area_id:
            obs_query = obs_query.filter(models.Observation.area_id == area_id)

        open_observations = obs_query.all()
        raw_obs_score = sum(cls.OBSERVATION_WEIGHTS.get(o.priority.upper(), 3.0) for o in open_observations)
        obs_score = min(raw_obs_score, cls.OBSERVATION_CAP)

        if open_observations:
            reasons.append(f"{len(open_observations)} open/in-progress site safety observation(s)")

        # -------------------------------------------------------------
        # 4. Component D: Failed Inspections
        # -------------------------------------------------------------
        insp_query = db.query(models.InspectionReport).filter(
            models.InspectionReport.project_id == project_id,
            models.InspectionReport.status == "FAILED",
            models.InspectionReport.created_at >= cutoff_date
        )
        if site_id:
            insp_query = insp_query.filter(models.InspectionReport.site_id == site_id)
        if area_id:
            insp_query = insp_query.filter(models.InspectionReport.area_id == area_id)

        failed_inspections = insp_query.all()
        raw_insp_score = len(failed_inspections) * cls.INSPECTION_WEIGHT
        insp_score = min(raw_insp_score, cls.INSPECTION_CAP)

        if failed_inspections:
            reasons.append(f"{len(failed_inspections)} failed quality/safety inspection(s)")

        # -------------------------------------------------------------
        # 5. Component E: Recurring Issues
        # -------------------------------------------------------------
        recurring_issues = RecurringIssueService.detect_recurring_issues(
            db=db,
            project_id=project_id,
            site_id=site_id,
            area_id=area_id,
            days=days
        )
        recurring_score = min(len(recurring_issues) * cls.RECURRING_WEIGHT, cls.RECURRING_CAP)

        for ri in recurring_issues:
            reasons.append(
                f"Recurring issue: {ri['occurrence_count']} occurrences of {ri['issue_type']} in {ri['area_name'] or 'site'}"
            )

        # -------------------------------------------------------------
        # 6. Component F: Trend Penalty / Bonus
        # -------------------------------------------------------------
        trend_data = TrendService.calculate_project_trends(
            db=db,
            project_id=project_id,
            site_id=site_id,
            area_id=area_id,
            days=days
        )
        safety_trend = trend_data.get("safety_trend", "STABLE")
        change_pct = trend_data.get("safety_change_pct", 0.0)

        if safety_trend == "INCREASING":
            trend_score = 10.0
            reasons.append(f"Safety violations increased +{change_pct}% compared with previous period")
        elif safety_trend == "DECREASING":
            trend_score = -5.0
            reasons.append(f"Safety indicators improved ({change_pct}% reduction vs previous period)")
        else:
            trend_score = 0.0

        # -------------------------------------------------------------
        # 7. Total Score & Clamping (0 - 100)
        # -------------------------------------------------------------
        raw_total = ai_score + inc_score + obs_score + insp_score + recurring_score + trend_score
        clamped_score = int(round(max(0.0, min(raw_total, 100.0))))

        # -------------------------------------------------------------
        # 8. Level Mapping
        # -------------------------------------------------------------
        if clamped_score >= 75:
            level = "CRITICAL"
        elif clamped_score >= 50:
            level = "HIGH"
        elif clamped_score >= 25:
            level = "MEDIUM"
        else:
            level = "LOW"

        # -------------------------------------------------------------
        # 9. Data Confidence Evaluation
        # -------------------------------------------------------------
        total_activity_count = (
            len(open_ai_findings) +
            len(open_incidents) +
            len(open_observations) +
            len(failed_inspections)
        )

        if total_activity_count == 0 and not recurring_issues:
            data_confidence = "LOW"
            if not reasons:
                reasons.append("No active safety issues or incidents recorded for the selected period.")
        elif total_activity_count < 3:
            data_confidence = "LOW"
            reasons.append(f"Low volume of active safety records ({total_activity_count} records) in selected window.")
        elif total_activity_count <= 8:
            data_confidence = "MEDIUM"
        else:
            data_confidence = "HIGH"

        return {
            "project_id": project_id,
            "site_id": site_id,
            "area_id": area_id,
            "time_window_days": days,
            "score": clamped_score,
            "level": level,
            "data_confidence": data_confidence,
            "components": {
                "ai_findings": ai_score,
                "incidents": inc_score,
                "observations": obs_score,
                "inspections": insp_score,
                "recurring": recurring_score,
                "trend": trend_score
            },
            "reasons": reasons,
            "disclaimer": "This risk score is an explainable project-management indicator based on current safety records, not a statistical probability of an accident."
        }

    @classmethod
    def calculate_and_persist_assessment(
        cls,
        db: Session,
        project_id: int,
        site_id: Optional[int] = None,
        area_id: Optional[int] = None,
        days: int = 7
    ) -> models.RiskAssessment:
        """
        Runs evaluate_risk and persists snapshot to risk_assessments and risk_reasons tables.
        """
        eval_result = cls.evaluate_risk(
            db=db,
            project_id=project_id,
            site_id=site_id,
            area_id=area_id,
            days=days
        )

        assessment = models.RiskAssessment(
            project_id=project_id,
            site_id=site_id,
            area_id=area_id,
            assessment_date=datetime.utcnow().strftime("%Y-%m-%d"),
            time_window_days=days,
            risk_score=eval_result["score"],
            risk_level=eval_result["level"],
            ai_findings_score=eval_result["components"]["ai_findings"],
            incident_score=eval_result["components"]["incidents"],
            observation_score=eval_result["components"]["observations"],
            inspection_score=eval_result["components"]["inspections"],
            recurring_issue_score=eval_result["components"]["recurring"],
            trend_score=eval_result["components"]["trend"],
            data_confidence=eval_result["data_confidence"]
        )
        db.add(assessment)
        db.commit()
        db.refresh(assessment)

        # Add reasons
        for r_msg in eval_result["reasons"]:
            reason_obj = models.RiskReason(
                risk_assessment_id=assessment.id,
                reason_type="SAFETY_INDICATOR",
                message=r_msg,
                impact_points=0.0
            )
            db.add(reason_obj)
        db.commit()

        return assessment
