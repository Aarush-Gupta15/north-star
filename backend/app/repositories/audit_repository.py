from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.db.models.audit_log import AuditLog
from app.repositories.base import BaseRepository


class AuditRepository(BaseRepository[AuditLog]):
    model = AuditLog

    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def record(
        self,
        *,
        action: str,
        actor_id: uuid.UUID | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        ip_address: str | None = None,
        detail: dict | None = None,
    ) -> AuditLog:
        entry = AuditLog(
            action=action,
            actor_id=actor_id,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            detail=detail or {},
        )
        return self.add(entry)
