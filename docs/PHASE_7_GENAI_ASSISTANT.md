# Phase 7 — GenAI Construction Project Assistant

## Overview
The **GenAI Construction Project Assistant** provides natural-language conversational intelligence for construction project managers, safety officers, and executives. Grounded strictly in verified PostgreSQL operational records and deterministic **RiskEngine** assessments, the assistant delivers verifiable answers with structured source citations and zero hallucination.

---

## 1. System Architecture & Grounding Pipeline

The assistant operates via a 4-tier grounded pipeline:

```
+-----------------------------------------------------------------------------------+
| 1. User Natural Language Query (e.g., "Why is the risk level high on Tower A?")   |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| 2. Context Retrieval & Semantic Grounding (backend/services/assistant_context.py)  |
|    - Project Isolation Filter (`WHERE project_id = :project_id`)                 |
|    - Natural Language Time Filter (today, yesterday, this week, etc.)             |
|    - Area/Site Scope Matcher                                                      |
|    - Authoritative Multi-Factor Risk Engine Output                                |
|    - Open Incidents, Failed Inspections, Observations, Delayed Materials          |
|    - Segregated PPE Scan Results (Compliance vs Violations)                       |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| 3. Multi-Provider LLM & Deterministic Fallback (backend/services/llm/client.py)   |
|    - System Prompt with Strict Anti-Hallucination & Anti-Injection Guardrails     |
|    - Provider 1: Google Gemini (gemini-1.5-flash)                                 |
|    - Provider 2: OpenAI (gpt-4o-mini)                                             |
|    - Provider 3: Groq (llama-3.3-70b-versatile)                                   |
|    - Provider 4: Grounded Local Synthesizer (100% offline & test deterministic)  |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| 4. Next.js Assistant UI (frontend/app/projects/[id]/assistant/page.tsx)           |
|    - Interactive chat stream with source citations and entity reference badges    |
|    - Follow-up query accelerators and project isolation badges                    |
+-----------------------------------------------------------------------------------+
```

---

## 2. Strict Project Isolation & Security Guardrails

1. **Database-Level Tenant Isolation**:
   Every database query strictly filters by `project_id`. An assistant session for Project A has zero access to Project B records, photos, incidents, or risk evaluations.
2. **Untrusted Data Encapsulation (`<PROJECT_DATA>`)**:
   All DB-retrieved notes, descriptions, and user inputs are enclosed in `<PROJECT_DATA>` XML blocks. The system prompt instructs the model that data is passive and untrusted, mitigating prompt injection attempts.
3. **Deterministic Risk Alignment**:
   The assistant never calculates risk formulas on the fly. It quotes authoritative metrics calculated by `RiskEngine.evaluate_risk(...)`.
4. **PPE Semantic Segregation**:
   `HELMET_DETECTED`, `VEST_DETECTED`, etc. are explicitly treated as **Compliance Confirmations**. Only `PERSON_WITHOUT_*` finding types are labeled as **Safety Violations**.
5. **Honesty on Negative Events**:
   When queried about non-existent events (e.g. crane collapse when no incident exists), the assistant explicitly states that no records exist in the database.

---

## 3. Supported Queries & Intent Routing

| Category | Example User Query | Grounded Data Sources |
| :--- | :--- | :--- |
| **Risk & Explanations** | *"Why is the project risk score 68?"* | Authoritative Risk Engine factors, open violations, unresolved incidents. |
| **Safety Incidents** | *"List any unresolved safety incidents."* | `safety_incidents` table (OPEN, UNDER_REVIEW). |
| **Inspections & Quality** | *"Show failed inspections this week."* | `inspection_reports` table (FAILED) + time filter. |
| **Materials & Supply** | *"Are any critical materials delayed?"* | `materials` table (DELAYED, OUT_OF_STOCK). |
| **PPE Compliance & Violations** | *"Show PPE compliance vs violations from scans."* | `ai_safety_findings` segregated by compliance / violation classes. |
| **Daily Site Logs** | *"What happened on site today?"* | `daily_reports` table + date filter. |
| **Recurring Issues** | *"Are there recurring hazards on site?"* | `RecurringIssueService` (>=3 incident clusters) & Area Rankings. |

---

## 4. API Endpoints

### `POST /api/projects/{project_id}/assistant/chat`

#### Request Payload
```json
{
  "message": "Why is the project risk high?"
}
```

#### Response Payload
```json
{
  "project_id": 134,
  "answer": "### Grounded Project Intelligence: P7 Alpha Complex 1773484413\n\n**Project Risk Engine Evaluation:**\n- Project: P7 Alpha Complex 1773484413 (Status: ACTIVE)\n- Authoritative Risk Score: 55.0/100\n- Risk Level: HIGH\n- Key Contributing Factors: 1 open AI PPE safety violation(s), 1 unresolved safety incident(s)",
  "sources": [
    {
      "type": "RISK",
      "id": "risk_engine",
      "title": "Risk Engine: Score 55.0 (HIGH)",
      "detail": "Deterministic multi-factor risk assessment"
    },
    {
      "type": "INCIDENT",
      "id": "incident_42",
      "title": "Safety Incident #42: NEAR_MISS (HIGH)",
      "detail": "Status: OPEN · Area: Excavation Pit A"
    }
  ],
  "data_used": [
    "risk_engine",
    "safety_incidents",
    "inspections",
    "observations",
    "ppe_violations"
  ]
}
```

---

## 5. Verification & Testing

The Phase 7 implementation is validated via the automated suite `backend/test_phase7_suite.py`:
- `test_01_empty_query_rejection`: Validates 400 Bad Request on empty or whitespace queries.
- `test_02_nonexistent_project_rejection`: Validates 404 Not Found on invalid project IDs.
- `test_03_project_isolation`: Proves Project A data is never leaked to Project B.
- `test_04_risk_score_and_reasons_grounding`: Confirms RiskEngine components are accurately cited.
- `test_05_unresolved_incidents_query`: Verifies incident retrieval and citation formatting.
- `test_06_failed_inspections_query`: Verifies failed inspection report retrieval.
- `test_07_material_blockers_query`: Verifies delayed material identification.
- `test_08_daily_report_query`: Verifies daily log summary retrieval.
- `test_09_ppe_compliance_vs_violation_semantics`: Validates segregation of compliance vs violations.
- `test_10_negative_event_honesty_check`: Confirms zero-hallucination reporting on non-existent events.
- `test_11_fallback_synthesizer_consistency`: Verifies deterministic synthesis when external LLMs are offline.
