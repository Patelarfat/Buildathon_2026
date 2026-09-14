"""
Semantic Query Expansion & Rewriting Service (Phase 8.E.1).

Transforms natural manager language into multi-faceted construction retrieval plans:
- Preserves the user's original query.
- Identifies underlying construction management concepts (blockers, material shortages, safety hazards, risk ratings, progress impediments).
- Generates targeted expanded retrieval queries.
- Preserves and reinforces spatial hierarchy boundaries (Site, Area/Zone).
- Produces deterministic concept expansions with an optional structured LLM enhancer and guaranteed local fallback.
"""

import re
import json
import logging
from typing import List, Dict, Any, Optional, Set, Tuple
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

import models
from services.query_understanding import analyze_query, QueryUnderstanding, QueryRequirements

logger = logging.getLogger(__name__)


class ExpandedQueryPlan(BaseModel):
    """
    Structured retrieval representation generated from query analysis and expansion.
    """
    original_query: str
    expanded_queries: List[str] = Field(default_factory=list)
    semantic_concepts: List[str] = Field(default_factory=list)
    likely_source_types: Optional[List[str]] = None
    
    # Entity & Spatial anchors
    entities: List[str] = Field(default_factory=list)
    phrases: List[str] = Field(default_factory=list)
    matched_site_id: Optional[int] = None
    matched_site_name: Optional[str] = None
    matched_area_ids: List[int] = Field(default_factory=list)
    matched_area_names: List[str] = Field(default_factory=list)
    matched_material_names: List[str] = Field(default_factory=list)
    target_date: Optional[str] = None
    
    # Intent & Routing Hints
    primary_topic: str = "GENERAL_PROJECT"
    is_blocker_query: bool = False
    is_material_query: bool = False
    is_safety_hazard_query: bool = False
    is_unresolved_query: bool = False
    is_failed_inspection_query: bool = False
    is_ppe_query: bool = False
    is_progress_query: bool = False
    is_risk_query: bool = False
    is_area_query: bool = False
    
    # Execution Flags
    needs_risk_engine: bool = False
    needs_exact_sql: bool = False
    needs_semantic_rag: bool = True
    requirements: Optional[QueryRequirements] = None


class QueryExpansionService:
    """
    General semantic query expansion engine for construction intelligence.
    """

    BLOCKER_PATTERNS = [
        r'\b(preventing|holding|held\s*up|hold\s*up|getting\s*in|blocking|blocker|blockers|bottleneck|bottlenecks|impediment|impediments|stoppage|stoppages|struggling|obstruction|obstructions|delay|delayed|delays|slowdown|constraints|interruption|stopped|stopping|stop|stalled|stall|halted|halt|frozen|freeze|stuck|paused|pause|disrupted|disruption|impeded|impede)\b',
        r'\b(cannot\s*continue|moving\s*forward|behind\s*schedule|falling\s*behind|ongoing\s*trades)\b'
    ]

    RESOURCE_PATTERNS = [
        r'\b(resource|resources|supplies|supply|inventory|stock|stockout|shortage|shortages|procurement|materials|goods|items)\b'
    ]

    OPERATIONAL_CONCERN_PATTERNS = [
        r'\b(operational\s*concern|biggest\s*concern|immediate\s*attention|urgent|serious|struggling\s*most|critical\s*issue|jobsite\s*trouble|manager\s*focus|site\s*conditions)\b'
    ]

    RISK_PATTERNS = [
        r'\b(risk\s*rating|risk\s*score|risk\s*flagged|current\s*rating|risk\s*level|safety\s*assessment|site\s*risk|project\s*risk|risk\s*factors|overall\s*risk|site\s*conditions|how\s*serious|site\s*severity|why\s*is\s*.*risk|what\s*is\s*.*risk|current\s*.*risk)\b'
    ]

    SAFETY_HAZARD_PATTERNS = [
        r'\b(hazard|hazards|incident|incidents|accident|accidents|unsafe|injury|near\s*miss|equipment\s*accident|spill|leak|load\s*shift)\b'
    ]

    UNRESOLVED_PATTERNS = [
        r'\b(unresolved|open|pending|still\s*open|not\s*closed|in\s*progress|active\s*issue)\b'
    ]

    INSPECTION_PATTERNS = [
        r'\b(inspection|inspections|audit|audits|failed|rejected|re-inspection|quality\s*check|safety\s*audit)\b'
    ]

    PPE_PATTERNS = [
        r'\b(ppe|helmet|hard\s*hat|vest|high-vis|gloves|boots|goggles|safety\s*gear|protective\s*gear|compliance|violation)\b'
    ]

    PROGRESS_PATTERNS = [
        r'\b(progress|velocity|milestone|work\s*packages|completed|daily\s*report|weekly\s*report|output|accomplished|tracking)\b'
    ]

    @classmethod
    def expand_query(cls, db: Session, project_id: int, query: str) -> ExpandedQueryPlan:
        """
        Builds a comprehensive, multi-query retrieval plan from natural language.
        """
        q = query.strip()
        q_lower = q.lower()
        
        # 1. Base Query Understanding (Deterministic extraction)
        qu: QueryUnderstanding = analyze_query(db=db, project_id=project_id, query=q)

        # 2. Identify Domain Concepts via Regex & Term Analysis
        is_blocker = any(bool(re.search(p, q_lower)) for p in cls.BLOCKER_PATTERNS) or qu.is_problem_query
        is_resource = any(bool(re.search(p, q_lower)) for p in cls.RESOURCE_PATTERNS) or qu.is_material_query
        is_concern = any(bool(re.search(p, q_lower)) for p in cls.OPERATIONAL_CONCERN_PATTERNS)
        is_risk = any(bool(re.search(p, q_lower)) for p in cls.RISK_PATTERNS) or qu.needs_risk_engine or qu.primary_topic == "SAFETY_RISK"
        is_hazard = any(bool(re.search(p, q_lower)) for p in cls.SAFETY_HAZARD_PATTERNS)
        is_unresolved = any(bool(re.search(p, q_lower)) for p in cls.UNRESOLVED_PATTERNS) or qu.is_unresolved_query
        is_inspection = any(bool(re.search(p, q_lower)) for p in cls.INSPECTION_PATTERNS) or qu.is_failed_query
        is_ppe = any(bool(re.search(p, q_lower)) for p in cls.PPE_PATTERNS) or qu.is_ppe_query
        is_progress = any(bool(re.search(p, q_lower)) for p in cls.PROGRESS_PATTERNS) or qu.is_progress_query
        is_area = bool(qu.matched_area_ids) or bool(qu.matched_area_names)

        # 3. Assemble Semantic Concepts & Likely Source Types
        concepts: Set[str] = set()
        source_types: Set[str] = set()
        expanded_queries: List[str] = [q]  # Original query is ALWAYS preserved at index 0

        # Extract area keywords for localized context
        area_context = " ".join(qu.matched_area_names) if qu.matched_area_names else ""

        # Concept A: Blocker / Work Stoppage / Delay
        if is_blocker or (is_resource and is_concern):
            concepts.update(["site_blockers", "delays", "delayed_materials", "work_obstruction", "progress_impact"])
            source_types.update(["DAILY_REPORT", "MATERIAL", "OBSERVATION", "INCIDENT"])
            if area_context:
                expanded_queries.append(f"{area_context} site blockers and delayed materials")
                expanded_queries.append(f"{area_context} work delays and progress obstructions")
            else:
                expanded_queries.append("site blockers delays pending materials")
                expanded_queries.append("work stoppage delayed activity facade installation affected")

        # Concept B: Materials / Inventory / Supplies / Procurement
        if is_resource or qu.matched_material_names:
            concepts.update(["materials", "inventory_shortage", "delayed_supplies", "procurement_status", "low_stock"])
            source_types.update(["MATERIAL", "DAILY_REPORT"])
            if qu.matched_material_names:
                for mat in qu.matched_material_names:
                    expanded_queries.append(f"material inventory {mat} status delivery delayed")
            elif area_context:
                expanded_queries.append(f"{area_context} material inventory stock delayed supplies")
            else:
                expanded_queries.append("materials delayed out of stock low stock supplies inventory")
                expanded_queries.append("procurement shipment pending material shortages")

        # Concept C: Operational Concerns & Focus Areas
        if is_concern:
            concepts.update(["operational_concerns", "critical_blockers", "open_incidents", "failed_inspections"])
            source_types.update(["DAILY_REPORT", "INCIDENT", "INSPECTION", "OBSERVATION", "MATERIAL"])
            if area_context:
                expanded_queries.append(f"{area_context} major operational issues safety hazards blockers")
            else:
                expanded_queries.append("top operational concerns active site blockers open safety incidents")
                expanded_queries.append("delayed materials failed safety inspections supervisor observations")

        # Concept D: Spatial Area Scoping
        if is_area and area_context:
            concepts.add(f"area_{area_context.lower().replace(' ', '_')}")
            expanded_queries.append(f"{area_context} activities incidents progress inspections observations")
            expanded_queries.append(f"{area_context} daily reports materials safety")

        # Concept E: Safety Incidents & Hazards
        if is_hazard or is_unresolved:
            concepts.update(["safety_incidents", "open_hazards", "equipment_accidents", "safety_observations"])
            source_types.update(["INCIDENT", "OBSERVATION", "INSPECTION"])
            if area_context:
                expanded_queries.append(f"{area_context} open safety incidents hazards observations")
            else:
                expanded_queries.append("open safety incidents equipment accidents hazards unresolved")
                expanded_queries.append("supervisor safety observations unsafe conditions")

        # Concept F: Inspections & Audits
        if is_inspection:
            concepts.update(["inspections", "quality_audits", "failed_inspections", "audit_deficiencies"])
            source_types.update(["INSPECTION", "OBSERVATION"])
            if area_context:
                expanded_queries.append(f"{area_context} safety inspections quality audits failed")
            else:
                expanded_queries.append("safety inspection report quality audit failed re-inspection")

        # Concept G: PPE Compliance & AI Vision
        if is_ppe:
            concepts.update(["ppe_compliance", "ai_findings", "helmet_vest_violations"])
            source_types.update(["AI_FINDING", "PHOTO"])
            if area_context:
                expanded_queries.append(f"{area_context} ppe detection camera findings helmet vest")
            else:
                expanded_queries.append("ppe detection ai findings helmet vest compliance violations")

        # Concept H: Progress & Milestone Velocity
        if is_progress:
            concepts.update(["daily_progress", "milestone_velocity", "work_packages_completed", "workforce_count"])
            source_types.update(["DAILY_REPORT", "PROJECT", "SITE"])
            if area_context:
                expanded_queries.append(f"{area_context} daily work progress completed packages")
            else:
                expanded_queries.append("daily report work completed planned progress percentage")

        # Concept I: Risk Engine & Ratings
        if is_risk:
            concepts.update(["safety_risk", "risk_rating", "risk_score", "contributing_factors"])
            source_types.update(["INCIDENT", "INSPECTION", "DAILY_REPORT", "OBSERVATION"])
            expanded_queries.append("site risk evaluation safety factors incidents failed audits")

        # 4. Deduplicate and Clean Expanded Queries
        clean_exp_queries = []
        seen_eq = set()
        for eq in expanded_queries:
            eq_normalized = re.sub(r'\s+', ' ', eq).strip()
            if eq_normalized and eq_normalized.lower() not in seen_eq:
                seen_eq.add(eq_normalized.lower())
                clean_exp_queries.append(eq_normalized)

        # 5. Determine Primary Topic & Need Flags
        primary_topic = qu.primary_topic
        needs_risk = is_risk or qu.needs_risk_engine
        needs_sql = qu.needs_exact_sql or is_progress or is_resource or is_blocker or is_hazard

        if is_risk:
            primary_topic = "SAFETY_RISK"
        elif is_resource and not (is_hazard or is_ppe):
            primary_topic = "MATERIALS"
        elif is_blocker and not is_risk:
            primary_topic = "ISSUES_SUMMARY"

        reqs = qu.requirements
        effective_source_types = (reqs.requested_source_types if reqs and reqs.requested_source_types else sorted(list(source_types))) if (reqs and reqs.requested_source_types) or source_types else None

        return ExpandedQueryPlan(
            original_query=q,
            expanded_queries=clean_exp_queries[:4],  # Bound to top 4 high-value expansions
            semantic_concepts=sorted(list(concepts)),
            likely_source_types=effective_source_types,
            entities=qu.entities,
            phrases=qu.phrases,
            matched_site_id=qu.matched_site_id,
            matched_site_name=qu.matched_site_name,
            matched_area_ids=qu.matched_area_ids,
            matched_area_names=qu.matched_area_names,
            matched_material_names=qu.matched_material_names,
            target_date=qu.target_date,
            primary_topic=primary_topic,
            is_blocker_query=is_blocker,
            is_material_query=is_resource,
            is_safety_hazard_query=is_hazard,
            is_unresolved_query=is_unresolved,
            is_failed_inspection_query=is_inspection,
            is_ppe_query=is_ppe,
            is_progress_query=is_progress,
            is_risk_query=is_risk,
            is_area_query=is_area,
            needs_risk_engine=needs_risk,
            needs_exact_sql=needs_sql,
            needs_semantic_rag=True,
            requirements=reqs
        )
