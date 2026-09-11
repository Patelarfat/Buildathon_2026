# Construction Site Intelligence Platform

A modern, full-stack intelligence platform for construction sites designed to monitor health, safety, and operations.

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
│   │   └── page.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── ...
│
├── backend/
│   ├── venv/                 # LOCAL ONLY, NEVER COMMITTED
│   ├── main.py               # FastAPI entrypoint & endpoints
│   ├── database.py           # SQLAlchemy engine & session setup
│   ├── models.py             # Database models (User)
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

| Method | Endpoint | Description | Expected Response |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | API Root Health | `{"message": "Construction Intelligence API is running"}` |
| `GET` | `/api/health` | Backend Service Health | `{"status": "healthy"}` |
| `GET` | `/api/db-health` | Live PostgreSQL Connection Check | `{"status": "database connected"}` |
| `GET` | `/docs` | Interactive Swagger UI documentation | Interactive API Docs |
| `GET` | `/redoc` | ReDoc API documentation | OpenAPI Docs |

---

## 9. Phase 1 Completion Status

- [x] Full-stack project structure established
- [x] FastAPI backend configured with CORS and error handling
- [x] PostgreSQL database (`construction_intelligence`) integrated via SQLAlchemy
- [x] User model defined and `users` table created
- [x] Real health checks implemented (`/`, `/api/health`, `/api/db-health`)
- [x] Next.js frontend connected to backend `/api/health`
- [x] Environment variable management configured with `.gitignore` protection
- [x] End-to-end verification tests passed
