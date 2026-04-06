from sqlalchemy.orm import Session

from app.models.entities import Notification, User, UserRole


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    body: str,
    link: str | None = None,
    type_: str = "general",
) -> Notification:
    notification = Notification(
        user_id=user_id,
        title=title[:255],
        body=body,
        link=(link or None),
        type=type_,
    )
    db.add(notification)
    return notification


def notify_roles(
    db: Session,
    roles: list[UserRole],
    title: str,
    body: str,
    link: str | None = None,
    type_: str = "general",
    exclude_user_id: int | None = None,
) -> None:
    recipients = db.query(User).filter(User.role.in_(roles)).all()
    for recipient in recipients:
        if exclude_user_id is not None and recipient.id == exclude_user_id:
            continue
        create_notification(db, recipient.id, title, body, link, type_)
