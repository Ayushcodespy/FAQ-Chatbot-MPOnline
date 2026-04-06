from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.models.entities import User, UserRole
from app.models.schemas import UploadResponse
from app.services.document_service import ingest_document


router = APIRouter(tags=["Documents"])


@router.post("/upload", response_model=UploadResponse)
def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> UploadResponse:
    document = ingest_document(db, file, current_user)
    return UploadResponse(
        document_id=document.id,
        filename=document.filename,
        chunk_count=document.chunk_count,
        message="Document uploaded and indexed successfully.",
    )

