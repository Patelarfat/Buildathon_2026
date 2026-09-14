"""
Authoritative Structured Data Retriever (Phase 8.2E).
Executes direct, strictly project-isolated PostgreSQL queries to retrieve authoritative
facts for exact construction management queries (Safety Incidents, Materials, Inspections,
Observations, Daily Reports).

Eliminates vector-score false negatives on structured domain entities and supplies
authoritative facts to both the grounded LLM prompt and EvidenceGrouper.
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

import models
import schemas
from services.query_understanding import QueryRequirements
from .retriever import SearchResult

logger = logging.getLogger(__name__)


class StructuredDataRetriever:
    """
    First-class PostgreSQL Structured Fact Retrieval Engine.
    """

    @classmethod
    def retrieve_authoritative_facts(
        cls,
        db: Session,
        project_id: int,
        requirements: QueryRequirements
    ) -> Dict[str, Any]:
        """
        Retrieves authoritative structured records from PostgreSQL based on derived QueryRequirements.
        All queries are strictly isolated by project_id.
        """
        results: Dict[str, Any] = {
            "incidents": [],
            "materials": [],
            "inspections": [],
            "observations": [],
            "daily_reports": [],
            "sources": [],
            "data_used": []
        }

        source_types = requirements.requested_source_types
        statuses = requirements.requested_statuses

        # 1. Safety Incidents
        if "INCIDENT" in source_types or requirements.is_risk_query or (not source_types and requirements.needs_exact_structured_data):
            q_inc = db.query(models.SafetyIncident).filter(models.SafetyIncident.project_id == project_id)
            valid_inc_statuses = [s for s in statuses if s in ["OPEN", "UNDER_REVIEW", "INVESTIGATING", "RESOLVED"]]
            if valid_inc_statuses:
                q_inc = q_inc.filter(models.SafetyIncident.status.in_(valid_inc_statuses))
            elif "INCIDENT" in source_types:
                # Default for incident queries is non-resolved unless specified
                q_inc = q_inc.filter(models.SafetyIncident.status != "RESOLVED")
            
            if requirements.requested_area_ids:
                q_inc = q_inc.filter(models.SafetyIncident.area_id.in_(requirements.requested_area_ids))

            incidents = q_inc.order_by(models.SafetyIncident.id.asc()).all()
            results["incidents"] = incidents
            if incidents:
                results["data_used"].append("safety_incidents")
                for inc in incidents:
                    results["sources"].append(
                        schemas.AssistantSource(
                            type="SAFETY_INCIDENT",
                            id=f"INCIDENT_{inc.id}",
                            title=f"Incident #{inc.id} [{inc.severity}]",
                            detail=f"{inc.incident_type}: {inc.description[:60]}"
                        )
                    )

        # 2. Materials
        if "MATERIAL" in source_types or (not source_types and requirements.is_blocker_query):
            q_mat = db.query(models.Material).filter(models.Material.project_id == project_id)
            valid_mat_statuses = [s for s in statuses if s in ["DELAYED", "OUT_OF_STOCK", "LOW_STOCK", "AVAILABLE", "ORDERED", "DELIVERED"]]
            if valid_mat_statuses:
                q_mat = q_mat.filter(models.Material.status.in_(valid_mat_statuses))
            elif "MATERIAL" in source_types:
                q_mat = q_mat.filter(models.Material.status.in_(["DELAYED", "OUT_OF_STOCK", "LOW_STOCK"]))
            
            materials = q_mat.order_by(models.Material.id.asc()).all()
            results["materials"] = materials
            if materials:
                results["data_used"].append("materials")
                for m in materials:
                    results["sources"].append(
                        schemas.AssistantSource(
                            type="MATERIAL",
                            id=f"MATERIAL_{m.id}",
                            title=f"Material: {m.material_name} ({m.status})",
                            detail=f"{m.quantity} {m.unit} · Supplier: {m.supplier or 'N/A'}"
                        )
                    )

        # 3. Inspections
        if "INSPECTION" in source_types:
            q_insp = db.query(models.InspectionReport).filter(models.InspectionReport.project_id == project_id)
            valid_insp_statuses = [s for s in statuses if s in ["FAILED", "REQUIRES_REINSPECTION", "OPEN", "PASSED", "RESOLVED"]]
            if valid_insp_statuses:
                q_insp = q_insp.filter(models.InspectionReport.status.in_(valid_insp_statuses))
            
            if requirements.requested_area_ids:
                q_insp = q_insp.filter(models.InspectionReport.area_id.in_(requirements.requested_area_ids))

            inspections = q_insp.order_by(models.InspectionReport.id.asc()).all()
            results["inspections"] = inspections
            if inspections:
                results["data_used"].append("inspections")
                for insp in inspections:
                    results["sources"].append(
                        schemas.AssistantSource(
                            type="INSPECTION",
                            id=f"INSPECTION_{insp.id}",
                            title=f"Inspection #{insp.id}: {insp.inspection_type} ({insp.status})",
                            detail=f"Date: {insp.inspection_date} · {insp.findings or 'No critical notes'}"
                        )
                    )

        # 4. Observations
        if "OBSERVATION" in source_types:
            q_obs = db.query(models.Observation).filter(models.Observation.project_id == project_id)
            valid_obs_statuses = [s for s in statuses if s in ["OPEN", "UNDER_REVIEW", "RESOLVED"]]
            if valid_obs_statuses:
                q_obs = q_obs.filter(models.Observation.status.in_(valid_obs_statuses))
            elif "OBSERVATION" in source_types:
                q_obs = q_obs.filter(models.Observation.status != "RESOLVED")

            if requirements.requested_area_ids:
                q_obs = q_obs.filter(models.Observation.area_id.in_(requirements.requested_area_ids))

            observations = q_obs.order_by(models.Observation.id.asc()).all()
            results["observations"] = observations
            if observations:
                results["data_used"].append("observations")
                for obs in observations:
                    results["sources"].append(
                        schemas.AssistantSource(
                            type="OBSERVATION",
                            id=f"OBSERVATION_{obs.id}",
                            title=f"Observation #{obs.id}: {obs.title} ({obs.status})",
                            detail=f"Priority: {obs.priority} · {obs.description[:60]}"
                        )
                    )

        # 5. Daily Reports
        if "DAILY_REPORT" in source_types or (not source_types and (requirements.is_blocker_query or requirements.needs_exact_structured_data)):
            q_rep = db.query(models.DailyReport).filter(models.DailyReport.project_id == project_id)
            if requirements.target_date:
                q_rep = q_rep.filter(models.DailyReport.report_date == requirements.target_date)
            
            reports = q_rep.order_by(models.DailyReport.report_date.desc()).limit(5).all()
            results["daily_reports"] = reports
            if reports:
                results["data_used"].append("daily_reports")
                for r in reports[:2]:
                    results["sources"].append(
                        schemas.AssistantSource(
                            type="DAILY_REPORT",
                            id=f"DAILY_REPORT_{r.id}",
                            title=f"Daily Report ({r.report_date})",
                            detail=f"Progress: {r.progress_percentage or 0}% · Workforce: {r.workers_count or 0}"
                        )
                    )

        return results

    @classmethod
    def format_authoritative_facts_block(cls, facts: Dict[str, Any]) -> str:
        """
        Formats retrieved PostgreSQL records into a clear, unambiguous, authoritative facts section for the LLM.
        """
        sections: List[str] = []

        # 1. Incidents
        incidents = facts.get("incidents", [])
        if incidents:
            lines = [
                f"- Incident #{inc.id} [{inc.severity}]: {inc.incident_type} at {inc.site.name if inc.site else 'Site'} ({inc.area.name if inc.area else 'General Area'}) | Status: {inc.status} | Date: {inc.incident_date} | Narrative: {inc.description}"
                for inc in incidents
            ]
            joined_inc = "\n".join(lines)
            sections.append(f"AUTHORITATIVE SAFETY INCIDENTS ({len(incidents)} RECORDED - Unresolved Safety Incidents: {len(incidents)}):\n{joined_inc}")

        # 2. Materials
        materials = facts.get("materials", [])
        if materials:
            lines = [
                f"- Material #{m.id}: {m.material_name} | Status: {m.status} | Quantity: {m.quantity} {m.unit} | Supplier: {m.supplier or 'N/A'} | Notes: {m.notes or 'None'}"
                for m in materials
            ]
            joined_mat = "\n".join(lines)
            sections.append(f"AUTHORITATIVE MATERIAL & INVENTORY RECORDS ({len(materials)} RECORDED):\n{joined_mat}")

        # 3. Inspections
        inspections = facts.get("inspections", [])
        if inspections:
            lines = [
                f"- Inspection #{insp.id}: {insp.inspection_type} | Status: {insp.status} | Date: {insp.inspection_date} | Findings: {insp.findings or 'None'} | Recommendations: {insp.recommendations or 'None'}"
                for insp in inspections
            ]
            joined_insp = "\n".join(lines)
            sections.append(f"AUTHORITATIVE INSPECTION REPORTS ({len(inspections)} RECORDED):\n{joined_insp}")

        # 4. Observations
        observations = facts.get("observations", [])
        if observations:
            lines = [
                f"- Observation #{obs.id}: {obs.title} | Status: {obs.status} | Priority: {obs.priority} | Description: {obs.description}"
                for obs in observations
            ]
            joined_obs = "\n".join(lines)
            sections.append(f"AUTHORITATIVE SUPERVISOR OBSERVATIONS ({len(observations)} RECORDED):\n{joined_obs}")

        # 5. Daily Reports
        daily_reports = facts.get("daily_reports", [])
        if daily_reports:
            latest = daily_reports[0]
            rep_text = (
                f"AUTHORITATIVE DAILY PROGRESS REPORT ({latest.report_date}):\n"
                f"- Progress Completed: {latest.progress_percentage or 0}%\n"
                f"- Workforce on Site: {latest.workers_count or 0} workers\n"
                f"- Work Completed: {latest.work_completed or 'Scheduled site progress'}\n"
                f"- Work Planned Next: {latest.work_planned or 'Standard tasks'}\n"
                f"- Field Blockers: {latest.blockers or 'None'}\n"
                f"- Weather: {latest.weather or 'Clear'}"
            )
            sections.append(rep_text)

        if not sections:
            return ""

        joined_all = "\n\n".join(sections)
        return f"AUTHORITATIVE EXACT FACTS (SQL SINGLE-SOURCE-OF-TRUTH):\n{joined_all}"

    @classmethod
    def convert_to_search_results(cls, facts: Dict[str, Any], project_id: int) -> List[SearchResult]:
        """
        Converts authoritative structured PostgreSQL entities into SearchResult objects
        with is_authoritative=True and high relevance score (1.0) so they can be merged
        into the RAG retrieval pipeline without risk of vector-score drops.
        """
        results: List[SearchResult] = []

        # Incidents
        for inc in facts.get("incidents", []):
            site_name = inc.site.name if inc.site else ""
            area_name = inc.area.name if inc.area else ""
            h_path = f"{site_name} → {area_name}" if area_name else site_name
            meta = {
                "project_id": inc.project_id,
                "site_id": inc.site_id,
                "area_id": inc.area_id,
                "severity": inc.severity,
                "incident_type": inc.incident_type,
                "status": inc.status,
                "date": str(inc.incident_date),
                "hierarchy_path": h_path,
                "is_authoritative": True
            }
            results.append(
                SearchResult(
                    doc_id=100000 + inc.id,
                    project_id=project_id,
                    site_id=inc.site_id,
                    area_id=inc.area_id,
                    doc_type="INCIDENT",
                    source_id=inc.id,
                    title=f"Safety Incident #{inc.id}: {inc.incident_type} ({inc.severity})",
                    content=f"Safety Incident #{inc.id}. Severity: {inc.severity}. Status: {inc.status}. Date: {inc.incident_date}. Location: {h_path}. Narrative: {inc.description}. Action taken: {inc.action_taken or 'None'}",
                    metadata=meta,
                    relevance_score=1.0,
                    semantic_score=1.0,
                    lexical_score=1.0,
                    phrase_score=1.0,
                    entity_score=1.0,
                    hierarchy_score=1.0,
                    metadata_score=1.0,
                    time_score=1.0,
                    hierarchy_path=h_path
                )
            )

        # Materials
        for m in facts.get("materials", []):
            meta = {
                "project_id": m.project_id,
                "site_id": m.site_id,
                "area_id": m.area_id,
                "status": m.status,
                "quantity": m.quantity,
                "unit": m.unit,
                "supplier": m.supplier,
                "category": m.category,
                "is_authoritative": True
            }
            results.append(
                SearchResult(
                    doc_id=200000 + m.id,
                    project_id=project_id,
                    site_id=m.site_id,
                    area_id=m.area_id,
                    doc_type="MATERIAL",
                    source_id=m.id,
                    title=f"Material #{m.id}: {m.material_name} ({m.status})",
                    content=f"Material #{m.id}: {m.material_name}. Status: {m.status}. Quantity: {m.quantity} {m.unit}. Supplier: {m.supplier or 'N/A'}. Notes: {m.notes or 'None'}",
                    metadata=meta,
                    relevance_score=1.0,
                    semantic_score=1.0,
                    lexical_score=1.0,
                    phrase_score=1.0,
                    entity_score=1.0,
                    hierarchy_score=1.0,
                    metadata_score=1.0,
                    time_score=1.0,
                    hierarchy_path=""
                )
            )

        # Inspections
        for insp in facts.get("inspections", []):
            meta = {
                "project_id": insp.project_id,
                "site_id": insp.site_id,
                "area_id": insp.area_id,
                "status": insp.status,
                "inspection_type": insp.inspection_type,
                "date": str(insp.inspection_date),
                "is_authoritative": True
            }
            results.append(
                SearchResult(
                    doc_id=300000 + insp.id,
                    project_id=project_id,
                    site_id=insp.site_id,
                    area_id=insp.area_id,
                    doc_type="INSPECTION",
                    source_id=insp.id,
                    title=f"Inspection Report #{insp.id}: {insp.inspection_type} ({insp.status})",
                    content=f"Inspection Report #{insp.id}. Type: {insp.inspection_type}. Status: {insp.status}. Date: {insp.inspection_date}. Findings: {insp.findings or 'None'}. Recommendations: {insp.recommendations or 'None'}",
                    metadata=meta,
                    relevance_score=1.0,
                    semantic_score=1.0,
                    lexical_score=1.0,
                    phrase_score=1.0,
                    entity_score=1.0,
                    hierarchy_score=1.0,
                    metadata_score=1.0,
                    time_score=1.0,
                    hierarchy_path=""
                )
            )

        # Observations
        for obs in facts.get("observations", []):
            meta = {
                "project_id": obs.project_id,
                "site_id": obs.site_id,
                "area_id": obs.area_id,
                "status": obs.status,
                "priority": obs.priority,
                "observation_type": obs.observation_type,
                "is_authoritative": True
            }
            results.append(
                SearchResult(
                    doc_id=400000 + obs.id,
                    project_id=project_id,
                    site_id=obs.site_id,
                    area_id=obs.area_id,
                    doc_type="OBSERVATION",
                    source_id=obs.id,
                    title=f"Observation #{obs.id}: {obs.title} ({obs.status})",
                    content=f"Observation #{obs.id}: {obs.title}. Status: {obs.status}. Priority: {obs.priority}. Type: {obs.observation_type}. Description: {obs.description}",
                    metadata=meta,
                    relevance_score=1.0,
                    semantic_score=1.0,
                    lexical_score=1.0,
                    phrase_score=1.0,
                    entity_score=1.0,
                    hierarchy_score=1.0,
                    metadata_score=1.0,
                    time_score=1.0,
                    hierarchy_path=""
                )
            )

        return results
