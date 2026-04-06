from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.entities import Notification, User
from app.models.schemas import NotificationBulkAction, NotificationRead


router = APIRouter(tags=["Notifications"])


@router.get("/notifications", response_model=list[NotificationRead])
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[NotificationRead]:
    items = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )
    return [NotificationRead.model_validate(item) for item in items]


@router.patch("/notifications/{notification_id}/read", response_model=NotificationRead)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationRead:
    item = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if not item:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    item.is_read = True
    db.commit()
    db.refresh(item)
    return NotificationRead.model_validate(item)


@router.patch("/notifications/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        .update({Notification.is_read: True}, synchronize_session=False)
    )
    db.commit()
    return {"message": "All notifications marked as read."}


@router.patch("/notifications/read-selected")
def mark_selected_notifications_read(
    payload: NotificationBulkAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if payload.ids:
        (
            db.query(Notification)
            .filter(Notification.user_id == current_user.id, Notification.id.in_(payload.ids))
            .update({Notification.is_read: True}, synchronize_session=False)
        )
        db.commit()
    return {"message": "Selected notifications marked as read."}


@router.delete("/notifications")
def delete_notifications(
    payload: NotificationBulkAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if payload.ids:
        (
            db.query(Notification)
            .filter(Notification.user_id == current_user.id, Notification.id.in_(payload.ids))
            .delete(synchronize_session=False)
        )
        db.commit()
    return {"message": "Selected notifications deleted."}
