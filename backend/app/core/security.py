"""Security primitives: password hashing + JWT issue/verify.

Isolated here so cryptographic choices live in one auditable place. bcrypt for
password storage (slow-by-design, salted); HS256 JWTs for stateless auth. Token
*verification* returns a typed payload or raises a domain error — callers never
touch jose directly.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.core.exceptions import AuthenticationError

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


def create_access_token(subject: str, role: str, expires_minutes: int | None = None) -> str:
    """Issue a signed JWT. ``sub`` is the user id; we also embed the role so the
    API can authorise without a DB round-trip on every request."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload: dict[str, Any] = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:  # expired, bad signature, malformed
        raise AuthenticationError("Could not validate credentials") from exc
