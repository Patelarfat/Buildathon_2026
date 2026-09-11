from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

import models
from services.ppe_constants import AI_PPE_VIOLATION_TYPES, AI_PPE_COMPLIANCE_TYPES
from services.risk_engine import RiskEngine
from services.recurring_issue_service import RecurringIssueService
from services.trend_service import TrendService


class IntelligenceService:
    @staticmethod
    def get_area_risk_ranking(
        db: Session,
        project_id: int,
        days: int = 7
    ) -> List[Dict[str, Any]]:
        """
        Calculates and ranks all areas under a project by safety risk score descending.
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        areas = (
            db.query(models.Area)
            .join(models.Site, models.Area.site_id == models.Site.id)
            .filter(models.Site.project_id == project_id)
            .all()
        )

        ranking: List[Dict[str, Any]] = []

        for area in areas:
            site = db.query(models.Site).filter(models.Site.id == area.site_id).first()
            risk_eval = RiskEngine.evaluate_risk(
                db=db,
                project_id=project_id,
                site_id=area.site_id,
                area_id=area.id,
                days=days
            )

            # Counts for table display (Violations only for AI)
            ai_count = db.query(func.count(models.AISafetyFinding.id)).filter(
                models.AISafetyFinding.area_id == area.id,
                models.AISafetyFinding.finding_type.in_(AI_PPE_VIOLATION_TYPES),
                models.AISafetyFinding.created_at >= cutoff_date,
                models.AISafetyFinding.status != "FALSE_POSITIVE"
            ).scalar() or 0

            inc_count = db.query(func.count(models.SafetyIncident.id)).filter(
                models.SafetyIncident.area_id == area.id,
                models.SafetyIncident.created_at >= cutoff_date
            ).scalar() or 0

            obs_count = db.query(func.count(models.Observation.id)).filter(
                models.Observation.area_id == area.id,
                models.Observation.created_at >= cutoff_date,
                models.Observation.status != "RESOLVED"
            ).scalar() or 0

            trend_data = TrendService.calculate_project_trends(
                db=db,
                project_id=project_id,
                site_id=area.site_id,
                area_id=area.id,
                days=days
            )

            ranking.append({
                "area_id": area.id,
                "area_name": area.name,
                "site_id": area.site_id,
                "site_name": site.name if site else "Unknown Site",
                "risk_score": risk_eval["score"],
                "risk_level": risk_eval["level"],
                "open_issues": obs_count + (1 if inc_count > 0 else 0) + (1 if ai_count > 0 else 0),
                "ai_findings_count": ai_count,
                "incidents_count": inc_count,
                "observations_count": obs_count,
                "trend": trend_data.get("safety_trend", "STABLE"),
                "reasons": risk_eval["reasons"]
            })

        # Sort highest risk score first
        ranking.sort(key=lambda x: x["risk_score"], reverse=True)
        return ranking

    @staticmethod
    def get_safety_summary(
        db: Session,
        project_id: int,
        site_id: Optional[int] = None,
        area_id: Optional[int] = None,
        days: int = 7
    ) -> Dict[str, Any]:
        """
        Consolidates human vs AI safety metrics, inspection results, and PPE breakdown.
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        # 1. AI Findings
        ai_q = db.query(models.AISafetyFinding).filter(
            models.AISafetyFinding.project_id == project_id,
            models.AISafetyFinding.created_at >= cutoff_date,
            models.AISafetyFinding.status != "FALSE_POSITIVE"
        )
        if site_id:
            ai_q = ai_q.filter(models.AISafetyFinding.site_id == site_id)
        if area_id:
            ai_q = ai_q.filter(models.AISafetyFinding.area_id == area_id)

        all_ai = ai_q.all()
        ai_total = len(all_ai)
        ai_open = sum(1 for f in all_ai if f.status == "OPEN")

        # Separate actual violations from compliant detections
        violations_list = [f for f in all_ai if f.finding_type in AI_PPE_VIOLATION_TYPES]
        ai_viol_total = len(violations_list)
        ai_viol_open = sum(1 for f in violations_list if f.status == "OPEN")

        # Exact PPE Breakdown for actual violations
        no_helmet = sum(1 for f in all_ai if f.finding_type == "PERSON_WITHOUT_HELMET")
        no_gloves = sum(1 for f in all_ai if f.finding_type == "PERSON_WITHOUT_GLOVES")
        no_boots = sum(1 for f in all_ai if f.finding_type == "PERSON_WITHOUT_BOOTS")
        no_goggles = sum(1 for f in all_ai if f.finding_type == "PERSON_WITHOUT_GOGGLES")
        other_viol = sum(1 for f in all_ai if f.finding_type in AI_PPE_VIOLATION_TYPES and f.finding_type not in {
            "PERSON_WITHOUT_HELMET", "PERSON_WITHOUT_GLOVES", "PERSON_WITHOUT_BOOTS", "PERSON_WITHOUT_GOGGLES"
        })

        # Compliant AI findings
        compliant_cnt = sum(1 for f in all_ai if f.finding_type in AI_PPE_COMPLIANCE_TYPES or f.severity.upper() == "INFO")

        # 2. Human Incidents
        inc_q = db.query(models.SafetyIncident).filter(
            models.SafetyIncident.project_id == project_id,
            models.SafetyIncident.created_at >= cutoff_date
        )
        if site_id:
            inc_q = inc_q.filter(models.SafetyIncident.site_id == site_id)
        if area_id:
            inc_q = inc_q.filter(models.SafetyIncident.area_id == area_id)

        all_inc = inc_q.all()
        inc_total = len(all_inc)
        inc_open = sum(1 for i in all_inc if i.status in ["OPEN", "UNDER_REVIEW"])

        # 3. Observations
        obs_q = db.query(models.Observation).filter(
            models.Observation.project_id == project_id,
            models.Observation.created_at >= cutoff_date
        )
        if site_id:
            obs_q = obs_q.filter(models.Observation.site_id == site_id)
        if area_id:
            obs_q = obs_q.filter(models.Observation.area_id == area_id)

        all_obs = obs_q.all()
        obs_total = len(all_obs)
        obs_open = sum(1 for o in all_obs if o.status != "RESOLVED")

        # Resolution time
        resolved_obs = [o for o in all_obs if o.status == "RESOLVED" and o.resolved_at]
        avg_res_hours: Optional[float] = None
        if resolved_obs:
            durations = []
            for o in resolved_obs:
                try:
                    # Attempt parsing ISO or timestamp
                    res_dt = datetime.fromisoformat(o.resolved_at.replace("Z", "+00:00"))
                    diff = (res_dt.replace(tzinfo=None) - o.created_at).total_seconds() / 3600.0
                    if diff >= 0:
                        durations.append(diff)
                except Exception:
                    pass
            if durations:
                avg_res_hours = round(sum(durations) / len(durations), 1)

        # Oldest unresolved
        unresolved_obs = [o for o in all_obs if o.status != "RESOLVED"]
        oldest_days: Optional[int] = None
        if unresolved_obs:
            oldest_created = min(o.created_at for o in unresolved_obs)
            oldest_days = (datetime.utcnow() - oldest_created).days

        # 4. Inspections
        insp_q = db.query(models.InspectionReport).filter(
            models.InspectionReport.project_id == project_id,
            models.InspectionReport.created_at >= cutoff_date
        )
        if site_id:
            insp_q = insp_q.filter(models.InspectionReport.site_id == site_id)
        if area_id:
            insp_q = insp_q.filter(models.InspectionReport.area_id == area_id)

        all_insp = insp_q.all()
        insp_total = len(all_insp)
        insp_failed = sum(1 for i in all_insp if i.status == "FAILED")
        insp_passed = sum(1 for i in all_insp if i.status == "PASSED")
        insp_action = sum(1 for i in all_insp if i.status == "REQUIRES_ACTION")
        failure_rate = round((insp_failed / insp_total * 100.0), 1) if insp_total > 0 else 0.0

        ratio_str = f"{ai_total} AI findings vs {inc_total} human incidents"

        return {
            "project_id": project_id,
            "time_window_days": days,
            "ai_findings_total": ai_total,
            "ai_findings_open": ai_open,
            "ai_violations_total": ai_viol_total,
            "ai_violations_open": ai_viol_open,
            "human_incidents_total": inc_total,
            "human_incidents_open": inc_open,
            "observations_total": obs_total,
            "observations_open": obs_open,
            "inspections_total": insp_total,
            "inspections_failed": insp_failed,
            "inspections_passed": insp_passed,
            "inspections_requires_action": insp_action,
            "inspection_failure_rate_pct": failure_rate,
            "avg_resolution_time_hours": avg_res_hours,
            "oldest_unresolved_days": oldest_days,
            "ppe_breakdown": {
                "no_helmet": no_helmet,
                "no_gloves": no_gloves,
                "no_boots": no_boots,
                "no_goggles": no_goggles,
                "other_violations": other_viol,
                "compliant_detections": compliant_cnt,
                "total_ai_findings": ai_total
            },
            "human_vs_ai_ratio": ratio_str
        }

    @staticmethod
    def get_operational_risk(
        db: Session,
        project_id: int,
        site_id: Optional[int] = None,
        area_id: Optional[int] = None,
        days: int = 7
    ) -> Dict[str, Any]:
        """
        Summarizes operational risks: low stock materials, delivery delays, daily report blockers.
        Note: Kept separate from Safety Risk Score.
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        # Low stock materials
        mat_q = db.query(models.Material).filter(
            models.Material.project_id == project_id,
            models.Material.status == "LOW_STOCK"
        )
        if site_id:
            mat_q = mat_q.filter(models.Material.site_id == site_id)
        if area_id:
            mat_q = mat_q.filter(models.Material.area_id == area_id)
        low_stock = mat_q.all()

        # Delayed materials (notes containing delay or status == 'ORDERED' past delivery date)
        delayed_q = db.query(models.Material).filter(
            models.Material.project_id == project_id,
            models.Material.status == "ORDERED"
        )
        if site_id:
            delayed_q = delayed_q.filter(models.Material.site_id == site_id)
        if area_id:
            delayed_q = delayed_q.filter(models.Material.area_id == area_id)
        delayed_mats = delayed_q.all()

        # Daily report blockers
        rep_q = db.query(models.DailyReport).filter(
            models.DailyReport.project_id == project_id,
            models.DailyReport.created_at >= cutoff_date,
            models.DailyReport.blockers.isnot(None),
            models.DailyReport.blockers != ""
        )
        if site_id:
            rep_q = rep_q.filter(models.DailyReport.site_id == site_id)
        if area_id:
            rep_q = rep_q.filter(models.DailyReport.area_id == area_id)
        blocked_reps = rep_q.all()

        blockers_list = [f"{r.report_date}: {r.blockers}" for r in blocked_reps]

        # Progress concerns
        concerns = []
        if len(low_stock) > 0:
            concerns.append(f"{len(low_stock)} material item(s) are at LOW_STOCK level")
        if len(blocked_reps) > 0:
            concerns.append(f"{len(blocked_reps)} daily report(s) noted active site blockers")

        # Level determination
        if len(low_stock) >= 3 or len(blocked_reps) >= 3:
            op_level = "HIGH"
        elif len(low_stock) > 0 or len(blocked_reps) > 0:
            op_level = "MEDIUM"
        else:
            op_level = "LOW"

        return {
            "project_id": project_id,
            "low_stock_materials": low_stock,
            "delayed_materials": delayed_mats,
            "open_blockers": blockers_list,
            "progress_concerns": concerns,
            "operational_risk_level": op_level
        }

    @staticmethod
    def get_progress_intelligence(
        db: Session,
        project_id: int,
        site_id: Optional[int] = None,
        area_id: Optional[int] = None,
        days: int = 7
    ) -> Dict[str, Any]:
        """
        Extracts progress trends, workforce count, and blocker summaries from daily reports.
        """
        now = datetime.utcnow()
        current_cutoff = now - timedelta(days=days)
        previous_cutoff = now - timedelta(days=2 * days)

        curr_q = db.query(models.DailyReport).filter(
            models.DailyReport.project_id == project_id,
            models.DailyReport.created_at >= current_cutoff
        )
        prev_q = db.query(models.DailyReport).filter(
            models.DailyReport.project_id == project_id,
            models.DailyReport.created_at >= previous_cutoff,
            models.DailyReport.created_at < current_cutoff
        )

        if site_id:
            curr_q = curr_q.filter(models.DailyReport.site_id == site_id)
            prev_q = prev_q.filter(models.DailyReport.site_id == site_id)
        if area_id:
            curr_q = curr_q.filter(models.DailyReport.area_id == area_id)
            prev_q = prev_q.filter(models.DailyReport.area_id == area_id)

        curr_reports = curr_q.order_by(models.DailyReport.id.desc()).all()
        prev_reports = prev_q.all()

        total_reports = len(curr_reports)
        blocked_days = sum(1 for r in curr_reports if r.blockers and len(r.blockers.strip()) > 0)

        # Progress %
        progress_values = [r.progress_percentage for r in curr_reports if r.progress_percentage is not None]
        avg_prog = round(sum(progress_values) / len(progress_values), 1) if progress_values else None
        latest_prog = curr_reports[0].progress_percentage if (curr_reports and curr_reports[0].progress_percentage is not None) else None

        prev_progress = [r.progress_percentage for r in prev_reports if r.progress_percentage is not None]
        prev_avg_prog = round(sum(prev_progress) / len(prev_progress), 1) if prev_progress else None

        prog_change: Optional[float] = None
        if avg_prog is not None and prev_avg_prog is not None:
            prog_change = round(avg_prog - prev_avg_prog, 1)

        if prog_change is not None:
            if prog_change > 1.0:
                prog_trend = "IMPROVING"
            elif prog_change < -1.0:
                prog_trend = "DECLINING"
            else:
                prog_trend = "STABLE"
        else:
            prog_trend = "STABLE"

        # Workforce
        worker_values = [r.workers_count for r in curr_reports if r.workers_count is not None]
        avg_workers = round(sum(worker_values) / len(worker_values), 1) if worker_values else None
        latest_workers = curr_reports[0].workers_count if (curr_reports and curr_reports[0].workers_count is not None) else None

        return {
            "project_id": project_id,
            "time_window_days": days,
            "latest_progress_pct": latest_prog,
            "average_progress_pct": avg_prog,
            "previous_period_progress_pct": prev_avg_prog,
            "progress_change_pct": prog_change,
            "progress_trend": prog_trend,
            "latest_workers": latest_workers,
            "average_workers": avg_workers,
            "total_reports": total_reports,
            "blocked_days_count": blocked_days
        }

    @classmethod
    def get_full_project_intelligence(
        cls,
        db: Session,
        project_id: int,
        days: int = 7
    ) -> Dict[str, Any]:
        """
        Consolidates all Phase 5 intelligence engines into a single master response.
        """
        project_risk = RiskEngine.evaluate_risk(db=db, project_id=project_id, days=days)
        area_risks = cls.get_area_risk_ranking(db=db, project_id=project_id, days=days)
        recurring_issues = RecurringIssueService.detect_recurring_issues(db=db, project_id=project_id, days=days)
        trends = TrendService.calculate_project_trends(db=db, project_id=project_id, days=days)
        safety_summary = cls.get_safety_summary(db=db, project_id=project_id, days=days)
        progress = cls.get_progress_intelligence(db=db, project_id=project_id, days=days)
        operational_risk = cls.get_operational_risk(db=db, project_id=project_id, days=days)

        highest_site: Optional[str] = None
        highest_area: Optional[str] = None

        if area_risks:
            highest_area_obj = area_risks[0]
            highest_area = f"{highest_area_obj['area_name']} ({highest_area_obj['risk_score']} {highest_area_obj['risk_level']})"
            highest_site = highest_area_obj['site_name']

        return {
            "project_id": project_id,
            "time_window_days": days,
            "project_risk": project_risk,
            "highest_risk_site": highest_site,
            "highest_risk_area": highest_area,
            "area_risks": area_risks,
            "recurring_issues": recurring_issues,
            "trends": trends,
            "safety_summary": safety_summary,
            "progress": progress,
            "operational_risk": operational_risk
        }
