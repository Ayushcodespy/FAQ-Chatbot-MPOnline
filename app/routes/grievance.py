from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.entities import Grievance, GrievanceComment, User, UserRole
from app.models.schemas import (
    GrievanceAdminRead,
    GrievanceCommentCreate,
    GrievanceCommentRead,
    GrievanceCreate,
    GrievanceRead,
    GrievanceStatusUpdate,
)
from app.services.notification_service import create_notification, notify_roles


router = APIRouter(tags=["Grievance"])


def _grievance_query(db: Session):
    return db.query(Grievance).options(
        selectinload(Grievance.user),
        selectinload(Grievance.comments).selectinload(GrievanceComment.user),
    )


def _serialize_comment(item: GrievanceComment) -> GrievanceCommentRead:
    return GrievanceCommentRead(
        id=item.id,
        grievance_id=item.grievance_id,
        user_id=item.user_id,
        message=item.message,
        comment_type=item.comment_type,
        created_at=item.created_at,
        username=item.user.username if item.user else None,
        role=item.user.role if item.user else None,
    )


def _serialize_grievance(item: Grievance) -> GrievanceRead:
    return GrievanceRead(
        id=item.id,
        user_id=item.user_id,
        complaint=item.complaint,
        status=item.status,
        created_at=item.created_at,
        comments=[_serialize_comment(comment) for comment in item.comments],
    )


def _serialize_admin_grievance(item: Grievance) -> GrievanceAdminRead:
    return GrievanceAdminRead(
        id=item.id,
        user_id=item.user_id,
        complaint=item.complaint,
        status=item.status,
        created_at=item.created_at,
        username=item.user.username if item.user else None,
        email=item.user.email if item.user else None,
        comments=[_serialize_comment(comment) for comment in item.comments],
    )


def _get_grievance_or_404(db: Session, grievance_id: int) -> Grievance:
    grievance = _grievance_query(db).filter(Grievance.id == grievance_id).first()
    if not grievance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found")
    return grievance


def _ensure_grievance_access(grievance: Grievance, current_user: User) -> None:
    if grievance.user_id != current_user.id and current_user.role.value not in {"admin", "expert"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")


@router.post("/grievance", response_model=GrievanceRead)
def create_grievance(
    payload: GrievanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GrievanceRead:
    grievance = Grievance(user_id=current_user.id, complaint=payload.complaint)
    db.add(grievance)
    db.commit()
    notify_roles(
        db,
        [UserRole.ADMIN, UserRole.EXPERT],
        "New grievance submitted",
        f'User "{current_user.username}" submitted grievance #{grievance.id}.',
        "/dashboard",
        "grievance",
    )
    db.commit()
    grievance = _get_grievance_or_404(db, grievance.id)
    return _serialize_grievance(grievance)


@router.get("/grievance/{grievance_id}", response_model=GrievanceRead)
def get_grievance(
    grievance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GrievanceRead:
    grievance = _get_grievance_or_404(db, grievance_id)
    _ensure_grievance_access(grievance, current_user)
    return _serialize_grievance(grievance)


@router.get("/grievances", response_model=list[GrievanceAdminRead])
def list_grievances(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.EXPERT)),
) -> list[GrievanceAdminRead]:
    grievances = _grievance_query(db).order_by(Grievance.created_at.desc()).all()
    return [_serialize_admin_grievance(item) for item in grievances]


@router.get("/grievances/mine", response_model=list[GrievanceRead])
def list_my_grievances(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[GrievanceRead]:
    grievances = (
        _grievance_query(db)
        .filter(Grievance.user_id == current_user.id)
        .order_by(Grievance.created_at.desc())
        .all()
    )
    return [_serialize_grievance(item) for item in grievances]


@router.patch("/grievance/{grievance_id}", response_model=GrievanceRead)
def update_grievance_status(
    grievance_id: int,
    payload: GrievanceStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.EXPERT)),
) -> GrievanceRead:
    grievance = _get_grievance_or_404(db, grievance_id)
    status_changed = grievance.status != payload.status
    grievance.status = payload.status

    if status_changed:
        db.add(
            GrievanceComment(
                grievance_id=grievance.id,
                user_id=current_user.id,
                message=f'Status updated to "{payload.status}".',
                comment_type="status_update",
            )
        )
        create_notification(
            db,
            grievance.user_id,
            "Grievance status updated",
            f'Grievance #{grievance.id} is now "{payload.status}".',
            "/grievances",
            "grievance",
        )

    db.commit()
    grievance = _get_grievance_or_404(db, grievance_id)
    return _serialize_grievance(grievance)


@router.get("/grievance/{grievance_id}/comments", response_model=list[GrievanceCommentRead])
def list_grievance_comments(
    grievance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[GrievanceCommentRead]:
    grievance = _get_grievance_or_404(db, grievance_id)
    _ensure_grievance_access(grievance, current_user)
    return [_serialize_comment(comment) for comment in grievance.comments]


@router.post("/grievance/{grievance_id}/comments", response_model=GrievanceCommentRead)
def add_grievance_comment(
    grievance_id: int,
    payload: GrievanceCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GrievanceCommentRead:
    grievance = _get_grievance_or_404(db, grievance_id)
    _ensure_grievance_access(grievance, current_user)

    comment = GrievanceComment(
        grievance_id=grievance.id,
        user_id=current_user.id,
        message=payload.message,
        comment_type="comment",
    )
    db.add(comment)

    if current_user.role in {UserRole.ADMIN, UserRole.EXPERT}:
        create_notification(
            db,
            grievance.user_id,
            "New grievance reply",
            f'{current_user.username} replied on grievance #{grievance.id}.',
            "/grievances",
            "grievance_comment",
        )
    else:
        notify_roles(
            db,
            [UserRole.ADMIN, UserRole.EXPERT],
            "User replied on grievance",
            f'{current_user.username} added a reply on grievance #{grievance.id}.',
            "/dashboard",
            "grievance_comment",
            exclude_user_id=current_user.id,
        )

    db.commit()
    db.refresh(comment)
    return _serialize_comment(comment)
