from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
import models

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Construction Site Intelligence API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Construction Intelligence API is running 🚀"}


@app.get("/api/health")
def health():
    return {"status": "healthy"}


@app.get("/api/db-health")
def db_health():
    return {"status": "database connected"}