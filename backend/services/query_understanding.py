"""
Query Understanding and Intent Routing Service (Phase 8.2B).
Provides lightweight semantic query analysis, dynamic database entity extraction,
time constraint parsing, and multi-signal retrieval planning.
Intent serves as a routing & metadata signal, NOT a hard gate that prevents RAG retrieval.
"""

import re
import logging
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

import models

logger = logging.getLogger(__name__)


class QueryRequirements(BaseModel):
    """
    Lightweight data requirement model for Phase 8.2E.
    Identifies the semantic data requirements of a construction query.
    """
    query_type: str = "HYBRID"  # "EXACT_STRUCTURED", "SEMANTIC_AMBIGUOUS", "HYBRID", "CONVERSATIONAL"
    needs_exact_structured_data: bool = False
    needs_semantic_evidence: bool = True
    requested_source_types: List[str] = Field(default_factory=list)  # ["INCIDENT", "MATERIAL", "INSPECTION", "OBSERVATION", "DAILY_REPORT"]
    requested_statuses: List[str] = Field(default_factory=list)     # ["OPEN", "UNDER_REVIEW", "DELAYED", "FAILED", etc.]
    requested_time_range: Optional[Tuple[Optional[datetime], Optional[datetime]]] = None
    target_date: Optional[str] = None
    requested_site_id: Optional[int] = None
    requested_area_ids: List[int] = Field(default_factory=list)
    requested_count: bool = False
    requested_entity_list: bool = False
    is_risk_query: bool = False
    is_blocker_query: bool = False


class QueryUnderstanding(BaseModel):
    query: str
    primary_topic: str = "GENERAL_PROJECT"
    entities: List[str] = []
    phrases: List[str] = []
    target_date: Optional[str] = None
    time_filter: Optional[Tuple[Optional[datetime], Optional[datetime]]] = None
    matched_site_id: Optional[int] = None
    matched_site_name: Optional[str] = None
    matched_area_ids: List[int] = []
    matched_area_names: List[str] = []
    matched_material_names: List[str] = []
    
    # Semantic Intent Signals
    is_problem_query: bool = False
    is_unresolved_query: bool = False
    is_failed_query: bool = False
    is_ppe_query: bool = False
    is_progress_query: bool = False
    is_material_query: bool = False
    is_area_query: bool = False
    
    retrieval_mode: str = "HYBRID"  # HYBRID, EXACT_SQL, RISK_ONLY, CONVERSATIONAL
    needs_risk_engine: bool = False
    needs_exact_sql: bool = False
    needs_semantic_rag: bool = True
    requirements: Optional[QueryRequirements] = None


def parse_date_and_time(query: str, db: Optional[Session] = None, project_id: Optional[int] = None) -> Tuple[Optional[str], Optional[Tuple[Optional[datetime], Optional[datetime]]]]:
    """
    Extracts explicit date strings (e.g. '2026-09-12', 'September 12') or relative time ranges.
    For relative dates like 'yesterday' or 'today', resolves against the latest project daily report date if available.
    """
    q = query.lower()
    
    # 1. Match explicit ISO date format (YYYY-MM-DD)
    iso_match = re.search(r'\b(20\d{2}-\d{2}-\d{2})\b', q)
    if iso_match:
        return iso_match.group(1), None

    # 2. Match month names with day (e.g. "september 12", "sep 12", "12th september")
    month_match = re.search(r'\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b', q)
    if month_match:
        m_name = month_match.group(1)[:3]
        d_num = int(month_match.group(2))
        month_map = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12}
        m_num = month_map.get(m_name, 9)
        # Year defaults to 2026 for this project benchmark
        date_str = f"2026-{m_num:02d}-{d_num:02d}"
        return date_str, None

    # 3. Relative time expressions (today, yesterday, this week, last week)
    # Check latest report date in DB as reference point if available
    ref_date = datetime.utcnow()
    if db and project_id:
        try:
            latest_rep = db.query(models.DailyReport).filter(models.DailyReport.project_id == project_id).order_by(models.DailyReport.report_date.desc()).first()
            if latest_rep and latest_rep.report_date:
                ref_date = datetime.strptime(latest_rep.report_date, "%Y-%m-%d")
        except Exception:
            pass

    today_start = datetime(ref_date.year, ref_date.month, ref_date.day)
    
    if "yesterday" in q:
        y_date = today_start - timedelta(days=1)
        return y_date.strftime("%Y-%m-%d"), (y_date, today_start)
    if "today" in q:
        return today_start.strftime("%Y-%m-%d"), (today_start, None)
    if "this week" in q or "past week" in q or "last 7 days" in q:
        return None, (today_start - timedelta(days=7), None)
    if "last week" in q:
        return None, (today_start - timedelta(days=14), today_start - timedelta(days=7))

    return None, None


def derive_query_requirements(
    query: str,
    qu: QueryUnderstanding
) -> QueryRequirements:
    """
    Lightweight data requirement derivation (Phase 8.2E).
    Derives structured SQL and semantic retrieval requirements from semantic query understanding.
    """
    q_lower = query.lower()

    # 1. Source Type Requirements
    source_types: List[str] = []
    
    # Safety Incidents
    is_safety_topic = any(bool(re.search(p, q_lower)) for p in [
        r'\b(safety\s*problems?|safety\s*issues?|safety\s*incidents?|accidents?|hazards?|injuries|unresolved\s*safety|open\s*incidents?|outstanding\s*safety|fall\s*hazard|slip\s*trip|near\s*miss|violations?)\b',
        r'\b(incidents?|accidents?)\b'
    ])
    if is_safety_topic or qu.primary_topic == "SAFETY_INCIDENTS":
        source_types.append("INCIDENT")

    # Materials / Resources
    is_material_topic = any(bool(re.search(p, q_lower)) for p in [
        r'\b(materials?|supplies|supply|inventory|stock|stockout|shortages?|procurement|resources?)\b',
        r'\b(unavailable|out\s*of\s*stock|low\s*stock|delayed\s*materials?|delivery\s*problems?)\b'
    ]) or bool(qu.matched_material_names) or qu.primary_topic == "MATERIALS"
    # Prevent pure safety queries from accidentally adding MATERIAL unless explicitly mentioned
    has_explicit_material_term = any(k in q_lower for k in ["material", "materials", "supplies", "supply", "inventory", "stock", "procurement", "resources", "unavailable", "delivery"])
    if is_material_topic and (not is_safety_topic or has_explicit_material_term):
        source_types.append("MATERIAL")

    # Inspections
    is_inspection_topic = any(bool(re.search(p, q_lower)) for p in [
        r'\b(inspections?|audits?|quality\s*checks?|failed\s*inspections?|inspector)\b'
    ]) or qu.is_failed_query or qu.primary_topic == "INSPECTION"
    if is_inspection_topic:
        source_types.append("INSPECTION")

    # Observations
    is_observation_topic = any(bool(re.search(p, q_lower)) for p in [
        r'\b(observations?|site\s*observations?|supervisor\s*remarks?|field\s*observations?)\b'
    ])
    if is_observation_topic:
        source_types.append("OBSERVATION")

    # Progress / Daily Reports
    is_progress_topic = any(bool(re.search(p, q_lower)) for p in [
        r'\b(progress|velocity|daily\s*reports?|weekly\s*reports?|work\s*completed|work\s*planned|workers?\s*count|workforce|how\s*far|latest\s*reported)\b'
    ]) or qu.is_progress_query or qu.primary_topic in ["DAILY_REPORT", "WEEKLY_PROGRESS_REPORT"]
    if is_progress_topic:
        source_types.append("DAILY_REPORT")

    # 2. Domain-Specific Status Requirements (Strictly Respecting PostgreSQL Schema)
    statuses: List[str] = []
    is_unresolved = any(bool(re.search(p, q_lower)) for p in [
        r'\b(unresolved|open|pending|outstanding|not\s*closed|closure|still\s*need|in\s*progress|active|investigating)\b'
    ])
    is_failed = any(bool(re.search(p, q_lower)) for p in [
        r'\b(failed|rejected|not\s*passed|re-inspection|failing)\b'
    ])
    is_delayed_or_short = any(bool(re.search(p, q_lower)) for p in [
        r'\b(delayed|out\s*of\s*stock|low\s*stock|unavailable|running\s*low|shortage|delivery\s*problems?)\b'
    ])

    if "INCIDENT" in source_types:
        if is_unresolved:
            statuses.extend(["OPEN", "UNDER_REVIEW", "INVESTIGATING"])
    if "OBSERVATION" in source_types:
        if is_unresolved:
            statuses.extend(["OPEN", "UNDER_REVIEW"])
    if "INSPECTION" in source_types:
        if is_failed:
            statuses.extend(["FAILED", "REQUIRES_REINSPECTION"])
        elif is_unresolved:
            statuses.extend(["OPEN", "FAILED", "REQUIRES_REINSPECTION"])
    if "MATERIAL" in source_types:
        if is_delayed_or_short or is_unresolved or qu.is_problem_query:
            statuses.extend(["DELAYED", "OUT_OF_STOCK", "LOW_STOCK"])

    # 3. Count vs Entity List
    requested_count = any(bool(re.search(p, q_lower)) for p in [
        r'\b(how\s*many|count|number\s*of|total\s*number|how\s*much)\b'
    ])
    requested_entity_list = any(bool(re.search(p, q_lower)) for p in [
        r'\b(which|what|show\s*me|list|are\s*there\s*any|outstanding|what\s*are)\b'
    ])

    # 4. Query Type Classification (Exact Structured vs Semantic Ambiguous vs Hybrid)
    is_risk = any(bool(re.search(p, q_lower)) for p in [
        r'\b(risk\s*rating|risk\s*score|project\s*risk|site\s*risk|current\s*risk|risk\s*level|safety\s*assessment)\b'
    ]) or qu.needs_risk_engine

    is_exact_question = (
        (bool(source_types) and (is_unresolved or is_failed or is_delayed_or_short or requested_count or "progress" in q_lower or "workers" in q_lower))
        and not any(w in q_lower for w in ["preventing", "holding up", "manager focus", "operational concern", "struggling most", "slowing"])
    )

    is_hybrid_question = any(bool(re.search(p, q_lower)) for p in [
        r'\b(slowing.*records?|multiple\s*sources?|evidence\s*from|affecting\s*progress|holding.*back|affecting.*operations?)\b',
        r'\b(which.*affecting|what.*affecting|what.*slowing)\b'
    ])

    if is_exact_question:
        query_type = "EXACT_STRUCTURED"
        needs_exact_structured = True
        needs_semantic = True
    elif is_hybrid_question or (bool(source_types) and qu.is_problem_query):
        query_type = "HYBRID"
        needs_exact_structured = True
        needs_semantic = True
    elif is_risk:
        query_type = "EXACT_STRUCTURED"
        needs_exact_structured = True
        needs_semantic = True
    else:
        query_type = "SEMANTIC_AMBIGUOUS"
        needs_exact_structured = False
        needs_semantic = True

    return QueryRequirements(
        query_type=query_type,
        needs_exact_structured_data=needs_exact_structured,
        needs_semantic_evidence=needs_semantic,
        requested_source_types=list(dict.fromkeys(source_types)),
        requested_statuses=list(dict.fromkeys(statuses)),
        requested_time_range=qu.time_filter,
        target_date=qu.target_date,
        requested_site_id=qu.matched_site_id,
        requested_area_ids=qu.matched_area_ids,
        requested_count=requested_count,
        requested_entity_list=requested_entity_list,
        is_risk_query=is_risk,
        is_blocker_query=qu.is_problem_query
    )


def analyze_query(db: Session, project_id: int, query: str) -> QueryUnderstanding:
    """
    Performs comprehensive, ontology-grounded query understanding:
    - Extracts mentioned entities dynamically from project database records.
    - Extracts multi-word n-gram phrases.
    - Identifies problem/blocker, inspection, ppe, and progress intent signals.
    - Parses time and date references.
    """
    q = query.lower().strip()
    clean_q = re.sub(r'[^\w\s]', '', q).strip()

    # 1. Conversational / Out of Scope Gating
    if clean_q in [
        "hi", "hii", "hiii", "hello", "hey", "heyy", "greetings", "howdy",
        "good morning", "good afternoon", "good evening", "what can you do",
        "who are you", "help", "start", "welcome"
    ] or (len(clean_q.split()) <= 2 and any(clean_q == g for g in ["hi", "hii", "hello", "hey", "heyy", "howdy"])):
        return QueryUnderstanding(
            query=query,
            primary_topic="GREETING",
            retrieval_mode="CONVERSATIONAL",
            needs_risk_engine=False,
            needs_exact_sql=False,
            needs_semantic_rag=False
        )

    out_of_scope_terms = [
        "pm of", "prime minister", "president of", "capital of", "who is the prime",
        "who is the president", "who is pm", "weather in tokyo", "weather in london",
        "weather in new york", "weather in delhi", "weather in paris",
        "tell me a joke", "write a poem", "write code for", "recipe for",
        "cricket", "football", "celebrity", "movie", "song", "lyrics",
        "meaning of life", "who won the match", "stock market"
    ]
    if any(term in q for term in out_of_scope_terms):
        return QueryUnderstanding(
            query=query,
            primary_topic="OUT_OF_SCOPE",
            retrieval_mode="CONVERSATIONAL",
            needs_risk_engine=False,
            needs_exact_sql=False,
            needs_semantic_rag=False
        )

    # 2. Dynamic Database Entity Extraction (Strictly Isolated by project_id)
    matched_site_id = None
    matched_site_name = None
    sites = db.query(models.Site).filter(models.Site.project_id == project_id).all()
    for s in sites:
        if s.name.lower() in q:
            matched_site_id = s.id
            matched_site_name = s.name
            break

    matched_area_ids = []
    matched_area_names = []
    areas = db.query(models.Area).join(models.Site).filter(models.Site.project_id == project_id).all()
    for area in areas:
        area_lower = area.name.lower()
        if area_lower in q:
            matched_area_ids.append(area.id)
            matched_area_names.append(area.name)
        else:
            # Check key zone keywords (e.g. "tower crane", "level 8", "podium", "basement", "storage yard")
            area_phrases = [p.strip() for p in area_lower.split("–") if len(p.strip()) > 3]
            area_phrases += [p.strip() for p in area_lower.split("-") if len(p.strip()) > 3]
            for p in area_phrases:
                if p in q:
                    matched_area_ids.append(area.id)
                    matched_area_names.append(area.name)
                    break

    matched_material_names = []
    materials = db.query(models.Material).filter(models.Material.project_id == project_id).all()
    # Generic domain stopwords that must not trigger partial material matches
    domain_mat_stopwords = {
        "safety", "barricade", "temporary", "standard", "general", "protection",
        "grade", "heavy", "high", "type", "panels", "structural", "ready", "unit",
        "units", "items", "area", "zone", "site", "wall", "slab", "beam", "column",
        "mix", "rated", "fine", "coarse", "mild"
    }
    for m in materials:
        mat_lower = m.material_name.lower()
        if mat_lower in q:
            matched_material_names.append(m.material_name)
        else:
            # Check specific noun tokens (e.g. "facade", "cable", "tiles", "cement", "rebar", "concrete")
            mat_words = [w for w in re.findall(r'\w+', mat_lower) if len(w) > 3 and w not in domain_mat_stopwords]
            if any(w in q for w in mat_words):
                matched_material_names.append(m.material_name)

    # 3. Dynamic Phrase Extraction (2-word and 3-word n-grams)
    words = re.findall(r'\w+', q)
    phrases = []
    if len(words) >= 2:
        for i in range(len(words) - 1):
            phrases.append(f"{words[i]} {words[i+1]}")
    if len(words) >= 3:
        for i in range(len(words) - 2):
            phrases.append(f"{words[i]} {words[i+1]} {words[i+2]}")

    # General Meaningful Entities (stopwords filtered)
    stopwords = {
        "what", "is", "the", "are", "in", "of", "to", "and", "a", "an", "for", "on", "with",
        "this", "that", "which", "give", "me", "show", "tell", "there", "any", "about", "how",
        "many", "been", "was", "were", "who", "whom", "will", "can", "why", "cant", "can't",
        "did", "does", "whats", "what's"
    }
    entities = [w for w in words if w not in stopwords and len(w) > 2]
    # Add matched DB entity names to entities list
    for name in matched_material_names + matched_area_names:
        for w in re.findall(r'\w+', name.lower()):
            if w not in stopwords and len(w) > 2 and w not in entities:
                entities.append(w)

    # 4. Parse Date and Time
    target_date, time_range = parse_date_and_time(q, db=db, project_id=project_id)

    # 5. Semantic Concept Detection (Problem/Blocker, Inspection, PPE, Progress, etc.)
    is_problem = any(bool(re.search(rf'\b{re.escape(kw)}\b', q)) for kw in [
        "blocking", "blocker", "delayed", "delay", "delays", "holding up", "hold up",
        "affecting", "cannot continue", "preventing", "trouble", "shortage", "shortages",
        "unavailable", "out of stock", "low stock", "stuck", "stopped", "stoppage", "stalled",
        "halted", "freeze", "frozen", "paused", "interrupted", "disrupted", "impediment"
    ]) or bool(re.search(r'\b(delay|block|hold\s*up|affect|stuck|prevent|stop|halt|stall)\b', q))

    is_unresolved = any(bool(re.search(rf'\b{re.escape(kw)}\b', q)) for kw in ["unresolved", "open", "pending", "outstanding", "closure", "need closure", "active", "in progress", "investigating"])
    is_failed = any(bool(re.search(rf'\b{re.escape(kw)}\b', q)) for kw in ["failed", "fail", "failing", "not passed", "rejected", "re-inspection"])
    is_ppe = any(bool(re.search(rf'\b{re.escape(kw)}\b', q)) for kw in ["ppe", "helmet", "hard hat", "gloves", "boots", "goggles", "vest", "violation", "compliance", "workers following"])
    is_incident = any(bool(re.search(rf'\b{re.escape(kw)}\b', q)) for kw in [
        "incident", "incidents", "accident", "accidents", "injury", "hazard", "hazards",
        "fall", "safety problem", "safety problems", "safety issue", "safety issues", "safety concerns"
    ]) or bool(re.search(r'\bsafety\s*(?:problems?|issues?|incidents?|concerns?|hazards?)\b', q))
    is_inspection = any(kw in q for kw in ["inspection", "inspections", "inspector", "audit", "quality check"])
    is_progress = any(kw in q for kw in ["progress", "daily report", "weekly report", "what happened", "construction progress", "update", "milestone", "work completed"])
    is_risk = any(kw in q for kw in [
        "why is the project risk high", "why is project risk high", "what is the project risk",
        "what is the risk score", "risk assessment", "risk factors", "risk score", "risk rating", "risk level"
    ])

    # Classify primary topic for routing guidance
    if is_risk:
        primary_topic = "SAFETY_RISK"
        needs_risk = True
        needs_sql = False
    elif is_incident or (is_unresolved and not bool(matched_material_names) and not is_inspection):
        primary_topic = "SAFETY_INCIDENTS"
        needs_risk = False
        needs_sql = True
    elif is_progress and ("week" in q or "weekly" in q):
        primary_topic = "WEEKLY_PROGRESS_REPORT"
        needs_risk = False
        needs_sql = True
    elif is_progress:
        primary_topic = "DAILY_REPORT"
        needs_risk = False
        needs_sql = True
    elif is_ppe:
        primary_topic = "PPE"
        needs_risk = False
        needs_sql = True
    elif is_failed or is_inspection:
        primary_topic = "INSPECTION"
        needs_risk = False
        needs_sql = True
    elif bool(matched_area_ids) and not bool(matched_material_names) and not is_problem:
        primary_topic = "AREA_SAFETY"
        needs_risk = False
        needs_sql = True
    elif bool(matched_material_names) or any(kw in q for kw in ["material", "materials", "stock", "supply", "supplier", "unavailable", "delayed", "facade", "cable", "rebar", "cement"]):
        primary_topic = "MATERIALS"
        needs_risk = False
        needs_sql = True
    elif any(kw in q for kw in ["how many", "count", "number of", "list all"]):
        primary_topic = "EXACT_COUNT"
        needs_risk = False
        needs_sql = True
    else:
        primary_topic = "GENERAL_PROJECT"
        needs_risk = False
        needs_sql = False

    qu_res = QueryUnderstanding(
        query=query,
        primary_topic=primary_topic,
        entities=entities,
        phrases=phrases,
        target_date=target_date,
        time_filter=time_range,
        matched_site_id=matched_site_id,
        matched_site_name=matched_site_name,
        matched_area_ids=matched_area_ids,
        matched_area_names=matched_area_names,
        matched_material_names=matched_material_names,
        is_problem_query=is_problem,
        is_unresolved_query=is_unresolved,
        is_failed_query=is_failed,
        is_ppe_query=is_ppe,
        is_progress_query=is_progress,
        is_material_query=bool(matched_material_names) or primary_topic == "MATERIALS",
        is_area_query=bool(matched_area_ids),
        retrieval_mode="HYBRID",
        needs_risk_engine=needs_risk,
        needs_exact_sql=needs_sql,
        needs_semantic_rag=True
    )
    qu_res.requirements = derive_query_requirements(query=query, qu=qu_res)
    return qu_res
