from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.schemas import (
    MessageResponse,
    OTPLoginVerifyRequest,
    OTPRequest,
    RegisterRequest,
    RegisterVerifyRequest,
    TokenResponse,
    UserCreate,
    UserLogin,
)
from app.services.auth_service import (
    authenticate_user,
    authenticate_user_with_otp,
    authenticate_user_with_password,
    register_user,
    send_login_otp,
    send_registration_otp,
    verify_registration_otp,
)


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> TokenResponse:
    user = register_user(db, payload)
    token, user = authenticate_user(db, UserLogin(email=payload.email, password=payload.password))
    return TokenResponse(access_token=token, user=user)


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)) -> TokenResponse:
    token, user = authenticate_user_with_password(db, payload)
    return TokenResponse(access_token=token, user=user)


@router.post("/register/request-otp", response_model=MessageResponse)
def register_request_otp(payload: RegisterRequest, db: Session = Depends(get_db)) -> MessageResponse:
    send_registration_otp(db, payload)
    return MessageResponse(message="OTP sent to your email for account verification.")


@router.post("/register/verify-otp", response_model=TokenResponse)
def register_verify_otp(
    payload: RegisterVerifyRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    token, user = verify_registration_otp(db, payload)
    return TokenResponse(access_token=token, user=user)


@router.post("/login/password", response_model=TokenResponse)
def login_password(payload: UserLogin, db: Session = Depends(get_db)) -> TokenResponse:
    token, user = authenticate_user_with_password(db, payload)
    return TokenResponse(access_token=token, user=user)


@router.post("/login/request-otp", response_model=MessageResponse)
def login_request_otp(payload: OTPRequest, db: Session = Depends(get_db)) -> MessageResponse:
    send_login_otp(db, payload)
    return MessageResponse(message="Login OTP sent to your email.")


@router.post("/login/verify-otp", response_model=TokenResponse)
def login_verify_otp(
    payload: OTPLoginVerifyRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    token, user = authenticate_user_with_otp(db, payload)
    return TokenResponse(access_token=token, user=user)
