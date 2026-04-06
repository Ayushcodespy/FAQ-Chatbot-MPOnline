from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.schemas import TokenResponse, UserCreate, UserLogin
from app.services.auth_service import authenticate_user, register_user


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> TokenResponse:
    user = register_user(db, payload)
    token, user = authenticate_user(db, UserLogin(username=payload.username, password=payload.password))
    return TokenResponse(access_token=token, user=user)


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)) -> TokenResponse:
    token, user = authenticate_user(db, payload)
    return TokenResponse(access_token=token, user=user)

