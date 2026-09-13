import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

import models
from services.embeddings import EmbeddingService
from .document_builder import DocumentBuilder

logger = logging.getLogger(__name__)


class RAGIndexer:
    """
    RAG Ingestion and Synchronization Engine.
    Handles semantic vector upserts, deletes, deduplication, and project backfill indexing.
    """

    @classmethod
    def upsert_document(
        cls,
        db: Session,
        project_id: int,
        source_type: str,
        source_id: int,
        title: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
        site_id: Optional[int] = None,
        area_id: Optional[int] = None,
    ) -> models.RAGDocument:
        """
        Creates or updates a single semantic vector document with deduplication.
        """
        # Generate embedding vector
        embedding_vec = EmbeddingService.get_embedding(content)
        embedding_json = json.dumps(embedding_vec)
        meta_json = json.dumps(metadata or {})

        existing = (
            db.query(models.RAGDocument)
            .filter(
                models.RAGDocument.project_id == project_id,
                models.RAGDocument.source_type == source_type,
                models.RAGDocument.source_id == source_id,
            )
            .first()
        )

        if existing:
            existing.title = title
            existing.content = content
            existing.metadata_json = meta_json
            existing.embedding = embedding_json
            existing.site_id = site_id
            existing.area_id = area_id
            existing.updated_at = datetime.utcnow()
            doc = existing
        else:
            doc = models.RAGDocument(
                project_id=project_id,
                site_id=site_id,
                area_id=area_id,
                source_type=source_type,
                source_id=source_id,
                title=title,
                content=content,
                metadata_json=meta_json,
                embedding=embedding_json,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(doc)

        db.commit()
        db.refresh(doc)
        return doc

    @classmethod
    def delete_document(
        cls,
        db: Session,
        project_id: int,
        source_type: str,
        source_id: int
    ) -> bool:
        """Removes a RAG document upon entity deletion."""
        doc = (
            db.query(models.RAGDocument)
            .filter(
                models.RAGDocument.project_id == project_id,
                models.RAGDocument.source_type == source_type,
                models.RAGDocument.source_id == source_id,
            )
            .first()
        )
        if doc:
            db.delete(doc)
            db.commit()
            return True
        return False

    @classmethod
    def index_entity(cls, db: Session, source_type: str, entity: Any) -> Optional[models.RAGDocument]:
        """Convenience dispatcher to index any supported database model."""
        if not entity or not hasattr(entity, "id"):
            return None

        try:
            if source_type == "PROJECT":
                title, content, meta = DocumentBuilder.build_project(entity)
                return cls.upsert_document(db, entity.id, "PROJECT", entity.id, title, content, meta)

            elif source_type == "SITE":
                title, content, meta = DocumentBuilder.build_site(entity)
                return cls.upsert_document(db, entity.project_id, "SITE", entity.id, title, content, meta, site_id=entity.id)

            elif source_type == "AREA":
                title, content, meta = DocumentBuilder.build_area(entity)
                project_id = entity.site.project_id if entity.site else meta.get("project_id")
                if project_id:
                    return cls.upsert_document(db, project_id, "AREA", entity.id, title, content, meta, site_id=entity.site_id, area_id=entity.id)

            elif source_type == "INCIDENT":
                title, content, meta = DocumentBuilder.build_safety_incident(entity)
                return cls.upsert_document(db, entity.project_id, "INCIDENT", entity.id, title, content, meta, site_id=entity.site_id, area_id=entity.area_id)

            elif source_type == "INSPECTION":
                title, content, meta = DocumentBuilder.build_inspection(entity)
                return cls.upsert_document(db, entity.project_id, "INSPECTION", entity.id, title, content, meta, site_id=entity.site_id, area_id=entity.area_id)

            elif source_type == "OBSERVATION":
                title, content, meta = DocumentBuilder.build_observation(entity)
                return cls.upsert_document(db, entity.project_id, "OBSERVATION", entity.id, title, content, meta, site_id=entity.site_id, area_id=entity.area_id)

            elif source_type == "DAILY_REPORT":
                title, content, meta = DocumentBuilder.build_daily_report(entity)
                return cls.upsert_document(db, entity.project_id, "DAILY_REPORT", entity.id, title, content, meta, site_id=entity.site_id, area_id=entity.area_id)

            elif source_type == "MATERIAL":
                title, content, meta = DocumentBuilder.build_material(entity)
                return cls.upsert_document(db, entity.project_id, "MATERIAL", entity.id, title, content, meta, site_id=entity.site_id, area_id=entity.area_id)

            elif source_type == "AI_FINDING":
                title, content, meta = DocumentBuilder.build_ai_safety_finding(entity)
                return cls.upsert_document(db, entity.project_id, "AI_FINDING", entity.id, title, content, meta, site_id=entity.site_id, area_id=entity.area_id)

            elif source_type == "PHOTO":
                title, content, meta = DocumentBuilder.build_photo(entity)
                return cls.upsert_document(db, entity.project_id, "PHOTO", entity.id, title, content, meta, site_id=entity.site_id, area_id=entity.area_id)

        except Exception as e:
            logger.error(f"Error indexing {source_type} #{getattr(entity, 'id', 'unknown')}: {e}")

        return None

    @classmethod
    def index_project_backfill(cls, db: Session, project_id: int) -> Dict[str, Any]:
        """
        Scans all existing PostgreSQL database tables for a project and indexes/upserts
        all records into rag_documents with high-dimensional vector embeddings.
        """
        project = db.query(models.Project).filter(models.Project.id == project_id).first()
        if not project:
            return {"status": "error", "message": f"Project {project_id} not found", "indexed_count": 0}

        counts: Dict[str, int] = {
            "PROJECT": 0, "SITE": 0, "AREA": 0, "DAILY_REPORT": 0,
            "INCIDENT": 0, "INSPECTION": 0, "OBSERVATION": 0,
            "MATERIAL": 0, "AI_FINDING": 0, "PHOTO": 0
        }

        # 1. Project
        cls.index_entity(db, "PROJECT", project)
        counts["PROJECT"] += 1

        # 2. Sites & Areas
        sites = db.query(models.Site).filter(models.Site.project_id == project_id).all()
        for site in sites:
            cls.index_entity(db, "SITE", site)
            counts["SITE"] += 1
            areas = db.query(models.Area).filter(models.Area.site_id == site.id).all()
            for area in areas:
                cls.index_entity(db, "AREA", area)
                counts["AREA"] += 1

        # 3. Daily Reports
        reports = db.query(models.DailyReport).filter(models.DailyReport.project_id == project_id).all()
        for r in reports:
            cls.index_entity(db, "DAILY_REPORT", r)
            counts["DAILY_REPORT"] += 1

        # 4. Safety Incidents
        incidents = db.query(models.SafetyIncident).filter(models.SafetyIncident.project_id == project_id).all()
        for inc in incidents:
            cls.index_entity(db, "INCIDENT", inc)
            counts["INCIDENT"] += 1

        # 5. Inspection Reports
        inspections = db.query(models.InspectionReport).filter(models.InspectionReport.project_id == project_id).all()
        for insp in inspections:
            cls.index_entity(db, "INSPECTION", insp)
            counts["INSPECTION"] += 1

        # 6. Observations
        observations = db.query(models.Observation).filter(models.Observation.project_id == project_id).all()
        for obs in observations:
            cls.index_entity(db, "OBSERVATION", obs)
            counts["OBSERVATION"] += 1

        # 7. Materials
        materials = db.query(models.Material).filter(models.Material.project_id == project_id).all()
        for mat in materials:
            cls.index_entity(db, "MATERIAL", mat)
            counts["MATERIAL"] += 1

        # 8. AI Safety Findings
        findings = db.query(models.AISafetyFinding).filter(models.AISafetyFinding.project_id == project_id).all()
        for f in findings:
            cls.index_entity(db, "AI_FINDING", f)
            counts["AI_FINDING"] += 1

        # 9. Site Photos
        photos = db.query(models.SitePhoto).filter(models.SitePhoto.project_id == project_id).all()
        for p in photos:
            cls.index_entity(db, "PHOTO", p)
            counts["PHOTO"] += 1

        total_indexed = sum(counts.values())
        return {
            "status": "success",
            "project_id": project_id,
            "project_name": project.name,
            "total_indexed": total_indexed,
            "breakdown": counts
        }

    @classmethod
    def index_photo(cls, db: Session, photo_id: int) -> Optional[models.RAGDocument]:
        """Indexes/updates a single site photo document in RAG vector store."""
        photo = db.query(models.SitePhoto).filter(models.SitePhoto.id == photo_id).first()
        if not photo:
            return None
        return cls.index_entity(db, "PHOTO", photo)
