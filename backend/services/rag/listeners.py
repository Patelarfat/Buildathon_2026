import logging
from sqlalchemy import event
from sqlalchemy.orm import Session
from database import SessionLocal
import models
from .indexer import RAGIndexer

logger = logging.getLogger(__name__)

# Registered entity mapping: Model -> source_type
MODEL_SOURCE_MAP = {
    models.Project: "PROJECT",
    models.Site: "SITE",
    models.Area: "AREA",
    models.SafetyIncident: "INCIDENT",
    models.InspectionReport: "INSPECTION",
    models.Observation: "OBSERVATION",
    models.DailyReport: "DAILY_REPORT",
    models.Material: "MATERIAL",
    models.AISafetyFinding: "AI_FINDING",
    models.SitePhoto: "PHOTO",
}


def _sync_insert_or_update(mapper, connection, target):
    """Synchronizes newly created or updated entities with RAG vector storage."""
    source_type = MODEL_SOURCE_MAP.get(target.__class__)
    if not source_type:
        return

    # Use an isolated session to prevent transaction nesting conflicts
    db = SessionLocal()
    try:
        # Re-fetch object in new session to ensure all relationships are loaded
        reloaded = db.query(target.__class__).filter(target.__class__.id == target.id).first()
        if reloaded:
            RAGIndexer.index_entity(db, source_type, reloaded)
    except Exception as e:
        logger.warning(f"Error auto-indexing {source_type} #{getattr(target, 'id', None)}: {e}")
    finally:
        db.close()


def _sync_delete(mapper, connection, target):
    """Removes indexed vector documents upon entity deletion."""
    source_type = MODEL_SOURCE_MAP.get(target.__class__)
    if not source_type:
        return

    project_id = getattr(target, "project_id", None)
    if not project_id and hasattr(target, "site") and target.site:
        project_id = target.site.project_id

    if not project_id:
        return

    db = SessionLocal()
    try:
        RAGIndexer.delete_document(db, project_id, source_type, target.id)
    except Exception as e:
        logger.warning(f"Error auto-deleting RAG document for {source_type} #{target.id}: {e}")
    finally:
        db.close()


def register_rag_listeners():
    """Attaches SQLAlchemy ORM lifecycle hooks for automatic RAG vector synchronization."""
    for model_cls in MODEL_SOURCE_MAP.keys():
        event.listen(model_cls, "after_insert", _sync_insert_or_update)
        event.listen(model_cls, "after_update", _sync_insert_or_update)
        event.listen(model_cls, "after_delete", _sync_delete)
    logger.info("RAG vector synchronization listeners registered successfully.")
