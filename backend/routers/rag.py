import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
import models
import schemas
from services.rag.indexer import RAGIndexer
from services.rag.retriever import SemanticRetriever
from services.embeddings import EmbeddingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects", tags=["RAG"])


@router.post("/{project_id}/rag/index", response_model=schemas.RAGIndexResponse)
def index_project_rag(
    project_id: int,
    db: Session = Depends(get_db)
):
    """
    Triggers on-demand backfill indexing of all project database records
    (Projects, Sites, Areas, Reports, Incidents, Inspections, Observations, Materials, Findings, Photos)
    into pgvector/rag_documents with semantic vector embeddings.
    """
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found"
        )

    try:
        result = RAGIndexer.index_project_backfill(db=db, project_id=project_id)
        return schemas.RAGIndexResponse(**result)
    except Exception as e:
        logger.error(f"Error backfill indexing project {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RAG indexing failed: {str(e)}"
        )


@router.get("/{project_id}/rag/status", response_model=schemas.RAGStatusResponse)
def get_project_rag_status(
    project_id: int,
    db: Session = Depends(get_db)
):
    """
    Returns current RAG vector index status, total document count,
    breakdown by source type, and active embedding provider details.
    """
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found"
        )

    # Count documents
    total_docs = db.query(func.count(models.RAGDocument.id)).filter(
        models.RAGDocument.project_id == project_id
    ).scalar() or 0

    # Group by source_type
    type_counts = db.query(
        models.RAGDocument.source_type,
        func.count(models.RAGDocument.id)
    ).filter(
        models.RAGDocument.project_id == project_id
    ).group_by(models.RAGDocument.source_type).all()

    breakdown = {t: c for t, c in type_counts}

    latest_doc = db.query(models.RAGDocument).filter(
        models.RAGDocument.project_id == project_id
    ).order_by(models.RAGDocument.updated_at.desc()).first()

    last_indexed = latest_doc.updated_at.isoformat() if latest_doc else None
    embedder_info = EmbeddingService.get_active_provider_info()

    return schemas.RAGStatusResponse(
        project_id=project_id,
        total_documents=total_docs,
        by_source_type=breakdown,
        embedding_provider=embedder_info,
        last_indexed_at=last_indexed
    )


@router.get("/{project_id}/rag/search", response_model=List[schemas.RAGSearchResultItem])
def search_project_rag(
    project_id: int,
    query: Optional[str] = Query(None, description="Semantic search text query"),
    q: Optional[str] = Query(None, description="Semantic search query alias"),
    top_k: int = Query(5, ge=1, le=20),
    site_id: Optional[int] = Query(None),
    area_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Executes a semantic vector similarity search against the project's RAG documents.
    """
    search_text = (query or q or "").strip()
    if not search_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Either 'query' or 'q' parameter is required."
        )

    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found"
        )

    matches = SemanticRetriever.search(
        db=db,
        project_id=project_id,
        query=search_text,
        top_k=top_k,
        site_id=site_id,
        area_id=area_id
    )

    return [schemas.RAGSearchResultItem(**m) for m in matches]
