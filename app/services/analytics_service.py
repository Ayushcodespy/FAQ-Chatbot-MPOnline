from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.entities import ChatHistory, Document, ExpertQuery, Feedback, Grievance, User


def get_questions_analytics(db: Session) -> dict:
    recent_questions = (
        db.query(ChatHistory.question, ChatHistory.created_at, ChatHistory.confidence)
        .order_by(ChatHistory.created_at.desc())
        .limit(10)
        .all()
    )
    return {
        "total_questions": db.query(func.count(ChatHistory.id)).scalar() or 0,
        "escalated_questions": db.query(func.count(ChatHistory.id))
        .filter(ChatHistory.escalated.is_(True))
        .scalar()
        or 0,
        "recent_questions": [
            {
                "question": item.question,
                "created_at": item.created_at.isoformat(),
                "confidence": item.confidence,
            }
            for item in recent_questions
        ],
    }


def get_failure_analytics(db: Session) -> dict:
    return {
        "failed_answers": db.query(func.count(ChatHistory.id))
        .filter(ChatHistory.answer == "I don't know")
        .scalar()
        or 0,
        "expert_queue_size": db.query(func.count(ExpertQuery.id))
        .filter(ExpertQuery.status == "pending")
        .scalar()
        or 0,
        "unresolved_grievances": db.query(func.count(Grievance.id))
        .filter(Grievance.status != "resolved")
        .scalar()
        or 0,
    }


def get_usage_analytics(db: Session) -> dict:
    average_rating = db.query(func.avg(Feedback.rating)).scalar()
    return {
        "total_users": db.query(func.count(User.id)).scalar() or 0,
        "total_documents": db.query(func.count(Document.id)).scalar() or 0,
        "total_feedback_entries": db.query(func.count(Feedback.id)).scalar() or 0,
        "average_feedback_rating": round(float(average_rating or 0.0), 2),
    }
