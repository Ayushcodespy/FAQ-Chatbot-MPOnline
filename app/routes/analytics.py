from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.models.entities import User, UserRole
from app.models.schemas import FailureAnalytics, QuestionsAnalytics, UsageAnalytics
from app.services.analytics_service import (
    get_failure_analytics,
    get_questions_analytics,
    get_usage_analytics,
)


router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/questions", response_model=QuestionsAnalytics)
def questions_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.EXPERT)),
) -> QuestionsAnalytics:
    return QuestionsAnalytics(**get_questions_analytics(db))


@router.get("/failures", response_model=FailureAnalytics)
def failures_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.EXPERT)),
) -> FailureAnalytics:
    return FailureAnalytics(**get_failure_analytics(db))


@router.get("/usage", response_model=UsageAnalytics)
def usage_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.EXPERT)),
) -> UsageAnalytics:
    return UsageAnalytics(**get_usage_analytics(db))
