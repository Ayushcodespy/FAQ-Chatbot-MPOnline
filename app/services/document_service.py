import os
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.entities import Document, User
from app.services.ai_service import AIService
from app.services.ocr_service import extract_text
from app.services.vector_store import vector_store
from app.utils.chunking import chunk_text


ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".bmp"}


def save_upload(file: UploadFile) -> str:
    settings = get_settings()
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Upload PDF or image files only.",
        )

    unique_name = f"{uuid.uuid4().hex}{suffix}"
    destination = Path(settings.upload_dir) / unique_name
    with destination.open("wb") as buffer:
        buffer.write(file.file.read())
    return str(destination)


def ingest_document(db: Session, file: UploadFile, user: User) -> Document:
    saved_path = save_upload(file)
    document: Document | None = None
    try:
        extracted_text = extract_text(saved_path)
        if not extracted_text:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No text could be extracted from the uploaded file.",
            )

        settings = get_settings()
        chunks = chunk_text(
            extracted_text,
            chunk_size_words=settings.max_chunk_words,
            overlap_words=settings.chunk_overlap_words,
        )
        if not chunks:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="The document did not produce any searchable text chunks.",
            )

        ai_service = AIService(settings)
        embeddings = ai_service.embed_texts(chunks)

        document = Document(
            filename=file.filename or Path(saved_path).name,
            file_path=saved_path,
            extracted_text=extracted_text,
            chunk_count=len(chunks),
            uploaded_by=user.id,
        )
        db.add(document)
        db.commit()
        db.refresh(document)

        metadata = [
            {
                "document_id": document.id,
                "document_name": document.filename,
                "chunk_index": index,
                "text": chunk,
            }
            for index, chunk in enumerate(chunks)
        ]
        vector_store.add_embeddings(embeddings, metadata)
        return document
    except Exception:
        if document is not None and document.id is not None:
            db.delete(document)
            db.commit()
        else:
            db.rollback()
        if os.path.exists(saved_path):
            os.remove(saved_path)
        raise
