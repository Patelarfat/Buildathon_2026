import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from database import engine, Base
import models
from routers import (
    projects,
    sites,
    areas,
    users,
    photos,
    daily_reports,
    incidents,
    inspections,
    observations,
    materials,
    ai,
    intelligence,
    dashboard,
    assistant,
    rag,
)
from services.rag import register_rag_listeners

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(os.path.join(UPLOAD_DIR, "photos"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "ai"), exist_ok=True)


def normalize_database_roles():
    from database import SessionLocal
    db = SessionLocal()
    try:
        role_updates = [
            ("Project Manager", "PROJECT_MANAGER"),
            ("PROJECT MANAGER", "PROJECT_MANAGER"),
            ("Site Supervisor", "SITE_SUPERVISOR"),
            ("SITE SUPERVISOR", "SITE_SUPERVISOR"),
            ("Safety Officer", "SAFETY_OFFICER"),
            ("SAFETY OFFICER", "SAFETY_OFFICER"),
            ("Construction Administrator", "ADMIN"),
            ("CONSTRUCTION ADMINISTRATOR", "ADMIN"),
            ("CONSTRUCTION_ADMINISTRATOR", "ADMIN"),
            ("Administrator", "ADMIN"),
            ("Admin", "ADMIN"),
            ("Contractor", "CONTRACTOR"),
            ("CONTRACTOR", "CONTRACTOR"),
            ("ENGINEER", "SITE_SUPERVISOR"),
            ("ENGINEER2", "SITE_SUPERVISOR"),
            ("Engineer", "SITE_SUPERVISOR"),
        ]
        for old_role, new_role in role_updates:
            db.execute(text(f"UPDATE users SET role = '{new_role}' WHERE role = '{old_role}'"))
            db.execute(text(f"UPDATE project_members SET role = '{new_role}' WHERE role = '{old_role}'"))
        db.execute(text("UPDATE users SET role = 'SITE_SUPERVISOR' WHERE role NOT IN ('PROJECT_MANAGER', 'SITE_SUPERVISOR', 'SAFETY_OFFICER', 'CONTRACTOR', 'ADMIN')"))
        db.execute(text("UPDATE project_members SET role = 'SITE_SUPERVISOR' WHERE role NOT IN ('PROJECT_MANAGER', 'SITE_SUPERVISOR', 'SAFETY_OFFICER', 'CONTRACTOR', 'ADMIN')"))
        db.commit()
        logger.info("Database roles normalized successfully.")
    except Exception as e:
        db.rollback()
        logger.warning(f"Could not normalize database roles on startup: {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified/created successfully.")
        normalize_database_roles()
    except Exception as e:
        logger.warning(f"Database initialization error at startup: {e}")

    try:
        register_rag_listeners()
    except Exception as e:
        logger.warning(f"Could not register RAG listeners: {e}")

    yield


app = FastAPI(
    title="Construction Site Intelligence API",
    description="Backend API for Construction Site Intelligence Platform - Field Data Collection & Project Management",
    version="0.6.0",
    lifespan=lifespan
)

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded static assets (photos & AI annotations)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Include API Routers
app.include_router(projects.router)
app.include_router(sites.router)
app.include_router(areas.router)
app.include_router(users.router)
app.include_router(photos.router)
app.include_router(daily_reports.router)
app.include_router(incidents.router)
app.include_router(inspections.router)
app.include_router(observations.router)
app.include_router(materials.router)
app.include_router(ai.router)
app.include_router(intelligence.router)
app.include_router(dashboard.router)
app.include_router(assistant.router)
app.include_router(rag.router)




@app.get("/")
def root():
    return {"message": "Construction Intelligence API is running"}


@app.get("/api/health")
def health():
    return {"status": "healthy"}


@app.get("/api/db-health")
def db_health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "database connected"}
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database connection failed: {str(e)}"
        )

