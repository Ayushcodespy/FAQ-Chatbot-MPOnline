from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.entities import User, UserRole
from app.models.schemas import UserCreate, UserLogin
from app.utils.security import create_access_token, hash_password, verify_password


def register_user(db: Session, payload: UserCreate) -> User:
    existing = (
        db.query(User)
        .filter((User.username == payload.username) | (User.email == payload.email))
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists")

    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=UserRole.USER,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, payload: UserLogin) -> tuple[str, User]:
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = create_access_token(str(user.id))
    return token, user


def ensure_bootstrap_admin(
    db: Session,
    username: str | None,
    email: str | None,
    password: str | None,
) -> None:
    if not username or not email or not password:
        return

    existing = db.query(User).filter((User.username == username) | (User.email == email)).first()
    if existing:
        return

    admin = User(
        username=username,
        email=email,
        password_hash=hash_password(password),
        role=UserRole.ADMIN,
    )
    db.add(admin)
    db.commit()
