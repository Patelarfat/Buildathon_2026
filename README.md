# Construction Site Intelligence Platform

A modern, full-stack intelligence platform for construction sites designed to manage projects, job sites, work zones, personnel, and monitor safety operations.

---

## 1. Technology Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, React
- **Backend:** FastAPI, Uvicorn, Python 3.10+
- **Database:** PostgreSQL
- **ORM:** SQLAlchemy, psycopg2-binary
- **Configuration & Security:** python-dotenv (environment variables)

---

## 2. Project Structure

```
Buldathon_ps1_2026/
│
├── frontend/
│   ├── app/
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx          # Home page & health check
│   │   └── projects/
│   │       ├── page.tsx      # Projects list & filter
│   │       ├── new/
│   │       │   └── page.tsx  # Create project page
│   │       └── [id]/
│   │           └── page.tsx  # Project details (sites, areas, members)
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── ProjectCard.tsx
│   │   ├── SiteList.tsx
│   │   ├── AreaList.tsx
│   │   └── MemberList.tsx
│   ├── lib/
│   │   └── api.ts            # Typed API client
│   ├── package.json
│   ├── tsconfig.json
│   └── ...
│
├── backend/
│   ├── venv/                 # LOCAL ONLY, NEVER COMMITTED
│   ├── main.py               # FastAPI entrypoint & health checks
│   ├── database.py           # SQLAlchemy engine & session setup
│   ├── models.py             # SQLAlchemy models (User, Project, Site, Area, Member)
│   ├── schemas.py            # Pydantic validation schemas
│   ├── routers/
│   │   ├── projects.py       # Project, sub-site & sub-member APIs
│   │   ├── sites.py          # Site & sub-area APIs
│   │   ├── areas.py          # Area APIs
│   │   └── users.py          # User management APIs
│   ├── requirements.txt      # Python dependencies
│   └── .env                  # LOCAL ONLY, NEVER COMMITTED
│
├── database/
│   └── README.md             # Database schema and setup guide
│
├── .gitignore
└── README.md
```

---

## 3. PostgreSQL Setup

1. Make sure PostgreSQL is running locally on port `5432`.
2. Connect to PostgreSQL:
   ```bash
   psql -U postgres
   ```
3. Create the database:
   ```sql
   CREATE DATABASE construction_intelligence;
   ```

---

## 4. Environment Variables

Create a file named `.env` inside the `backend/` directory with your PostgreSQL connection string:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/construction_intelligence
```

> **Security Note:** `.env` and `venv/` are listed in `.gitignore` and must never be committed to Git.

---

## 5. Backend Setup

1. Open a terminal and navigate to the backend directory:
   ```powershell
   cd backend
   ```

2. Create a virtual environment (if not already created):
   ```powershell
   python -m venv venv
   ```

3. Activate the virtual environment:
   - On Windows PowerShell:
     ```powershell
     .\venv\Scripts\activate
     ```
   - On Linux / macOS:
     ```bash
     source venv/bin/activate
     ```

4. Install dependencies:
   ```powershell
   pip install -r requirements.txt
   ```

---

## 6. Frontend Setup

1. Open a separate terminal and navigate to the frontend directory:
   ```powershell
   cd frontend
   ```

2. Install dependencies:
   ```powershell
   npm install
   ```

---

## 7. How to Run the Project

### Running the Backend Server
```powershell
cd backend
.\venv\Scripts\activate
uvicorn main:app --reload
```
The backend API server will start at `http://127.0.0.1:8000`.

### Running the Frontend Server
```powershell
cd frontend
npm run dev
```
The Next.js frontend will start at `http://localhost:3000`.

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


