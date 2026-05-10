import json
import re

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.entities import ChatHistory, ChatMessage, ChatSession, ExpertQuery, User, UserRole
from app.services.ai_service import AIService
from app.services.vector_store import vector_store


GREETING_PHRASES = {
    "hello",
    "hello there",
    "hi",
    "hii",
    "hiii",
    "hey",
    "hey there",
    "good morning",
    "good afternoon",
    "good evening",
    "namaste",
    "namaskar",
}

GREETING_WORDS = {"hello", "hi", "hii", "hiii", "hey", "there", "namaste", "namaskar"}


def _normalize_small_talk(text: str) -> str:
    normalized = re.sub(r"[^a-zA-Z\s]", " ", text).lower()
    normalized = re.sub(r"\s+", " ", normalized).strip()
    normalized = re.sub(r"\bhi+\b", "hii", normalized)
    return normalized


def _is_greeting(question: str) -> bool:
    normalized = _normalize_small_talk(question)
    if not normalized:
        return False

    if normalized in GREETING_PHRASES:
        return True

    words = normalized.split()
    return len(words) <= 3 and all(word in GREETING_WORDS for word in words)


def _greeting_payload(language: str) -> dict:
    if language == "hi":
        answer = "Namaste! Main MPOnline FAQ AI assistant hoon. Main aapki kaise madad kar sakta hoon?"
    else:
        answer = "Hello! I am an AI assistant for MPOnline FAQs. How can I help you today?"

    return {
        "answer": answer,
        "confidence": 1.0,
        "sources": [],
        "escalated": False,
    }


def create_expert_query(db: Session, user: User, question: str, reason: str) -> ExpertQuery:
    from app.services.notification_service import notify_roles

    expert_query = ExpertQuery(user_id=user.id, question=question, reason=reason)
    db.add(expert_query)
    db.commit()
    db.refresh(expert_query)
    notify_roles(
        db,
        [UserRole.ADMIN, UserRole.EXPERT],
        "Expert escalation requested",
        f'{user.username} requested expert help for query #{expert_query.id}.',
        "/experts",
        "expert_query",
    )
    db.commit()
    return expert_query


def create_chat_session(db: Session, user: User, title: str | None = None) -> ChatSession:
    session = ChatSession(user_id=user.id, title=(title or "New chat").strip()[:255] or "New chat")
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_chat_sessions(db: Session, user: User) -> list[ChatSession]:
    message_exists = (
        db.query(ChatMessage.id)
        .filter(ChatMessage.session_id == ChatSession.id)
        .exists()
    )
    return (
        db.query(ChatSession)
        .filter(ChatSession.user_id == user.id, message_exists)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )


def get_chat_session(db: Session, user: User, session_id: int) -> ChatSession:
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
    return session


def get_session_messages(db: Session, user: User, session_id: int) -> list[ChatMessage]:
    session = get_chat_session(db, user, session_id)
    return list(session.messages)


def delete_chat_session(db: Session, user: User, session_id: int) -> None:
    session = get_chat_session(db, user, session_id)
    db.delete(session)
    db.commit()


def generate_answer_payload(question: str, language: str) -> dict:
    if _is_greeting(question):
        return _greeting_payload(language)

    settings = get_settings()
    if vector_store.index is None or vector_store.index.ntotal == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No knowledge base is available. Upload documents first.",
        )

    ai_service = AIService(settings)
    query_embedding = ai_service.embed_query(question)
    matches = vector_store.search(query_embedding, settings.top_k_chunks)

    filtered_matches = [
        item for item in matches if float(item.get("score", 0.0)) >= settings.min_similarity_score
    ]

    if not filtered_matches:
        return {
            "answer": "I don't know",
            "confidence": 0.0,
            "sources": [],
            "escalated": True,
        }

    try:
        llm_result = ai_service.generate_grounded_answer(question, filtered_matches, language)
    except HTTPException:
        raise
    except Exception as exc:
        error_name = exc.__class__.__name__
        error_text = str(exc)
        if "ResourceExhausted" in error_name or "429" in error_text or "quota" in error_text.lower():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    "Gemini quota or rate limit exceeded. Please wait a minute and try again, "
                    "or switch GEMINI_CHAT_MODEL to a model with available quota."
                ),
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI provider failed to generate an answer. Please try again.",
        ) from exc
    grounded = llm_result["grounded"]
    confidence = min(
        llm_result["confidence"],
        max(float(item["score"]) for item in filtered_matches),
    )
    escalated = not grounded or confidence < settings.min_similarity_score

    return {
        "answer": llm_result["answer"] if grounded else "I don't know",
        "confidence": round(confidence if grounded else 0.0, 3),
        "sources": sorted(
            {
                item["document_name"]
                for item in filtered_matches
                if item["document_name"] in llm_result["sources"] or grounded
            }
        ),
        "escalated": escalated,
    }


def answer_public_question(question: str, language: str) -> dict:
    return generate_answer_payload(question, language)


def answer_question(
    db: Session,
    user: User,
    question: str,
    language: str,
    session_id: int | None = None,
) -> dict:
    answer_payload = generate_answer_payload(question, language)
    session = get_chat_session(db, user, session_id) if session_id else create_chat_session(db, user)

    if answer_payload["escalated"] and answer_payload["answer"] == "I don't know":
        create_expert_query(db, user, question, "no_relevant_context")
    elif answer_payload["escalated"]:
        create_expert_query(db, user, question, "low_confidence")

    history = ChatHistory(
        user_id=user.id,
        question=question,
        answer=answer_payload["answer"],
        confidence=answer_payload["confidence"],
        sources=json.dumps(answer_payload["sources"]),
        escalated=answer_payload["escalated"],
    )
    db.add(history)

    message = ChatMessage(
        session_id=session.id,
        user_id=user.id,
        question=question,
        answer=answer_payload["answer"],
        confidence=answer_payload["confidence"],
        sources=json.dumps(answer_payload["sources"]),
        escalated=answer_payload["escalated"],
    )
    db.add(message)

    if session.title == "New chat":
        session.title = question.strip()[:80] or "New chat"

    db.commit()

    return {"session_id": session.id, **answer_payload}


def get_history(db: Session, user: User) -> list[ChatHistory]:
    return (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == user.id)
        .order_by(ChatHistory.created_at.desc())
        .all()
    )


def reset_history(db: Session, user: User) -> None:
    db.query(ChatHistory).filter(ChatHistory.user_id == user.id).delete()
    db.query(ChatMessage).filter(ChatMessage.user_id == user.id).delete()
    db.query(ChatSession).filter(ChatSession.user_id == user.id).delete()
    db.commit()
