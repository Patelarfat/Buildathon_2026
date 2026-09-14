"""
Semantic Document Builder for Construction Domain Entities (RAG4CM Hierarchical Representation).
Transforms structured PostgreSQL database models into rich, natural-language semantic documents
preserving domain facts, spatial context, severity, status, and strict construction hierarchy:
Project -> Site -> Area -> Record.
"""

import json
from typing import Dict, Any, Tuple, Optional
import models


class DocumentBuilder:
    """
    Builds rich, grounded construction documents embedding both factual content
    and construction knowledge hierarchy (Project -> Site -> Area -> Record).
    """

    @staticmethod
    def _build_hierarchy_header(
        project_name: Optional[str] = None,
        site_name: Optional[str] = None,
        area_name: Optional[str] = None,
    ) -> Tuple[str, str]:
        """
        Constructs standardized RAG4CM hierarchy text and unified path string.
        """
        parts = []
        if project_name:
            parts.append(project_name)
        if site_name:
            parts.append(site_name)
        if area_name:
            parts.append(area_name)

        hierarchy_path = " → ".join(parts) if parts else "Construction Project"

        header_lines = []
        if project_name:
            header_lines.append(f"PROJECT: {project_name}")
        if site_name:
            header_lines.append(f"SITE: {site_name}")
        if area_name:
            header_lines.append(f"AREA: {area_name}")
        header_lines.append(f"HIERARCHY: {hierarchy_path}")

        return "\n".join(header_lines), hierarchy_path

    @classmethod
    def build_project(cls, project: models.Project) -> Tuple[str, str, Dict[str, Any]]:
        title = f"Project: {project.name}"
        sites_str = f"{len(project.sites)} site(s)" if project.sites else "no sites registered"
        
        hierarchy_header, hierarchy_path = cls._build_hierarchy_header(
            project_name=project.name
        )

        meta_lines = [
            "SOURCE TYPE: Project",
            f"TITLE: {project.name}",
            f"STATUS: {project.status}",
        ]
        if project.location:
            meta_lines.append(f"LOCATION: {project.location}")
        if project.start_date or project.end_date:
            meta_lines.append(f"SCHEDULE: {project.start_date or 'N/A'} through {project.end_date or 'N/A'}")

        content_body = (
            f"Construction Project '{project.name}' (Status: {project.status}). "
            f"Location: {project.location or 'Maharashtra'}. "
            f"Schedule: {project.start_date or 'N/A'} through {project.end_date or 'N/A'}. "
            f"Description: {project.description or 'Active multi-site construction development'}. "
            f"Project contains {sites_str}."
        )

        meta_str = "\n".join(meta_lines)
        full_document = (
            f"{hierarchy_header}\n"
            f"{meta_str}\n\n"
            f"CONTENT:\n{content_body}"
        )

        metadata = {
            "project_id": project.id,
            "source_type": "PROJECT",
            "source_id": project.id,
            "title": project.name,
            "status": project.status,
            "hierarchy_path": hierarchy_path,
            "project_name": project.name
        }
        return title, full_document, metadata

    @classmethod
    def build_site(cls, site: models.Site) -> Tuple[str, str, Dict[str, Any]]:
        title = f"Site: {site.name} ({site.code if hasattr(site, 'code') and site.code else 'SITE'})"
        project_name = site.project.name if site.project else f"Project #{site.project_id}"
        areas_str = f"{len(site.areas)} area(s)/zone(s)" if site.areas else "no specific zones"

        hierarchy_header, hierarchy_path = cls._build_hierarchy_header(
            project_name=project_name,
            site_name=site.name
        )

        meta_lines = [
            "SOURCE TYPE: Site",
            f"TITLE: {site.name}",
        ]
        if site.address:
            meta_lines.append(f"ADDRESS: {site.address}")

        content_body = (
            f"Construction Site '{site.name}' under {project_name}. "
            f"Address/Location: {site.address or 'On project grounds'}. "
            f"Description: {site.description or 'Active site zone'}. "
            f"Contains {areas_str}."
        )

        meta_str = "\n".join(meta_lines)
        full_document = (
            f"{hierarchy_header}\n"
            f"{meta_str}\n\n"
            f"CONTENT:\n{content_body}"
        )

        metadata = {
            "project_id": site.project_id,
            "site_id": site.id,
            "source_type": "SITE",
            "source_id": site.id,
            "title": site.name,
            "hierarchy_path": hierarchy_path,
            "project_name": project_name,
            "site_name": site.name
        }
        return title, full_document, metadata

    @classmethod
    def build_area(cls, area: models.Area) -> Tuple[str, str, Dict[str, Any]]:
        title = f"Area: {area.name} ({area.code if hasattr(area, 'code') and area.code else 'ZONE'})"
        site_name = area.site.name if area.site else f"Site #{area.site_id}"
        project_name = area.site.project.name if (area.site and area.site.project) else None
        project_id = area.site.project_id if area.site else None

        hierarchy_header, hierarchy_path = cls._build_hierarchy_header(
            project_name=project_name,
            site_name=site_name,
            area_name=area.name
        )

        meta_lines = [
            "SOURCE TYPE: Area",
            f"TITLE: {area.name}",
            f"ZONE TYPE: {area.area_type or 'General Work Area'}",
        ]

        content_body = (
            f"Construction Area/Zone '{area.name}' located at {site_name}. "
            f"Zone Type: {area.area_type or 'General Work Area'}. "
            f"Description: {area.description or 'Operational work zone'}."
        )

        meta_str = "\n".join(meta_lines)
        full_document = (
            f"{hierarchy_header}\n"
            f"{meta_str}\n\n"
            f"CONTENT:\n{content_body}"
        )

        metadata = {
            "project_id": project_id,
            "site_id": area.site_id,
            "area_id": area.id,
            "source_type": "AREA",
            "source_id": area.id,
            "title": area.name,
            "area_name": area.name,
            "area_type": area.area_type,
            "hierarchy_path": hierarchy_path,
            "project_name": project_name or "",
            "site_name": site_name
        }
        return title, full_document, metadata

    @classmethod
    def build_safety_incident(cls, inc: models.SafetyIncident) -> Tuple[str, str, Dict[str, Any]]:
        title = f"Safety Incident #{inc.id}: {inc.incident_type} ({inc.severity})"
        project_name = inc.project.name if inc.project else (inc.site.project.name if inc.site and inc.site.project else None)
        site_name = inc.site.name if inc.site else f"Site #{inc.site_id}"
        area_name = inc.area.name if inc.area else None

        hierarchy_header, hierarchy_path = cls._build_hierarchy_header(
            project_name=project_name,
            site_name=site_name,
            area_name=area_name
        )

        action_str = f"Action taken: {inc.action_taken}" if inc.action_taken else "No corrective action recorded yet."
        area_display = area_name or "Overall Site"

        meta_lines = [
            "SOURCE TYPE: Safety Incident",
            f"TITLE: Safety Incident #{inc.id}: {inc.incident_type}",
            f"SEVERITY: {inc.severity}",
            f"STATUS: {inc.status}",
            f"DATE: {inc.incident_date}",
        ]

        content_body = (
            f"Safety Incident #{inc.id}. A {inc.severity.lower()} severity {inc.incident_type.replace('_', ' ').lower()} "
            f"incident occurred on {inc.incident_date} at {site_name} in {area_display}. "
            f"Current status is {inc.status}. Narrative: {inc.description}. {action_str}"
        )

        meta_str = "\n".join(meta_lines)
        full_document = (
            f"{hierarchy_header}\n"
            f"{meta_str}\n\n"
            f"CONTENT:\n{content_body}"
        )

        metadata = {
            "project_id": inc.project_id,
            "site_id": inc.site_id,
            "area_id": inc.area_id,
            "severity": inc.severity,
            "incident_type": inc.incident_type,
            "status": inc.status,
            "date": str(inc.incident_date),
            "source_type": "INCIDENT",
            "source_id": inc.id,
            "title": f"Safety Incident #{inc.id}: {inc.incident_type}",
            "hierarchy_path": hierarchy_path,
            "area_name": area_name or ""
        }
        return title, full_document, metadata

    @classmethod
    def build_inspection(cls, insp: models.InspectionReport) -> Tuple[str, str, Dict[str, Any]]:
        title = f"Inspection Report #{insp.id}: {insp.inspection_type} ({insp.status})"
        project_name = insp.project.name if insp.project else (insp.site.project.name if insp.site and insp.site.project else None)
        site_name = insp.site.name if insp.site else f"Site #{insp.site_id}"
        area_name = insp.area.name if insp.area else None

        hierarchy_header, hierarchy_path = cls._build_hierarchy_header(
            project_name=project_name,
            site_name=site_name,
            area_name=area_name
        )

        findings_str = f"Findings: {insp.findings}" if insp.findings else "No critical findings noted."
        rec_str = f"Recommendations: {insp.recommendations}" if insp.recommendations else "No recommendations noted."
        area_display = area_name or "Overall Site"

        meta_lines = [
            "SOURCE TYPE: Inspection Report",
            f"TITLE: Inspection Report #{insp.id}: {insp.inspection_type}",
            f"STATUS: {insp.status}",
            f"DATE: {insp.inspection_date}",
        ]

        content_body = (
            f"Quality & Safety Inspection #{insp.id}. A {insp.inspection_type.replace('_', ' ').lower()} inspection "
            f"was conducted on {insp.inspection_date} at {site_name} in {area_display}. "
            f"Evaluation outcome: {insp.status}. {findings_str} {rec_str}"
        )

        meta_str = "\n".join(meta_lines)
        full_document = (
            f"{hierarchy_header}\n"
            f"{meta_str}\n\n"
            f"CONTENT:\n{content_body}"
        )

        metadata = {
            "project_id": insp.project_id,
            "site_id": insp.site_id,
            "area_id": insp.area_id,
            "status": insp.status,
            "inspection_type": insp.inspection_type,
            "date": str(insp.inspection_date),
            "source_type": "INSPECTION",
            "source_id": insp.id,
            "title": f"Inspection Report #{insp.id}: {insp.inspection_type}",
            "hierarchy_path": hierarchy_path,
            "area_name": area_name or ""
        }
        return title, full_document, metadata

    @classmethod
    def build_observation(cls, obs: models.Observation) -> Tuple[str, str, Dict[str, Any]]:
        title = f"Observation #{obs.id}: {obs.title} ({obs.priority})"
        project_name = obs.project.name if obs.project else (obs.site.project.name if obs.site and obs.site.project else None)
        site_name = obs.site.name if obs.site else f"Site #{obs.site_id}"
        area_name = obs.area.name if obs.area else None

        hierarchy_header, hierarchy_path = cls._build_hierarchy_header(
            project_name=project_name,
            site_name=site_name,
            area_name=area_name
        )

        area_display = area_name or "Overall Site"

        meta_lines = [
            "SOURCE TYPE: Observation",
            f"TITLE: Observation #{obs.id}: {obs.title}",
            f"PRIORITY: {obs.priority}",
            f"STATUS: {obs.status}",
            f"CATEGORY: {obs.observation_type}",
        ]
        if obs.observed_at:
            meta_lines.append(f"DATE: {obs.observed_at}")

        content_body = (
            f"Site Observation #{obs.id}: '{obs.title}'. Priority: {obs.priority}. "
            f"Category: {obs.observation_type.replace('_', ' ').lower()}. Current status: {obs.status}. "
            f"Observed at {site_name} in {area_display}. Details: {obs.description}."
        )

        meta_str = "\n".join(meta_lines)
        full_document = (
            f"{hierarchy_header}\n"
            f"{meta_str}\n\n"
            f"CONTENT:\n{content_body}"
        )

        metadata = {
            "project_id": obs.project_id,
            "site_id": obs.site_id,
            "area_id": obs.area_id,
            "priority": obs.priority,
            "type": obs.observation_type,
            "status": obs.status,
            "date": str(obs.observed_at) if obs.observed_at else None,
            "source_type": "OBSERVATION",
            "source_id": obs.id,
            "title": obs.title,
            "hierarchy_path": hierarchy_path,
            "area_name": area_name or ""
        }
        return title, full_document, metadata

    @classmethod
    def build_daily_report(cls, rep: models.DailyReport) -> Tuple[str, str, Dict[str, Any]]:
        title = f"Daily Report ({rep.report_date})"
        project_name = rep.project.name if rep.project else (rep.site.project.name if rep.site and rep.site.project else None)
        site_name = rep.site.name if rep.site else f"Site #{rep.site_id}"
        area_name = rep.area.name if rep.area else None

        hierarchy_header, hierarchy_path = cls._build_hierarchy_header(
            project_name=project_name,
            site_name=site_name,
            area_name=area_name
        )

        blockers_str = f"Site Blockers: {rep.blockers}" if rep.blockers else "No active blockers reported."
        notes_str = f"Supervisor Notes: {rep.notes}" if rep.notes else "No additional notes."
        area_display = area_name or "Overall Site"

        meta_lines = [
            "SOURCE TYPE: Daily Report",
            f"TITLE: Daily Site Report #{rep.id}",
            f"DATE: {rep.report_date}",
            f"PROGRESS: {rep.progress_percentage or 0}%",
            f"WORKFORCE: {rep.workers_count or 0} workers",
        ]
        if rep.weather:
            meta_lines.append(f"WEATHER: {rep.weather}")

        content_body = (
            f"Daily Site Report #{rep.id} dated {rep.report_date} for {site_name} in {area_display}. "
            f"Work completed today: {rep.work_completed or 'Scheduled daily progress'}. "
            f"Work planned next: {rep.work_planned or 'Standard tasks'}. "
            f"Workforce count: {rep.workers_count or 0} workers. Progress: {rep.progress_percentage or 0}%. "
            f"Weather: {rep.weather or 'Normal'}. {blockers_str} {notes_str}"
        )

        meta_str = "\n".join(meta_lines)
        full_document = (
            f"{hierarchy_header}\n"
            f"{meta_str}\n\n"
            f"CONTENT:\n{content_body}"
        )

        metadata = {
            "project_id": rep.project_id,
            "site_id": rep.site_id,
            "area_id": rep.area_id,
            "date": str(rep.report_date),
            "workers_count": rep.workers_count or 0,
            "progress_percentage": rep.progress_percentage or 0,
            "source_type": "DAILY_REPORT",
            "source_id": rep.id,
            "title": f"Daily Site Report ({rep.report_date})",
            "hierarchy_path": hierarchy_path,
            "area_name": area_name or ""
        }
        return title, full_document, metadata

    @classmethod
    def build_material(cls, mat: models.Material) -> Tuple[str, str, Dict[str, Any]]:
        title = f"Material #{mat.id}: {mat.material_name} ({mat.status})"
        project_name = mat.project.name if mat.project else (mat.site.project.name if mat.site and mat.site.project else None)
        site_name = mat.site.name if mat.site else f"Site #{mat.site_id}"
        area_name = mat.area.name if mat.area else None

        hierarchy_header, hierarchy_path = cls._build_hierarchy_header(
            project_name=project_name,
            site_name=site_name,
            area_name=area_name
        )

        notes_str = f"Notes: {mat.notes}" if mat.notes else ""
        supplier_str = f"Supplier: {mat.supplier}" if mat.supplier else ""
        area_display = area_name or "General Storage Yard"

        meta_lines = [
            "SOURCE TYPE: Material",
            f"TITLE: {mat.material_name}",
            f"STATUS: {mat.status}",
            f"CATEGORY: {mat.category or 'General'}",
            f"QUANTITY: {mat.quantity} {mat.unit}",
        ]
        if mat.supplier:
            meta_lines.append(f"SUPPLIER: {mat.supplier}")
        if mat.delivery_date:
            meta_lines.append(f"DATE: {mat.delivery_date}")

        content_body = (
            f"Material Tracking #{mat.id}: {mat.material_name}. Category: {mat.category or 'General'}. "
            f"Inventory: {mat.quantity} {mat.unit}. Status: {mat.status}. "
            f"Stored at {site_name} in {area_display}. {supplier_str} {notes_str}"
        )

        meta_str = "\n".join(meta_lines)
        full_document = (
            f"{hierarchy_header}\n"
            f"{meta_str}\n\n"
            f"CONTENT:\n{content_body}"
        )

        metadata = {
            "project_id": mat.project_id,
            "site_id": mat.site_id,
            "area_id": mat.area_id,
            "status": mat.status,
            "category": mat.category,
            "date": str(mat.delivery_date) if mat.delivery_date else None,
            "supplier": mat.supplier,
            "source_type": "MATERIAL",
            "source_id": mat.id,
            "title": mat.material_name,
            "hierarchy_path": hierarchy_path,
            "area_name": area_name or ""
        }
        return title, full_document, metadata

    @classmethod
    def build_ai_safety_finding(cls, finding: models.AISafetyFinding) -> Tuple[str, str, Dict[str, Any]]:
        title = f"AI Vision Finding #{finding.id}: {finding.title}"
        project_name = finding.project.name if finding.project else (finding.site.project.name if finding.site and finding.site.project else None)
        site_name = finding.site.name if finding.site else f"Site #{finding.site_id}"
        area_name = finding.area.name if finding.area else None

        hierarchy_header, hierarchy_path = cls._build_hierarchy_header(
            project_name=project_name,
            site_name=site_name,
            area_name=area_name
        )

        is_violation = "WITHOUT" in finding.finding_type or finding.severity in ["HIGH", "CRITICAL"]
        category = "PPE Violation" if is_violation else "PPE Compliance Confirmation"
        area_display = area_name or "Visual Scan Zone"
        date_str = finding.created_at.strftime("%Y-%m-%d") if finding.created_at else None

        meta_lines = [
            "SOURCE TYPE: AI Safety Finding",
            f"TITLE: {finding.title}",
            f"CLASSIFICATION: {category}",
            f"DETECTION TYPE: {finding.finding_type}",
            f"SEVERITY: {finding.severity}",
            f"STATUS: {finding.status}",
            f"CONFIDENCE: {round(finding.confidence * 100)}%",
        ]
        if date_str:
            meta_lines.append(f"DATE: {date_str}")

        content_body = (
            f"AI Vision Finding #{finding.id}: {finding.title}. Classification: {category}. "
            f"Detection Type: {finding.finding_type}. Severity: {finding.severity}. "
            f"Confidence: {round(finding.confidence * 100)}%. Status: {finding.status}. "
            f"Captured at {site_name} in {area_display}. Observation: {finding.description or 'Visual detection.'}."
        )

        meta_str = "\n".join(meta_lines)
        full_document = (
            f"{hierarchy_header}\n"
            f"{meta_str}\n\n"
            f"CONTENT:\n{content_body}"
        )

        metadata = {
            "project_id": finding.project_id,
            "site_id": finding.site_id,
            "area_id": finding.area_id,
            "finding_type": finding.finding_type,
            "severity": finding.severity,
            "status": finding.status,
            "is_violation": is_violation,
            "date": date_str,
            "source_type": "AI_FINDING",
            "source_id": finding.id,
            "title": finding.title,
            "hierarchy_path": hierarchy_path,
            "area_name": area_name or ""
        }
        return title, full_document, metadata

    @classmethod
    def build_photo(cls, photo: models.SitePhoto) -> Tuple[str, str, Dict[str, Any]]:
        title = f"Site Photo #{photo.id}: {photo.caption or 'Site Photograph'}"
        project_name = photo.project.name if photo.project else (photo.site.project.name if photo.site and photo.site.project else None)
        site_name = photo.site.name if photo.site else f"Site #{photo.site_id}"
        area_name = photo.area.name if photo.area else None

        hierarchy_header, hierarchy_path = cls._build_hierarchy_header(
            project_name=project_name,
            site_name=site_name,
            area_name=area_name
        )

        date_str = photo.created_at.strftime("%Y-%m-%d") if photo.created_at else "recent"
        area_display = area_name or "Overall Site"

        ppe_str = ""
        latest_run = None
        if hasattr(photo, "analysis_runs") and photo.analysis_runs:
            completed_runs = [r for r in photo.analysis_runs if r.status == "COMPLETED"]
            if completed_runs:
                completed_runs.sort(key=lambda x: x.id, reverse=True)
                latest_run = completed_runs[0]

        if latest_run:
            from services.ppe_analyzer import build_person_ppe_report
            people = []
            summary = {}
            if getattr(latest_run, "people_json", None) and getattr(latest_run, "summary_json", None):
                try:
                    people = json.loads(latest_run.people_json)
                    summary = json.loads(latest_run.summary_json)
                except Exception:
                    pass
            if not people or not summary:
                dets_dicts = [
                    {"class_name": d.class_name, "confidence": d.confidence, "x1": d.x1, "y1": d.y1, "x2": d.x2, "y2": d.y2}
                    for d in latest_run.detections
                ]
                people, summary = build_person_ppe_report(dets_dicts)

            workers_cnt = summary.get("workers_detected", 0)
            comp_cnt = summary.get("fully_compliant", 0)
            viol_cnt = summary.get("workers_with_violations", 0)
            pct = summary.get("overall_compliance", 100.0)

            viols_list = []
            for p in people:
                if not p.get("compliant"):
                    viols_list.append(f"Person {p.get('person_id')}: {', '.join(p.get('violations', []))}")

            viols_desc = f" Violations: {'; '.join(viols_list)}." if viols_list else " All workers fully compliant."
            ppe_str = f" Latest PPE Analysis: {workers_cnt} workers detected ({comp_cnt} fully compliant, {viol_cnt} with safety violations, {pct}% overall compliance).{viols_desc}"

        meta_lines = [
            "SOURCE TYPE: Site Photo",
            f"TITLE: {photo.caption or 'Site Photograph'}",
            f"DATE: {date_str}",
        ]

        content_body = (
            f"Site Photo #{photo.id} recorded on {date_str} at {site_name} in {area_display}. "
            f"Caption: {photo.caption or 'Construction site photographic record'}.{ppe_str}"
        )

        meta_str = "\n".join(meta_lines)
        full_document = (
            f"{hierarchy_header}\n"
            f"{meta_str}\n\n"
            f"CONTENT:\n{content_body}"
        )

        metadata = {
            "project_id": photo.project_id,
            "site_id": photo.site_id,
            "area_id": photo.area_id,
            "date": date_str,
            "source_type": "PHOTO",
            "source_id": photo.id,
            "title": photo.caption or "Site Photograph",
            "hierarchy_path": hierarchy_path,
            "area_name": area_name or ""
        }
        return title, full_document, metadata
