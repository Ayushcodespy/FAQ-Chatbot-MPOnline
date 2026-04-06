from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.entities import ExpertQuery, User, UserRole
from app.models.schemas import ExpertQueryRead, ExpertRequest, ExpertResolveRequest
from app.services.chat_service import create_expert_query
from app.services.notification_service import create_notification


router = APIRouter(tags=["Expert Escalation"])


@router.post("/ask-expert", response_model=ExpertQueryRead)
def ask_expert(
    payload: ExpertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExpertQueryRead:
    query = create_expert_query(db, current_user, payload.question, payload.reason)
    return ExpertQueryRead.model_validate(query)


@router.get("/expert-queries", response_model=list[ExpertQueryRead])
def get_expert_queries(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.EXPERT)),
) -> list[ExpertQueryRead]:
    queries = db.query(ExpertQuery).order_by(ExpertQuery.created_at.desc()).all()
    return [ExpertQueryRead.model_validate(item) for item in queries]


@router.patch("/expert-queries/{query_id}/resolve", response_model=ExpertQueryRead)
def resolve_expert_query(
    query_id: int,
    payload: ExpertResolveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.EXPERT)),
) -> ExpertQueryRead:
    query = db.query(ExpertQuery).filter(ExpertQuery.id == query_id).first()
    if not query:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expert query not found")

    query.expert_response = payload.expert_response
    query.status = payload.status
    create_notification(
        db,
        query.user_id,
        "Expert query updated",
        f"Your escalated query #{query.id} has a new expert update.",
        "/chat",
        "expert_query",
    )
    db.commit()
    db.refresh(query)
    return ExpertQueryRead.model_validate(query)
