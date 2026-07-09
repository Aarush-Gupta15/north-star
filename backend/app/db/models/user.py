"""User model + role enum (the basis for RBAC)."""
from __future__ import annotations

import enum

from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class UserRole(str, enum.Enum):
    """Three coarse roles for the skeleton. ADMIN ⊇ ANALYST ⊇ USER in practice,
    enforced by the ``require_role`` dependency in the API layer."""

    ADMIN = "admin"
    ANALYST = "analyst"
    USER = "user"


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        # values_callable → store the enum VALUE ("analyst"), matching the
        # lowercase Postgres enum created in the migration. Without this,
        # SQLAlchemy stores the member NAME ("ANALYST") and Postgres rejects it.
        Enum(UserRole, name="user_role", values_callable=lambda e: [m.value for m in e]),
        default=UserRole.USER,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return f"<User {self.email} role={self.role.value}>"
