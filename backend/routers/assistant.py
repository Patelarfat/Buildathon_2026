import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
import schemas
import models
from services.assistant_context import retrieve_assistant_context
from services.assistant_structured_service import build_structured_assistant_response
from services.llm.client import LLMClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects", tags=["Assistant"])


@router.post("/{project_id}/assistant/chat", response_model=schemas.AssistantChatResponse)
def chat_with_assistant(
    project_id: int,
    request: schemas.AssistantChatRequest,
    db: Session = Depends(get_db)
):
    """
    Natural Language Project Management Assistant endpoint.
    Retrieves targeted, grounded project data from PostgreSQL and uses LLM to provide
    verifiable, factually grounded answers with source citations and structured UI data.
    """
    cleaned_message = request.message.strip()
    if not cleaned_message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question message cannot be empty."
        )

    # Verify project exists
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found"
        )

    # 1. Retrieve targeted project context
    try:
        context_text, sources, data_used, project_name = retrieve_assistant_context(
            db=db,
            project_id=project_id,
            query=cleaned_message
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving context for project {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve project context."
        )

    # 2. Generate grounded LLM response
    try:
        answer = LLMClient.generate_response(
            query=cleaned_message,
            grounded_context=context_text,
            project_name=project_name
        )
    except Exception as e:
        logger.error(f"LLM generation failed for project {project_id}: {e}")
        answer = "The AI assistant is temporarily unavailable. You can still use the project intelligence dashboard."

    # 3. Build deterministic, typed structured UI response
    structured_data = None
    try:
        structured_data = build_structured_assistant_response(
            db=db,
            project_id=project_id,
            query=cleaned_message,
            raw_answer=answer,
            data_used=data_used,
            project_name=project_name
        )
    except Exception as e:
        logger.error(f"Error building structured assistant response: {e}")

    return schemas.AssistantChatResponse(
        project_id=project_id,
        answer=answer,
        sources=structured_data.sources if structured_data else sources,
        data_used=data_used,
        structured=structured_data
    )

