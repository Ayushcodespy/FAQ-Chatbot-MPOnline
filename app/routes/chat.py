import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.entities import User
from app.models.schemas import (
    ChatHistoryRead,
    ChatMessageRead,
    ChatRequest,
    ChatResponse,
    ChatSessionCreate,
    ChatSessionRead,
)
from app.services.chat_service import (
    answer_question,
    create_chat_session,
    delete_chat_session,
    get_chat_sessions,
    get_history,
    get_session_messages,
    reset_history,
)


router = APIRouter(tags=["Chat"])


@router.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatResponse:
    result = answer_question(
        db,
        current_user,
        payload.question,
        payload.language,
        payload.session_id,
    )
    return ChatResponse(**result)


@router.post("/chat/sessions", response_model=ChatSessionRead)
def create_session(
    payload: ChatSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatSessionRead:
    session = create_chat_session(db, current_user, payload.title)
    return ChatSessionRead(
        id=session.id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        message_count=len(session.messages),
    )


@router.get("/chat/sessions", response_model=list[ChatSessionRead])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ChatSessionRead]:
    sessions = get_chat_sessions(db, current_user)
    return [
        ChatSessionRead(
            id=session.id,
            title=session.title,
            created_at=session.created_at,
            updated_at=session.updated_at,
            message_count=len(session.messages),
        )
        for session in sessions
    ]


@router.get("/chat/sessions/{session_id}/messages", response_model=list[ChatMessageRead])
def session_messages(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ChatMessageRead]:
    messages = get_session_messages(db, current_user, session_id)
    return [
        ChatMessageRead(
            id=message.id,
            question=message.question,
            answer=message.answer,
            confidence=message.confidence,
            sources=json.loads(message.sources or "[]"),
            escalated=message.escalated,
            created_at=message.created_at,
        )
        for message in messages
    ]


@router.delete("/chat/sessions/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    delete_chat_session(db, current_user, session_id)
    return {"message": "Chat session deleted successfully."}


@router.get("/history", response_model=list[ChatHistoryRead])
def history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ChatHistoryRead]:
    items = get_history(db, current_user)
    return [
        ChatHistoryRead(
            id=item.id,
            question=item.question,
            answer=item.answer,
            confidence=item.confidence,
            sources=json.loads(item.sources or "[]"),
            escalated=item.escalated,
            created_at=item.created_at,
        )
        for item in items
    ]


@router.post("/reset")
def reset(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    reset_history(db, current_user)
    return {"message": "Chat history cleared successfully."}
