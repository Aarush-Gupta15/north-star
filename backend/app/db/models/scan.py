"""Scan model — the record of one PII detection run.

Privacy by Design note: we deliberately do NOT store the raw input text or the
raw detected values. We persist only *findings metadata* (entity types, counts,
offsets, confidence) and the risk score. This satisfies data minimisation and
storage limitation at the schema level — you cannot leak what you never stored.
"""
from __future__ import annotations

import uuid

from sqlalchemy import JSON, Float, ForeignKey, Integer, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

# JSON everywhere, JSONB (indexable) specifically on Postgres.
_JSON = JSON().with_variant(JSONB, "postgresql")


class Scan(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "scans"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    source_type: Mapped[str] = mapped_column(String(32), default="text")  # text | file | image
    char_count: Mapped[int] = mapped_column(Integer, default=0)

    risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    risk_level: Mapped[str] = mapped_column(String(16), default="low")  # low|medium|high|critical
    entity_count: Mapped[int] = mapped_column(Integer, default=0)

    # [{type, count, max_confidence}, ...] — summary only, never raw PII values.
    findings_summary: Mapped[list] = mapped_column(_JSON, default=list)

    owner = relationship("User")
