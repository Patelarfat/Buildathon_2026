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
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(os.path.join(UPLOAD_DIR, "photos"), exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified/created successfully.")
    except Exception as e:
        logger.warning(f"Database connection not available at startup: {e}")
    yield


app = FastAPI(
    title="Construction Site Intelligence API",
    description="Backend API for Construction Site Intelligence Platform - Field Data Collection & Project Management",
    version="0.3.0",
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

# Serve uploaded static assets (photos)
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

