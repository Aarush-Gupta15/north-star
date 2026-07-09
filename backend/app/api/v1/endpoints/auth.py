from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.user import UserPublic
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)) -> User:
    return AuthService(db).register(data)


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    token = AuthService(db).login(data.email, data.password)
    return TokenResponse(access_token=token)


@router.post("/token", response_model=TokenResponse, include_in_schema=False)
def login_oauth(
    form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
) -> TokenResponse:
    """OAuth2 password-flow endpoint so the Swagger 'Authorize' button works."""
    token = AuthService(db).login(form.username, form.password)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserPublic)
def me(current: User = Depends(get_current_user)) -> User:
    return current
