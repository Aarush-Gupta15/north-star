"""Incident model — records when a user *sent* sensitive data despite a warning.

Privacy note: like Scan, we never store raw PII. We store finding metadata plus
a **masked** snippet (values reduced to their last 4 chars, e.g. "card •••• 1111")
so management can see the context without the tool itself hoarding secrets.
"""
from __future__ import annotations

import uuid

from sqlalchemy import JSON, Float, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

_JSON = JSON().with_variant(JSONB, "postgresql")


class Incident(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "incidents"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # Display label for the employee (email/name), so reports read nicely even if
    # incidents are posted with a shared device token.
    actor_label: Mapped[str | None] = mapped_column(String(255))
    site: Mapped[str | None] = mapped_column(String(255), index=True)  # e.g. chatgpt.com
    action: Mapped[str] = mapped_column(String(32), default="sent")  # sent | dismissed

    risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    risk_level: Mapped[str] = mapped_column(String(16), default="low")
    entity_count: Mapped[int] = mapped_column(Integer, default=0)
    findings_summary: Mapped[list] = mapped_column(_JSON, default=list)  # [{type,count}]
    masked_snippet: Mapped[str | None] = mapped_column(Text)  # values masked to last 4

    owner = relationship("User")
