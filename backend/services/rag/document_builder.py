"""
Semantic Document Builder for Construction Domain Entities.
Transforms structured PostgreSQL database models into rich, natural-language
semantic documents preserving domain facts, spatial context, severity, and status.
"""

from typing import Dict, Any, Tuple
import models


class DocumentBuilder:
    @staticmethod
    def build_project(project: models.Project) -> Tuple[str, str, Dict[str, Any]]:
        title = f"Project: {project.name}"
        sites_str = f"{len(project.sites)} site(s)" if project.sites else "no sites registered"
        text = (
            f"Construction Project '{project.name}' (Status: {project.status}). "
            f"Location: {project.location or 'Solapur, Maharashtra'}. "
            f"Schedule: {project.start_date or 'N/A'} through {project.end_date or 'N/A'}. "
            f"Description: {project.description or 'Active multi-site construction development'}. "
            f"Project contains {sites_str}."
        )
        metadata = {"project_id": project.id, "status": project.status, "source_type": "PROJECT"}
        return title, text, metadata

    @staticmethod
    def build_site(site: models.Site) -> Tuple[str, str, Dict[str, Any]]:
        title = f"Site: {site.name} ({site.code if hasattr(site, 'code') and site.code else 'SITE'})"
        project_name = site.project.name if site.project else f"Project #{site.project_id}"
        areas_str = f"{len(site.areas)} area(s)/zone(s)" if site.areas else "no specific zones"
        text = (
            f"Construction Site '{site.name}' under {project_name}. "
            f"Address/Location: {site.address or 'On project grounds'}. "
            f"Description: {site.description or 'Active site zone'}. "
            f"Contains {areas_str}."
        )
        metadata = {"project_id": site.project_id, "site_id": site.id, "source_type": "SITE"}
        return title, text, metadata

    @staticmethod
    def build_area(area: models.Area) -> Tuple[str, str, Dict[str, Any]]:
        title = f"Area: {area.name} ({area.code if hasattr(area, 'code') and area.code else 'ZONE'})"
        site_name = area.site.name if area.site else f"Site #{area.site_id}"
        project_id = area.site.project_id if area.site else None
        text = (
            f"Construction Area/Zone '{area.name}' located at {site_name}. "
            f"Zone Type: {area.area_type or 'General Work Area'}. "
            f"Description: {area.description or 'Operational work zone'}."
        )
        metadata = {"project_id": project_id, "site_id": area.site_id, "area_id": area.id, "source_type": "AREA"}
        return title, text, metadata

    @staticmethod
    def build_safety_incident(inc: models.SafetyIncident) -> Tuple[str, str, Dict[str, Any]]:
        title = f"Safety Incident #{inc.id}: {inc.incident_type} ({inc.severity})"
        site_name = inc.site.name if inc.site else f"Site #{inc.site_id}"
        area_name = inc.area.name if inc.area else "Overall Site"
        action_str = f"Action taken: {inc.action_taken}" if inc.action_taken else "No corrective action recorded yet."
        text = (
            f"Safety Incident #{inc.id}. A {inc.severity.lower()} severity {inc.incident_type.replace('_', ' ').lower()} "
            f"incident occurred on {inc.incident_date} at {site_name} in {area_name}. "
            f"Current status is {inc.status}. Narrative: {inc.description}. {action_str}"
        )
        metadata = {
            "project_id": inc.project_id,
            "site_id": inc.site_id,
            "area_id": inc.area_id,
            "severity": inc.severity,
            "incident_type": inc.incident_type,
            "status": inc.status,
            "date": str(inc.incident_date),
            "source_type": "INCIDENT"
        }
        return title, text, metadata

    @staticmethod
    def build_inspection(insp: models.InspectionReport) -> Tuple[str, str, Dict[str, Any]]:
        title = f"Inspection Report #{insp.id}: {insp.inspection_type} ({insp.status})"
        site_name = insp.site.name if insp.site else f"Site #{insp.site_id}"
        area_name = insp.area.name if insp.area else "Overall Site"
        findings_str = f"Findings: {insp.findings}" if insp.findings else "No critical findings noted."
        rec_str = f"Recommendations: {insp.recommendations}" if insp.recommendations else "No recommendations noted."
        text = (
            f"Quality & Safety Inspection #{insp.id}. A {insp.inspection_type.replace('_', ' ').lower()} inspection "
            f"was conducted on {insp.inspection_date} at {site_name} in {area_name}. "
            f"Evaluation outcome: {insp.status}. {findings_str} {rec_str}"
        )
        metadata = {
            "project_id": insp.project_id,
            "site_id": insp.site_id,
            "area_id": insp.area_id,
            "status": insp.status,
            "inspection_type": insp.inspection_type,
            "date": str(insp.inspection_date),
            "source_type": "INSPECTION"
        }
        return title, text, metadata

    @staticmethod
    def build_observation(obs: models.Observation) -> Tuple[str, str, Dict[str, Any]]:
        title = f"Observation #{obs.id}: {obs.title} ({obs.priority})"
        site_name = obs.site.name if obs.site else f"Site #{obs.site_id}"
        area_name = obs.area.name if obs.area else "Overall Site"
        text = (
            f"Site Observation #{obs.id}: '{obs.title}'. Priority: {obs.priority}. "
            f"Category: {obs.observation_type.replace('_', ' ').lower()}. Current status: {obs.status}. "
            f"Observed at {site_name} in {area_name}. Details: {obs.description}."
        )
        metadata = {
            "project_id": obs.project_id,
            "site_id": obs.site_id,
            "area_id": obs.area_id,
            "priority": obs.priority,
            "type": obs.observation_type,
            "status": obs.status,
            "source_type": "OBSERVATION"
        }
        return title, text, metadata

    @staticmethod
    def build_daily_report(rep: models.DailyReport) -> Tuple[str, str, Dict[str, Any]]:
        title = f"Daily Report ({rep.report_date})"
        site_name = rep.site.name if rep.site else f"Site #{rep.site_id}"
        area_name = rep.area.name if rep.area else "Overall Site"
        blockers_str = f"Site Blockers: {rep.blockers}" if rep.blockers else "No active blockers reported."
        notes_str = f"Supervisor Notes: {rep.notes}" if rep.notes else "No additional notes."
        text = (
            f"Daily Site Report #{rep.id} dated {rep.report_date} for {site_name} in {area_name}. "
            f"Work completed today: {rep.work_completed or 'Scheduled daily progress'}. "
            f"Work planned next: {rep.work_planned or 'Standard tasks'}. "
            f"Workforce count: {rep.workers_count or 0} workers. Progress: {rep.progress_percentage or 0}%. "
            f"Weather: {rep.weather or 'Normal'}. {blockers_str} {notes_str}"
        )
        metadata = {
            "project_id": rep.project_id,
            "site_id": rep.site_id,
            "area_id": rep.area_id,
            "date": str(rep.report_date),
            "workers_count": rep.workers_count or 0,
            "source_type": "DAILY_REPORT"
        }
        return title, text, metadata

    @staticmethod
    def build_material(mat: models.Material) -> Tuple[str, str, Dict[str, Any]]:
        title = f"Material #{mat.id}: {mat.material_name} ({mat.status})"
        site_name = mat.site.name if mat.site else f"Site #{mat.site_id}"
        area_name = mat.area.name if mat.area else "General Storage"
        notes_str = f"Notes: {mat.notes}" if mat.notes else ""
        supplier_str = f"Supplier: {mat.supplier}" if mat.supplier else ""
        text = (
            f"Material Tracking #{mat.id}: {mat.material_name}. Category: {mat.category or 'General'}. "
            f"Inventory: {mat.quantity} {mat.unit}. Status: {mat.status}. "
            f"Stored at {site_name} in {area_name}. {supplier_str} {notes_str}"
        )
        metadata = {
            "project_id": mat.project_id,
            "site_id": mat.site_id,
            "area_id": mat.area_id,
            "status": mat.status,
            "source_type": "MATERIAL"
        }
        return title, text, metadata

    @staticmethod
    def build_ai_safety_finding(finding: models.AISafetyFinding) -> Tuple[str, str, Dict[str, Any]]:
        title = f"AI Vision Finding #{finding.id}: {finding.title}"
        site_name = finding.site.name if finding.site else f"Site #{finding.site_id}"
        area_name = finding.area.name if finding.area else "Visual Field"
        is_violation = "WITHOUT" in finding.finding_type or finding.severity in ["HIGH", "CRITICAL"]
        category = "PPE Violation" if is_violation else "PPE Compliance Confirmation"
        text = (
            f"AI Vision Finding #{finding.id}: {finding.title}. Classification: {category}. "
            f"Detection Type: {finding.finding_type}. Severity: {finding.severity}. "
            f"Confidence: {round(finding.confidence * 100)}%. Status: {finding.status}. "
            f"Captured at {site_name} in {area_name}. Observation: {finding.description}."
        )
        metadata = {
            "project_id": finding.project_id,
            "site_id": finding.site_id,
            "area_id": finding.area_id,
            "finding_type": finding.finding_type,
            "severity": finding.severity,
            "status": finding.status,
            "is_violation": is_violation,
            "source_type": "AI_FINDING"
        }
        return title, text, metadata

    @staticmethod
    def build_photo(photo: models.SitePhoto) -> Tuple[str, str, Dict[str, Any]]:
        title = f"Site Photo #{photo.id}: {photo.caption or 'Site Photograph'}"
        site_name = photo.site.name if photo.site else f"Site #{photo.site_id}"
        area_name = photo.area.name if photo.area else "Overall Site"
        findings_count = len(photo.safety_findings) if photo.safety_findings else 0
        date_str = photo.created_at.strftime("%Y-%m-%d") if photo.created_at else "recent"
        text = (
            f"Site Photo #{photo.id} recorded on {date_str} at {site_name} in {area_name}. "
            f"Caption: {photo.caption or 'Construction site photographic record'}. "
            f"Analyzed by YOLO PPE vision model with {findings_count} safety finding(s) detected."
        )
        metadata = {
            "project_id": photo.project_id,
            "site_id": photo.site_id,
            "area_id": photo.area_id,
            "source_type": "PHOTO"
        }
        return title, text, metadata
