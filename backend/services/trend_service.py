from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

import models

DEFAULT_TREND_TOLERANCE_PCT = 10.0


class TrendService:
    @staticmethod
    def calculate_project_trends(
        db: Session,
        project_id: int,
        site_id: Optional[int] = None,
        area_id: Optional[int] = None,
        days: int = 7,
        tolerance_pct: float = DEFAULT_TREND_TOLERANCE_PCT
    ) -> Dict[str, Any]:
        """
        Compares Current Period [now - days, now] vs Previous Period [now - 2*days, now - days]
        to calculate trend direction, percentage changes, and daily time series.
        """
        now = datetime.utcnow()
        current_cutoff = now - timedelta(days=days)
        previous_cutoff = now - timedelta(days=2 * days)

        # 1. Query Current Period Counts
        # A. AI Findings
        ai_curr_q = db.query(func.count(models.AISafetyFinding.id)).filter(
            models.AISafetyFinding.project_id == project_id,
            models.AISafetyFinding.created_at >= current_cutoff,
            models.AISafetyFinding.status != "FALSE_POSITIVE"
        )
        ai_prev_q = db.query(func.count(models.AISafetyFinding.id)).filter(
            models.AISafetyFinding.project_id == project_id,
            models.AISafetyFinding.created_at >= previous_cutoff,
            models.AISafetyFinding.created_at < current_cutoff,
            models.AISafetyFinding.status != "FALSE_POSITIVE"
        )

        # B. Human Incidents
        inc_curr_q = db.query(func.count(models.SafetyIncident.id)).filter(
            models.SafetyIncident.project_id == project_id,
            models.SafetyIncident.created_at >= current_cutoff
        )
        inc_prev_q = db.query(func.count(models.SafetyIncident.id)).filter(
            models.SafetyIncident.project_id == project_id,
            models.SafetyIncident.created_at >= previous_cutoff,
            models.SafetyIncident.created_at < current_cutoff
        )

        # C. Observations
        obs_curr_q = db.query(func.count(models.Observation.id)).filter(
            models.Observation.project_id == project_id,
            models.Observation.created_at >= current_cutoff
        )
        obs_prev_q = db.query(func.count(models.Observation.id)).filter(
            models.Observation.project_id == project_id,
            models.Observation.created_at >= previous_cutoff,
            models.Observation.created_at < current_cutoff
        )

        if site_id:
            ai_curr_q = ai_curr_q.filter(models.AISafetyFinding.site_id == site_id)
            ai_prev_q = ai_prev_q.filter(models.AISafetyFinding.site_id == site_id)
            inc_curr_q = inc_curr_q.filter(models.SafetyIncident.site_id == site_id)
            inc_prev_q = inc_prev_q.filter(models.SafetyIncident.site_id == site_id)
            obs_curr_q = obs_curr_q.filter(models.Observation.site_id == site_id)
            obs_prev_q = obs_prev_q.filter(models.Observation.site_id == site_id)

        if area_id:
            ai_curr_q = ai_curr_q.filter(models.AISafetyFinding.area_id == area_id)
            ai_prev_q = ai_prev_q.filter(models.AISafetyFinding.area_id == area_id)
            inc_curr_q = inc_curr_q.filter(models.SafetyIncident.area_id == area_id)
            inc_prev_q = inc_prev_q.filter(models.SafetyIncident.area_id == area_id)
            obs_curr_q = obs_curr_q.filter(models.Observation.area_id == area_id)
            obs_prev_q = obs_prev_q.filter(models.Observation.area_id == area_id)

        ai_curr = ai_curr_q.scalar() or 0
        ai_prev = ai_prev_q.scalar() or 0
        inc_curr = inc_curr_q.scalar() or 0
        inc_prev = inc_prev_q.scalar() or 0
        obs_curr = obs_curr_q.scalar() or 0
        obs_prev = obs_prev_q.scalar() or 0

        curr_total = ai_curr + inc_curr + obs_curr
        prev_total = ai_prev + inc_prev + obs_prev

        # Trend helper
        def calc_trend(curr: int, prev: int) -> tuple[str, float]:
            if prev == 0:
                if curr > 0:
                    return "INCREASING", 100.0
                return "STABLE", 0.0
            pct = round(((curr - prev) / prev) * 100.0, 1)
            if pct > tolerance_pct:
                return "INCREASING", pct
            elif pct < -tolerance_pct:
                return "DECREASING", pct
            else:
                return "STABLE", pct

        safety_trend, safety_change_pct = calc_trend(curr_total, prev_total)
        ppe_trend, _ = calc_trend(ai_curr, ai_prev)
        inc_trend, _ = calc_trend(inc_curr, inc_prev)
        obs_trend, _ = calc_trend(obs_curr, obs_prev)

        # Progress trend from DailyReport
        prog_curr_q = db.query(func.avg(models.DailyReport.progress_percentage)).filter(
            models.DailyReport.project_id == project_id,
            models.DailyReport.created_at >= current_cutoff,
            models.DailyReport.progress_percentage.isnot(None)
        )
        prog_prev_q = db.query(func.avg(models.DailyReport.progress_percentage)).filter(
            models.DailyReport.project_id == project_id,
            models.DailyReport.created_at >= previous_cutoff,
            models.DailyReport.created_at < current_cutoff,
            models.DailyReport.progress_percentage.isnot(None)
        )
        if site_id:
            prog_curr_q = prog_curr_q.filter(models.DailyReport.site_id == site_id)
            prog_prev_q = prog_prev_q.filter(models.DailyReport.site_id == site_id)
        if area_id:
            prog_curr_q = prog_curr_q.filter(models.DailyReport.area_id == area_id)
            prog_prev_q = prog_prev_q.filter(models.DailyReport.area_id == area_id)

        avg_prog_curr = prog_curr_q.scalar()
        avg_prog_prev = prog_prev_q.scalar()

        if avg_prog_curr is not None and avg_prog_prev is not None:
            diff = avg_prog_curr - avg_prog_prev
            if diff > 1.0:
                progress_trend = "IMPROVING"
            elif diff < -1.0:
                progress_trend = "DECLINING"
            else:
                progress_trend = "STABLE"
        elif avg_prog_curr is not None:
            progress_trend = "STABLE"
        else:
            progress_trend = "STABLE"

        # Daily time series for charts
        daily_series: List[Dict[str, Any]] = []
        for i in range(days - 1, -1, -1):
            day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            date_str = day_start.strftime("%Y-%m-%d")

            day_ai = db.query(func.count(models.AISafetyFinding.id)).filter(
                models.AISafetyFinding.project_id == project_id,
                models.AISafetyFinding.created_at >= day_start,
                models.AISafetyFinding.created_at < day_end,
                models.AISafetyFinding.status != "FALSE_POSITIVE"
            )
            day_inc = db.query(func.count(models.SafetyIncident.id)).filter(
                models.SafetyIncident.project_id == project_id,
                models.SafetyIncident.created_at >= day_start,
                models.SafetyIncident.created_at < day_end
            )
            day_obs = db.query(func.count(models.Observation.id)).filter(
                models.Observation.project_id == project_id,
                models.Observation.created_at >= day_start,
                models.Observation.created_at < day_end
            )
            if site_id:
                day_ai = day_ai.filter(models.AISafetyFinding.site_id == site_id)
                day_inc = day_inc.filter(models.SafetyIncident.site_id == site_id)
                day_obs = day_obs.filter(models.Observation.site_id == site_id)
            if area_id:
                day_ai = day_ai.filter(models.AISafetyFinding.area_id == area_id)
                day_inc = day_inc.filter(models.SafetyIncident.area_id == area_id)
                day_obs = day_obs.filter(models.Observation.area_id == area_id)

            ai_cnt = day_ai.scalar() or 0
            inc_cnt = day_inc.scalar() or 0
            obs_cnt = day_obs.scalar() or 0

            daily_series.append({
                "date": date_str,
                "ai_findings": ai_cnt,
                "incidents": inc_cnt,
                "observations": obs_cnt,
                "total_safety": ai_cnt + inc_cnt + obs_cnt
            })

        return {
            "project_id": project_id,
            "time_window_days": days,
            "safety_trend": safety_trend,
            "safety_change_pct": safety_change_pct,
            "current_safety_count": curr_total,
            "previous_safety_count": prev_total,
            "ppe_trend": ppe_trend,
            "incident_trend": inc_trend,
            "observation_trend": obs_trend,
            "progress_trend": progress_trend,
            "daily_series": daily_series
        }
