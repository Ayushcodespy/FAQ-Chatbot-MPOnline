from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.dependencies import require_roles
from app.models.entities import User, UserRole
from app.models.schemas import DocumentRead, UploadResponse
from app.services.document_service import delete_document, ingest_document, list_documents
from app.services.vector_store import vector_store


router = APIRouter(tags=["Documents"])


@router.post("/upload", response_model=UploadResponse)
def upload_document(
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> UploadResponse:
    document = ingest_document(db, file, current_user, title)
    return UploadResponse(
        document_id=document.id,
        title=document.title or document.filename,
        filename=document.filename,
        chunk_count=document.chunk_count,
        message="Document uploaded and indexed successfully.",
    )


@router.get("/documents", response_model=list[DocumentRead])
def get_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> list[DocumentRead]:
    items = list_documents(db)
    documents = [
        DocumentRead(
            id=item.id,
            title=item.title or item.filename,
            filename=item.filename,
            chunk_count=item.chunk_count,
            created_at=item.created_at,
        )
        for item in items
    ]
    known_document_ids = {item.id for item in items}
    metadata_path = Path(get_settings().vector_metadata_path)
    fallback_created_at = (
        datetime.fromtimestamp(metadata_path.stat().st_mtime)
        if metadata_path.exists()
        else datetime.utcnow()
    )
    vector_documents: dict[int, dict] = {}
    for item in vector_store.metadata:
        document_id = item.get("document_id")
        if not isinstance(document_id, int) or document_id in known_document_ids:
            continue
        if document_id not in vector_documents:
            vector_documents[document_id] = {
                "title": item.get("document_name") or f"Indexed document #{document_id}",
                "filename": item.get("document_name") or f"indexed-document-{document_id}",
                "chunk_count": 0,
            }
        vector_documents[document_id]["chunk_count"] += 1

    documents.extend(
        DocumentRead(
            id=document_id,
            title=str(data["title"]),
            filename=str(data["filename"]),
            chunk_count=int(data["chunk_count"]),
            created_at=fallback_created_at,
        )
        for document_id, data in sorted(vector_documents.items(), reverse=True)
    )
    return documents


@router.delete("/documents/{document_id}")
def remove_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> dict:
    delete_document(db, document_id)
    return {"message": "Document removed successfully."}
