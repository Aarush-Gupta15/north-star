from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ScanRequest(BaseModel):
    text: str = Field(min_length=1, max_length=50_000, description="Text to scan for PII.")
    explain: bool = Field(default=True, description="Include plain-language risk explanation.")


class DetectedEntity(BaseModel):
    """A single PII finding. ``text`` is the matched span; the API returns it so
    the user can see what was found, but it is NOT persisted to the database."""

    type: str
    text: str
    start: int
    end: int
    confidence: float


class FindingSummaryItem(BaseModel):
    type: str
    count: int
    max_confidence: float


class ScanIngest(BaseModel):
    """Summary-only scan payload (e.g. from the Chrome extension).

    Detection has already happened client-side; we accept ONLY metadata — never
    raw text or raw PII values — to record the scan on the dashboard/audit log.
    This keeps data minimisation intact across the browser boundary.
    """

    source_type: str = Field(default="extension", max_length=32)
    char_count: int = Field(default=0, ge=0)
    risk_score: float = Field(ge=0, le=100)
    risk_level: Literal["low", "medium", "high", "critical"]
    entity_count: int = Field(default=0, ge=0)
    findings_summary: list[FindingSummaryItem] = Field(default_factory=list)


class ScanResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID | None = None
    risk_score: float
    risk_level: str
    entity_count: int
    entities: list[DetectedEntity]
    findings_summary: list[FindingSummaryItem]
    redacted_text: str
    explanation: str | None = None
    created_at: datetime | None = None


class ScanSummary(BaseModel):
    """Lightweight row for history listings (no entity detail)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    risk_score: float
    risk_level: str
    entity_count: int
    source_type: str
    created_at: datetime
