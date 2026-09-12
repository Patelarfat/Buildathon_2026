# Construction Site Intelligence Platform

A modern, full-stack AI-powered intelligence platform for construction sites designed to manage projects, job sites, work zones, personnel, field data collection, computer vision PPE safety detection, and executive decision intelligence.

---

## 1. Quickstart — Clone & Run (For Collaborators & Teammates)

Follow these simple steps to get the entire project running on your local machine.

### Prerequisites
Make sure you have the following installed:
- **Git** ([Download Git](https://git-scm.com/))
- **Python 3.10, 3.11, or 3.12** ([Download Python](https://www.python.org/))
- **Node.js 18+ & npm** ([Download Node.js](https://nodejs.org/))
- **PostgreSQL 14+** ([Download PostgreSQL](https://www.postgresql.org/download/))

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/Patelarfat/Buildathon_2026.git
cd Buildathon_2026
```

---

### Step 2: Set Up PostgreSQL Database
1. Ensure PostgreSQL service is running locally on default port `5432`.
2. Connect to PostgreSQL using your preferred tool (`psql` CLI or pgAdmin):
   ```bash
   psql -U postgres
   ```
3. Create the database:
   ```sql
   CREATE DATABASE construction_intelligence;
   \q
   ```

---

### Step 3: Set Up & Start Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   - On Windows (PowerShell):
     ```powershell
     python -m venv venv
     .\venv\Scripts\activate
     ```
   - On macOS / Linux:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. Configure Environment Variables:
   - Copy `.env.example` to `.env`:
     - On Windows (PowerShell): `Copy-Item .env.example .env`
     - On macOS / Linux: `cp .env.example .env`
   - Edit `.env` and set your PostgreSQL password:
     ```env
     DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/construction_intelligence
     ```

4. Install Python Dependencies:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

5. Start the FastAPI Backend:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   * The backend API server will be available at: `http://127.0.0.1:8000`
   * Interactive Swagger documentation: `http://127.0.0.1:8000/docs`

---

### Step 4: Set Up & Start Frontend

1. Open a **new terminal** and navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```

2. Configure Environment Variables:
   - Copy `.env.example` to `.env.local`:
     - On Windows (PowerShell): `Copy-Item .env.example .env.local`
     - On macOS / Linux: `cp .env.example .env.local`
   - Content of `.env.local`:
     ```env
     NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
     ```

3. Install Node Dependencies:
   ```bash
   npm install
   ```

4. Start the Next.js Development Server:
   ```bash
   npm run dev
   ```
   * The frontend application will be available at: `http://localhost:3000`

---

### Step 5: Running Tests & Verifications

To verify that the system is functioning properly:

1. **Full Audit Verification Suite (Phases 1–6):**
   ```bash
   cd backend
   python test_full_audit_suite.py
   ```
2. **Phase 6 Manager Decision Center Suite:**
   ```bash
   cd backend
   python test_phase6_suite.py
   ```
3. **Phase 5 Intelligence Engine Suite:**
   ```bash
   cd backend
   python test_phase5_suite.py
   ```
4. **Phase 4 Computer Vision Suite:**
   ```bash
   cd backend
   python test_phase4_suite.py
   ```
5. **Phase 3 Field Operations Suite:**
   ```bash
   cd backend
   python test_phase3_suite.py
   ```
6. **Frontend Production Build Check:**
   ```bash
   cd frontend
   npm run build
   ```

---

## 2. Technology Stack

- **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, Lucide Icons, React 18+
- **Backend:** FastAPI, Uvicorn, Python 3.10+
- **Database:** PostgreSQL 14+, SQLAlchemy 2.0 ORM, psycopg2-binary
- **AI / Computer Vision:** Ultralytics YOLO11n fine-tuned on Construction PPE dataset, PyTorch, OpenCV, Pillow
- **Configuration & Security:** python-dotenv (environment variables)

---

## 3. Project Structure

```
Buildathon_2026/
│
├── frontend/                 # Next.js Frontend Application
│   ├── app/
│   │   ├── layout.tsx        # App shell & navigation
│   │   ├── page.tsx          # Home page & API health status
│   │   └── projects/
│   │       ├── page.tsx      # Projects list & creation modal
│   │       └── [id]/
│   │           ├── page.tsx          # Project Overview (sites, areas, members)
│   │           ├── dashboard/        # Manager Decision Center (Phase 6)
│   │           ├── intelligence/     # Intelligence Engine Dashboard (Phase 5)
│   │           ├── photos/           # AI Photo & PPE Analysis (Phase 4)
│   │           ├── daily-reports/    # Field Daily Reports (Phase 3)
│   │           ├── incidents/        # Safety Incidents & Near-Misses (Phase 3)
│   │           ├── inspections/      # Inspection Reports & Checklists (Phase 3)
│   │           ├── observations/     # Site Observations & Hazards (Phase 3)
│   │           └── materials/        # Material Deliveries & Consumption (Phase 3)
│   ├── components/           # Reusable UI widgets & navigation
│   ├── lib/                  # API client and TypeScript type definitions
│   ├── package.json
│   └── .env.example
│
├── backend/                  # FastAPI Backend API Server
│   ├── main.py               # FastAPI entrypoint, CORS, routers & health check
│   ├── database.py           # SQLAlchemy engine & session manager
│   ├── models.py             # Database models across Phases 1–6
│   ├── schemas.py            # Pydantic request & response validation schemas
│   ├── routers/              # RESTful API route controllers
│   │   ├── projects.py       # Projects, sub-sites, sub-members
│   │   ├── sites.py          # Sites & areas
│   │   ├── areas.py          # Area details
│   │   ├── users.py          # User management
│   │   ├── photos.py         # Photo uploads, file storage & AI inspection
│   │   ├── daily_reports.py  # Daily logs
│   │   ├── incidents.py      # Safety incidents
│   │   ├── inspections.py    # Inspections
│   │   ├── observations.py   # Observations
│   │   ├── materials.py      # Materials
│   │   ├── ai_findings.py    # AI finding management & human reviews
│   │   ├── intelligence.py   # Intelligence Engine & risk scoring
│   │   └── dashboard.py      # Manager Decision Center unified dashboard
│   ├── services/             # Core business logic services
│   │   ├── ppe/              # YOLO inference, safety rule engine, bounding boxes
│   │   └── intelligence/     # RiskEngine, recurring issue detector, trend analysis
│   ├── ai/                   # AI weights, model metadata & benchmark scripts
│   │   ├── weights/best.pt   # Production YOLO11n fine-tuned weights
│   │   └── model_metadata.json
│   ├── requirements.txt      # Python dependencies
│   └── .env.example
│
├── database/                 # Database schema docs & migrations
│   └── README.md
│
├── .gitignore
└── README.md
```

---

## 8. API Endpoints

### Health & Root
| Method | Endpoint | Description | Expected Response |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | API Root Health | `{"message": "Construction Intelligence API is running"}` |
| `GET` | `/api/health` | Backend Service Health | `{"status": "healthy"}` |
| `GET` | `/api/db-health` | Live PostgreSQL Connection Check | `{"status": "database connected"}` |
| `GET` | `/docs` | Interactive Swagger UI documentation | Interactive API Docs |

### Project Management APIs (Phase 2)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/projects` | Create a new construction project |
| `GET` | `/api/projects` | List all projects |
| `GET` | `/api/projects/{project_id}` | Get full project details (sites, areas, members) |
| `PUT` | `/api/projects/{project_id}` | Update project info/status |
| `DELETE` | `/api/projects/{project_id}` | Delete project (cascades to sites & areas) |

### Site APIs
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/projects/{project_id}/sites` | Create a site under a project |
| `GET` | `/api/projects/{project_id}/sites` | List sites under a project |
| `GET` | `/api/sites/{site_id}` | Get site details |
| `PUT` | `/api/sites/{site_id}` | Update site info |
| `DELETE` | `/api/sites/{site_id}` | Delete site (cascades to areas) |

### Area APIs
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/sites/{site_id}/areas` | Create an area under a site |
| `GET` | `/api/sites/{site_id}/areas` | List areas under a site |
| `GET` | `/api/areas/{area_id}` | Get area details |
| `PUT` | `/api/areas/{area_id}` | Update area info |
| `DELETE` | `/api/areas/{area_id}` | Delete area |

### Project Member APIs
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/projects/{project_id}/members` | Assign a user to a project |
| `GET` | `/api/projects/{project_id}/members` | List members of a project |
| `PUT` | `/api/projects/{project_id}/members/{user_id}` | Update member role |
| `DELETE` | `/api/projects/{project_id}/members/{user_id}` | Remove user from project |

### Field Data Collection APIs (Phase 3)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/photos` | Upload field photo (multipart/form-data with safe disk storage) |
| `GET` | `/api/projects/{project_id}/photos` | List photos for a project |
| `GET` | `/api/sites/{site_id}/photos` | List photos for a site |
| `GET` | `/api/photos/{photo_id}` | Get single photo metadata |
| `DELETE` | `/api/photos/{photo_id}` | Delete photo record & disk file |
| `POST` | `/api/daily-reports` | Create daily site progress & workforce report |
| `GET` | `/api/daily-reports` | List daily reports (filterable by project, site, date) |
| `GET` | `/api/daily-reports/{id}` | Get daily report details |
| `PUT` | `/api/daily-reports/{id}` | Update daily report |
| `DELETE` | `/api/daily-reports/{id}` | Delete daily report |
| `POST` | `/api/incidents` | Log safety incident / near-miss / hazard |
| `GET` | `/api/incidents` | List safety incidents (filterable by project, site, severity, status) |
| `GET` | `/api/incidents/{id}` | Get incident details |
| `PUT` | `/api/incidents/{id}` | Update incident / resolution status |
| `DELETE` | `/api/incidents/{id}` | Delete safety incident |
| `POST` | `/api/inspections` | Record site inspection report |
| `GET` | `/api/inspections` | List inspection reports (filterable by project, site, type, status) |
| `GET` | `/api/inspections/{id}` | Get inspection details |
| `PUT` | `/api/inspections/{id}` | Update inspection status / findings |
| `DELETE` | `/api/inspections/{id}` | Delete inspection report |
| `POST` | `/api/observations` | Record site issue / observation / hazard |
| `GET` | `/api/observations` | List observations (filterable by project, site, priority, status) |
| `GET` | `/api/observations/{id}` | Get observation details |
| `PUT` | `/api/observations/{id}` | Update observation priority / status / resolution |
| `DELETE` | `/api/observations/{id}` | Delete observation |
| `POST` | `/api/materials` | Log incoming material delivery / consumption |
| `GET` | `/api/materials` | List materials (filterable by project, site, status) |
| `GET` | `/api/materials/{id}` | Get material details |
| `PUT` | `/api/materials/{id}` | Update material quantity / status |
| `DELETE` | `/api/materials/{id}` | Delete material record |
### AI Computer Vision APIs (Phase 4)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/photos/{id}/analyze` | Run YOLO PPE vision inference on a site photo |
| `GET` | `/api/photos/{id}/analysis` | Get latest AI analysis run with detections & safety findings |
| `GET` | `/api/photos/{id}/detections` | Get list of all raw object bounding box detections for photo |
| `GET` | `/api/projects/{id}/ai-findings` | Get all AI safety findings for a project (filterable by site, area, severity, status) |
| `GET` | `/api/projects/{id}/ai-summary` | Aggregate AI statistics (analyzed count, open violations, breakdown by severity) |
| `PATCH` | `/api/ai-findings/{id}` | Human review action (OPEN -> REVIEWED / RESOLVED / FALSE_POSITIVE) |
| `POST` | `/api/projects/{id}/ai/analyze-pending` | Bulk queue un-analyzed photos for automated batch inference |

### Construction Intelligence Engine APIs (Phase 5)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/projects/{id}/intelligence` | Consolidated project intelligence (risk score, area rankings, recurring issues, trends, safety, progress, ops risk) |
| `GET` | `/api/projects/{id}/risk` | Explainable 0-100 safety risk score, level, sub-scores, and reasons |
| `GET` | `/api/projects/{id}/risk/explanation` | Detailed risk explainability report with human-readable rationale |
| `GET` | `/api/projects/{id}/risk/areas` | Area safety risk ranking (sorted highest risk first) |
| `GET` | `/api/projects/{id}/recurring-issues` | Detected recurring issues (>=3 occurrences in time window) |
| `GET` | `/api/projects/{id}/trends` | Period-over-period trend analysis (safety, PPE, incident, progress) |
| `GET` | `/api/projects/{id}/safety-summary` | Consolidated safety metrics & PPE violation breakdown |
| `GET` | `/api/projects/{id}/operational-risk` | Operational risks (material shortages, delivery delays, blockers) |

### Manager Decision Center APIs (Phase 6)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/projects/{id}/dashboard` | Master Manager Decision Center API consolidating executive health KPIs, prioritized attention queue, safety risks, area rankings, recurring problems, PPE distribution, and chronological activity feed. Supports `days` (24h/7d/30d), `site_id`, `area_id` filters. |

---

## 9. Phase Completion Status

- [x] **Phase 1: Basic Project Setup**
  - Full-stack foundation (Next.js, FastAPI, PostgreSQL, SQLAlchemy)
  - Live health check endpoints & verified CORS
  - Environment variable security
- [x] **Phase 2: Project Management**
  - Data models: Projects, Sites, Areas, Project Members, Users
  - Cascading relationships and uniqueness constraints
  - Modular REST APIs with routers & Pydantic validation
  - Responsive Project Management UI with complete CRUD
  - End-to-end regression & persistence verification
- [x] **Phase 3: Field Data Collection**
  - Data models: SitePhotos, DailyReports, SafetyIncidents, InspectionReports, Observations, Materials
  - Strict relationship validation (`validate_hierarchy` checking project-site-area-user links)
  - Safe file upload handling (`/uploads/photos/` with static serving)
  - 6 dedicated field module pages under `/projects/[id]/` + consolidated activity feed
  - 100% test suite verification across all CRUD operations & edge cases
- [x] **Phase 4: Construction PPE Computer Vision**
  - Fine-tuned lightweight YOLO model (`yolo11n-ppe-finetuned`, `v1.0.0-finetuned-construction-ppe`) on official Ultralytics Construction-PPE dataset
  - Real validation metrics exported to `backend/ai/model_metadata.json` (mAP50: 0.4442, Precision: 0.8585, Recall: 0.3929)
  - Database schema: `ai_analysis_runs`, `ai_detections`, `ai_safety_findings` with cascading foreign keys
  - Inference service with singleton model caching and annotated bounding-box image generation
  - Deterministic safety rule engine mapping detected PPE states to severity-graded findings
  - Human-in-the-loop review workflow (`OPEN`, `REVIEWED`, `RESOLVED`, `FALSE_POSITIVE`)
  - Interactive UI with side-by-side / toggled original vs annotated viewer and real-time AI KPI cards
- [x] **Phase 5: Construction Intelligence Engine**
  - Transparent, explainable safety risk score (0-100) with strict component caps (AI findings, Incidents, Observations, Inspections, Recurring, Trend)
  - Explainability engine generating clear, deterministic human-readable reasons for every score
  - Configurable recurring issue detection ($\ge 3$ occurrences per zone in lookback window)
  - Period-over-period trend analysis with configurable tolerance thresholds ($\pm 10\%$)
  - Multi-level hierarchical intelligence (Area ranking $\rightarrow$ Site $\rightarrow$ Project)
  - Clear separation of concerns: Operational risk (material shortages & daily blockers) isolated from Safety Risk
  - Data confidence rating (`LOW`, `MEDIUM`, `HIGH`) preventing false sense of security on inactive projects
  - Full-featured interactive Next.js Intelligence Dashboard at `/projects/[id]/intelligence`
- [x] **Phase 6: Manager Decision Center**
  - Unified Executive Command Center combining field data (Phase 3), AI vision (Phase 4), and intelligence analytics (Phase 5)
  - Master consolidated API: `GET /api/projects/{id}/dashboard` with multi-dimensional filtering (`days`: 1d/7d/30d, `site_id`, `area_id`)
  - Executive health cards: Risk score & level, Progress %, Open safety issues, Open observations, Operational blockers, and Data confidence rating
  - Deterministic **"What Needs Attention?"** prioritized queue sorted by severity (`CRITICAL` $\rightarrow$ `HIGH` $\rightarrow$ `MEDIUM` $\rightarrow$ `LOW`) with direct module action links
  - Area risk ranking table, Safety risk reasons, Recurring problems, PPE violation distribution, Human incidents, Inspections lifecycle, Timeline trend visualizer, and Recent activity stream
  - Dedicated Next.js Manager Decision Center page at `/projects/[id]/dashboard` with interactive filters and quick action navigation
  - 100% automated test coverage in `backend/test_phase6_suite.py` + complete regression pass across Phases 1-5




