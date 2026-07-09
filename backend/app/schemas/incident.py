from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.scan import FindingSummaryItem


class IncidentCreate(BaseModel):
    """Posted by the extension when a user sends sensitive data despite a warning.

    Contains ONLY metadata + a masked snippet — never raw PII values.
    """

    site: str | None = Field(default=None, max_length=255)
    action: Literal["sent", "blocked", "dismissed"] = "sent"
    risk_score: float = Field(ge=0, le=100)
    risk_level: Literal["low", "medium", "high", "critical"]
    entity_count: int = Field(default=0, ge=0)
    findings_summary: list[FindingSummaryItem] = Field(default_factory=list)
    masked_snippet: str | None = Field(default=None, max_length=2000)
    actor_label: str | None = Field(default=None, max_length=255)


class IncidentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    actor_label: str | None
    site: str | None
    action: str
    risk_score: float
    risk_level: str
    entity_count: int
    findings_summary: list
    masked_snippet: str | None
    created_at: datetime
