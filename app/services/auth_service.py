from datetime import datetime, timedelta, timezone
from secrets import randbelow

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.entities import EmailOTP, User, UserRole
from app.models.schemas import (
    OTPLoginVerifyRequest,
    OTPRequest,
    RegisterRequest,
    RegisterVerifyRequest,
    UserCreate,
    UserLogin,
)
from app.services.email_service import send_login_otp_email, send_registration_otp_email
from app.utils.security import create_access_token, hash_password, verify_password


def _generate_otp() -> str:
    return f"{randbelow(900000) + 100000}"


def _delete_existing_otps(db: Session, email: str, purpose: str) -> None:
    db.query(EmailOTP).filter(EmailOTP.email == email, EmailOTP.purpose == purpose).delete()


def _create_otp_record(
    db: Session,
    *,
    email: str,
    purpose: str,
    otp: str,
    pending_username: str | None = None,
    pending_password_hash: str | None = None,
) -> None:
    settings = get_settings()
    _delete_existing_otps(db, email, purpose)
    db.add(
        EmailOTP(
            email=email,
            purpose=purpose,
            otp_hash=hash_password(otp),
            pending_username=pending_username,
            pending_password_hash=pending_password_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.otp_expiry_minutes),
        )
    )
    db.commit()


def _get_valid_otp(db: Session, email: str, purpose: str, otp: str) -> EmailOTP:
    record = (
        db.query(EmailOTP)
        .filter(EmailOTP.email == email, EmailOTP.purpose == purpose)
        .order_by(EmailOTP.created_at.desc())
        .first()
    )
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="OTP not found. Please request a new one.")
    if record.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        db.delete(record)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP has expired. Please request a new one.")
    if not verify_password(otp, record.otp_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid OTP.")
    return record


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


def send_registration_otp(db: Session, payload: RegisterRequest) -> None:
    existing = (
        db.query(User)
        .filter((User.username == payload.username) | (User.email == payload.email))
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists")

    otp = _generate_otp()
    settings = get_settings()
    _create_otp_record(
        db,
        email=payload.email,
        purpose="register",
        otp=otp,
        pending_username=payload.username,
        pending_password_hash=hash_password(payload.password),
    )
    send_registration_otp_email(payload.email, payload.username, otp, settings.otp_expiry_minutes)


def verify_registration_otp(db: Session, payload: RegisterVerifyRequest) -> tuple[str, User]:
    record = _get_valid_otp(db, payload.email, "register", payload.otp)
    if not record.pending_username or not record.pending_password_hash:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Registration data is incomplete. Please register again.")

    existing = (
        db.query(User)
        .filter((User.username == record.pending_username) | (User.email == record.email))
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists")

    user = User(
        username=record.pending_username,
        email=record.email,
        password_hash=record.pending_password_hash,
        role=UserRole.USER,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.delete(record)
    db.commit()
    return create_access_token(str(user.id)), user


def authenticate_user_with_password(db: Session, payload: UserLogin) -> tuple[str, User]:
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(str(user.id))
    return token, user


def send_login_otp(db: Session, payload: OTPRequest) -> None:
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No account found for this email.")

    otp = _generate_otp()
    settings = get_settings()
    _create_otp_record(db, email=payload.email, purpose="login", otp=otp)
    send_login_otp_email(payload.email, otp, settings.otp_expiry_minutes)


def authenticate_user_with_otp(db: Session, payload: OTPLoginVerifyRequest) -> tuple[str, User]:
    _get_valid_otp(db, payload.email, "login", payload.otp)
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No account found for this email.")
    _delete_existing_otps(db, payload.email, "login")
    db.commit()
    return create_access_token(str(user.id)), user


def authenticate_user(db: Session, payload: UserLogin) -> tuple[str, User]:
    return authenticate_user_with_password(db, payload)


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
