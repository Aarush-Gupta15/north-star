"""Incident use cases: record a policy incident, list them for admins."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.db.models.incident import Incident
from app.db.models.user import User
from app.repositories.audit_repository import AuditRepository
from app.repositories.incident_repository import IncidentRepository
from app.schemas.incident import IncidentCreate


class IncidentService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.incidents = IncidentRepository(db)
        self.audit = AuditRepository(db)

    def record(self, *, user: User, data: IncidentCreate, ip: str | None = None) -> Incident:
        incident = Incident(
            owner_id=user.id,
            actor_label=data.actor_label or user.email,
            site=data.site,
            action=data.action,
            risk_score=data.risk_score,
            risk_level=data.risk_level,
            entity_count=data.entity_count,
            findings_summary=[i.model_dump() for i in data.findings_summary],
            masked_snippet=data.masked_snippet,
        )
        self.incidents.add(incident)
        self.audit.record(
            action="incident.report",
            actor_id=user.id,
            resource_type="incident",
            resource_id=str(incident.id),
            ip_address=ip,
            detail={"site": data.site, "risk_level": data.risk_level, "action": data.action},
        )
        self.db.commit()
        return incident

    def list(self, *, days: int | None = None, limit: int = 200) -> list[Incident]:
        since = datetime.now(timezone.utc) - timedelta(days=days) if days else None
        return self.incidents.list_recent(since=since, limit=limit)

    def since(self, *, days: int) -> list[Incident]:
        return self.list(days=days, limit=1000)

    def get(self, incident_id: uuid.UUID) -> Incident | None:
        return self.incidents.get(incident_id)
