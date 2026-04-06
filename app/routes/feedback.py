from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.entities import Feedback, User
from app.models.schemas import FeedbackCreate, FeedbackRead


router = APIRouter(tags=["Feedback"])


@router.post("/feedback", response_model=FeedbackRead)
def create_feedback(
    payload: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FeedbackRead:
    feedback = Feedback(
        question=payload.question,
        answer=payload.answer,
        rating=payload.rating,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return FeedbackRead.model_validate(feedback)

