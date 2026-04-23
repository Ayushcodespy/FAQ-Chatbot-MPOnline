from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.models.entities import User, UserRole
from app.models.schemas import DocumentRead, UploadResponse
from app.services.document_service import delete_document, ingest_document, list_documents


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
    return [
        DocumentRead(
            id=item.id,
            title=item.title or item.filename,
            filename=item.filename,
            chunk_count=item.chunk_count,
            created_at=item.created_at,
        )
        for item in items
    ]


@router.delete("/documents/{document_id}")
def remove_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> dict:
    delete_document(db, document_id)
    return {"message": "Document removed successfully."}
