"""Analytics use case: compute the dashboard payload.

Reads are aggregated through the repository, composed into a ``DashboardStats``,
and cached in Redis for a short TTL. Caching is best-effort: if Redis is
unavailable (tests, local dev without the container), we compute live — the
feature never hard-depends on the cache.

Scaling note: top-PII and trend are aggregated in Python over a 30-day row
window for dialect portability. At larger volumes these become pre-aggregated
rollups or pure-SQL (``date_trunc`` on Postgres) — the repository seam means
that change won't touch this service's callers.
"""
from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from app.cache.redis import get_redis
from app.core.logging import get_logger
from app.repositories.scan_repository import ScanRepository
from app.schemas.analytics import (
    DashboardStats,
    PiiCount,
    RiskBreakdown,
    TrendPoint,
)

logger = get_logger(__name__)

_CACHE_TTL_SECONDS = 45
_FETCH_WINDOW_DAYS = 30
_TREND_DAYS = 14
_HIGH_RISK_LEVELS = {"high", "critical"}


class AnalyticsService:
    def __init__(self, db) -> None:
        self.scans = ScanRepository(db)

    def dashboard(self, *, owner_id: uuid.UUID | None) -> DashboardStats:
        """``owner_id=None`` → organization-wide (analyst/admin); else per-user."""
        cache_key = f"analytics:dashboard:{owner_id or 'org'}"
        redis = self._safe_redis()

        if redis is not None:
            cached = self._safe_get(redis, cache_key)
            if cached:
                return DashboardStats.model_validate_json(cached)

        stats = self._compute(owner_id)

        if redis is not None:
            self._safe_set(redis, cache_key, stats.model_dump_json())
        return stats

    # --- Computation --------------------------------------------------------

    def _compute(self, owner_id: uuid.UUID | None) -> DashboardStats:
        total = self.scans.count_in_scope(owner_id)
        avg_risk = round(self.scans.avg_risk_in_scope(owner_id), 1)
        level_counts = self.scans.risk_level_counts(owner_id)

        breakdown = RiskBreakdown(
            low=level_counts.get("low", 0),
            medium=level_counts.get("medium", 0),
            high=level_counts.get("high", 0),
            critical=level_counts.get("critical", 0),
        )
        high_risk = breakdown.high + breakdown.critical

        since = datetime.now(timezone.utc) - timedelta(days=_FETCH_WINDOW_DAYS)
        recent = self.scans.recent_in_scope(owner_id, since)

        return DashboardStats(
            scope="you" if owner_id is not None else "organization",
            total_scans=total,
            high_risk_count=high_risk,
            avg_risk_score=avg_risk,
            privacy_posture_score=round(max(0.0, 100.0 - avg_risk), 1),
            compliance_score=round((1 - high_risk / total) * 100, 1) if total else 100.0,
            risk_breakdown=breakdown,
            top_pii=self._top_pii(recent),
            trend=self._trend(recent),
        )

    @staticmethod
    def _top_pii(recent, limit: int = 6) -> list[PiiCount]:
        counts: dict[str, int] = defaultdict(int)
        for scan in recent:
            for item in scan.findings_summary or []:
                counts[item["type"]] += int(item.get("count", 0))
        ranked = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:limit]
        return [PiiCount(type=t, count=c) for t, c in ranked]

    @staticmethod
    def _trend(recent) -> list[TrendPoint]:
        by_day: dict[date, list[float]] = defaultdict(list)
        for scan in recent:
            by_day[scan.created_at.date()].append(scan.risk_score)

        today = datetime.now(timezone.utc).date()
        points: list[TrendPoint] = []
        for offset in range(_TREND_DAYS - 1, -1, -1):
            day = today - timedelta(days=offset)
            scores = by_day.get(day, [])
            points.append(
                TrendPoint(
                    date=day.isoformat(),
                    scans=len(scores),
                    avg_risk=round(sum(scores) / len(scores), 1) if scores else 0.0,
                )
            )
        return points

    # --- Cache helpers (all best-effort) ------------------------------------

    @staticmethod
    def _safe_redis():
        try:
            return get_redis()
        except Exception as exc:  # pragma: no cover - depends on environment
            logger.debug("Redis unavailable, computing analytics live: %s", exc)
            return None

    @staticmethod
    def _safe_get(redis, key: str):
        try:
            return redis.get(key)
        except Exception:  # pragma: no cover
            return None

    @staticmethod
    def _safe_set(redis, key: str, value: str) -> None:
        try:
            redis.set(key, value, ex=_CACHE_TTL_SECONDS)
        except Exception:  # pragma: no cover
            pass
