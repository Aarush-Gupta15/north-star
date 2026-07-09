from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models.scan import Scan
from app.repositories.base import BaseRepository


class ScanRepository(BaseRepository[Scan]):
    model = Scan

    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_for_owner(self, owner_id: uuid.UUID, limit: int = 50) -> list[Scan]:
        stmt = (
            select(Scan)
            .where(Scan.owner_id == owner_id)
            .order_by(Scan.created_at.desc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())

    def count_all(self) -> int:
        return self.db.scalar(select(func.count()).select_from(Scan)) or 0

    # --- Analytics aggregations -------------------------------------------
    # ``owner_id=None`` means org-wide scope (analyst/admin); otherwise the
    # query is constrained to a single user. Counts/group-bys run in SQL;
    # JSON-heavy aggregation (top PII, trend) is done in the service over the
    # rows from ``recent_in_scope`` to stay portable across Postgres/SQLite.

    def _scope(self, stmt, owner_id: uuid.UUID | None):
        return stmt if owner_id is None else stmt.where(Scan.owner_id == owner_id)

    def count_in_scope(self, owner_id: uuid.UUID | None) -> int:
        stmt = self._scope(select(func.count()).select_from(Scan), owner_id)
        return self.db.scalar(stmt) or 0

    def avg_risk_in_scope(self, owner_id: uuid.UUID | None) -> float:
        stmt = self._scope(select(func.avg(Scan.risk_score)), owner_id)
        return float(self.db.scalar(stmt) or 0.0)

    def risk_level_counts(self, owner_id: uuid.UUID | None) -> dict[str, int]:
        stmt = self._scope(
            select(Scan.risk_level, func.count()).group_by(Scan.risk_level), owner_id
        )
        return dict(self.db.execute(stmt).all())

    def recent_in_scope(self, owner_id: uuid.UUID | None, since: datetime) -> list[Scan]:
        stmt = self._scope(select(Scan).where(Scan.created_at >= since), owner_id)
        return list(self.db.scalars(stmt.order_by(Scan.created_at.asc())).all())
