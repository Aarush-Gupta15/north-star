"""Reusable FastAPI dependencies: current user + RBAC guard.

These are the seam where HTTP auth becomes a domain ``User``. ``require_role``
returns a dependency, so endpoints declare their authorisation needs
declaratively: ``Depends(require_role(UserRole.ADMIN))``.
"""
from __future__ import annotations

import uuid
from collections.abc import Callable

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import AuthenticationError, PermissionDeniedError
from app.core.security import decode_access_token
from app.db.models.user import User, UserRole
from app.db.session import get_db
from app.repositories.user_repository import UserRepository

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/token")

# Role hierarchy: higher number ⊇ lower. ADMIN satisfies any requirement.
_ROLE_RANK = {UserRole.USER: 1, UserRole.ANALYST: 2, UserRole.ADMIN: 3}


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise AuthenticationError("Invalid token payload.")
    user = UserRepository(db).get(uuid.UUID(user_id))
    if user is None or not user.is_active:
        raise AuthenticationError("User not found or inactive.")
    return user


def require_role(minimum: UserRole) -> Callable[[User], User]:
    def _guard(user: User = Depends(get_current_user)) -> User:
        if _ROLE_RANK[user.role] < _ROLE_RANK[minimum]:
            raise PermissionDeniedError(
                f"Requires '{minimum.value}' role or higher."
            )
        return user

    return _guard
