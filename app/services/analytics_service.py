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
    unresolved_grievances = db.query(func.count(Grievance.id)).filter(Grievance.status != "resolved").scalar() or 0
    resolved_grievances = db.query(func.count(Grievance.id)).filter(Grievance.status == "resolved").scalar() or 0
    return {
        "failed_answers": db.query(func.count(ChatHistory.id))
        .filter(ChatHistory.answer == "I don't know")
        .scalar()
        or 0,
        "expert_queue_size": db.query(func.count(ExpertQuery.id))
        .filter(ExpertQuery.status == "pending")
        .scalar()
        or 0,
        "unresolved_grievances": unresolved_grievances,
        "resolved_grievances": resolved_grievances,
        "total_grievances": unresolved_grievances + resolved_grievances,
    }


def get_usage_analytics(db: Session) -> dict:
    average_rating = db.query(func.avg(Feedback.rating)).scalar()
    helpful_feedback_count = db.query(func.count(Feedback.id)).filter(Feedback.rating >= 4).scalar() or 0
    unhelpful_feedback_count = db.query(func.count(Feedback.id)).filter(Feedback.rating < 4).scalar() or 0
    total_feedback_entries = helpful_feedback_count + unhelpful_feedback_count
    return {
        "total_users": db.query(func.count(User.id)).scalar() or 0,
        "total_documents": db.query(func.count(Document.id)).scalar() or 0,
        "total_feedback_entries": total_feedback_entries,
        "average_feedback_rating": round(float(average_rating or 0.0), 2),
        "helpful_feedback_count": helpful_feedback_count,
        "unhelpful_feedback_count": unhelpful_feedback_count,
        "helpful_feedback_share": round(
            (helpful_feedback_count / total_feedback_entries) * 100 if total_feedback_entries else 0.0,
            2,
        ),
    }
