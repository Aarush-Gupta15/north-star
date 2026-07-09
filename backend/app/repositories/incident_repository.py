from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.incident import Incident
from app.repositories.base import BaseRepository


class IncidentRepository(BaseRepository[Incident]):
    model = Incident

    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_recent(self, *, since: datetime | None = None, limit: int = 200) -> list[Incident]:
        stmt = select(Incident)
        if since is not None:
            stmt = stmt.where(Incident.created_at >= since)
        stmt = stmt.order_by(Incident.created_at.desc()).limit(limit)
        return list(self.db.scalars(stmt).all())
