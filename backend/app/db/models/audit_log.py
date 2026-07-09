"""AuditLog — append-only trail of security/privacy-relevant actions.

Underpins the GDPR/DPDP audit-trail requirement. Rows are only ever inserted,
never updated or deleted, so the log is tamper-evident by convention (and, in
production, by DB grants).
"""
from __future__ import annotations

import uuid

from sqlalchemy import JSON, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin

_JSON = JSON().with_variant(JSONB, "postgresql")


class AuditLog(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "audit_logs"

    actor_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, index=True)
    action: Mapped[str] = mapped_column(String(64), index=True)  # e.g. "scan.create"
    resource_type: Mapped[str | None] = mapped_column(String(64))
    resource_id: Mapped[str | None] = mapped_column(String(64))
    ip_address: Mapped[str | None] = mapped_column(String(64))
    detail: Mapped[dict] = mapped_column(_JSON, default=dict)
