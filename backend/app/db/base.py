"""Declarative base + shared column mixins.

A single ``Base`` so Alembic autogenerate sees every model's metadata. The
mixins (id/timestamps) keep models DRY and give every table a UUID primary key
and audit timestamps for free.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class UUIDMixin:
    # Generic ``Uuid`` renders as native uuid on Postgres and CHAR(32) on
    # SQLite, so the same models power prod (Postgres) and tests (in-memory).
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


# Import models here so ``Base.metadata`` is fully populated for Alembic.
from app.db.models import audit_log, incident, scan, user  # noqa: E402,F401
