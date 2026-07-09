from __future__ import annotations

from pydantic import BaseModel


class PiiCount(BaseModel):
    type: str
    count: int


class TrendPoint(BaseModel):
    date: str  # ISO date (YYYY-MM-DD)
    scans: int
    avg_risk: float


class RiskBreakdown(BaseModel):
    low: int = 0
    medium: int = 0
    high: int = 0
    critical: int = 0


class DashboardStats(BaseModel):
    """Everything the dashboard needs in a single payload (one round-trip)."""

    scope: str  # "you" | "organization"
    total_scans: int
    high_risk_count: int
    avg_risk_score: float
    privacy_posture_score: float  # 100 = pristine, lower = more exposure on average
    compliance_score: float  # share of scans free of high/critical findings
    risk_breakdown: RiskBreakdown
    top_pii: list[PiiCount]
    trend: list[TrendPoint]
