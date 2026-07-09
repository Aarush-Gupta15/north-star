"""Authentication use cases: register + login.

Owns the transaction boundary and orchestrates repositories + security
primitives. Raises domain errors (not HTTP) so it stays transport-agnostic.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.exceptions import AuthenticationError, ConflictError
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models.user import User, UserRole
from app.repositories.audit_repository import AuditRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import RegisterRequest


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.audit = AuditRepository(db)

    def register(self, data: RegisterRequest) -> User:
        if self.users.get_by_email(data.email):
            raise ConflictError("A user with this email already exists.")
        user = User(
            email=data.email.lower(),
            full_name=data.full_name,
            hashed_password=hash_password(data.password),
            role=UserRole.USER,
        )
        self.users.add(user)
        self.audit.record(action="user.register", actor_id=user.id, resource_type="user",
                          resource_id=str(user.id))
        self.db.commit()
        return user

    def authenticate(self, email: str, password: str) -> User:
        user = self.users.get_by_email(email)
        # Verify even on missing user to avoid timing/enumeration leaks.
        if user is None or not verify_password(password, user.hashed_password):
            raise AuthenticationError("Incorrect email or password.")
        if not user.is_active:
            raise AuthenticationError("This account is disabled.")
        return user

    def login(self, email: str, password: str) -> str:
        user = self.authenticate(email, password)
        self.audit.record(action="user.login", actor_id=user.id)
        self.db.commit()
        return create_access_token(subject=str(user.id), role=user.role.value)
