"""Scan use case: run the PII engine, persist findings metadata, audit, return.

Privacy by Design: we persist only summary metadata (types/counts/score), never
the raw text or raw PII values. The full entity list is returned to the caller
in-process but never written to the database.
"""
from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.db.models.scan import Scan
from app.db.models.user import User
from app.repositories.audit_repository import AuditRepository
from app.repositories.scan_repository import ScanRepository
from app.schemas.scan import DetectedEntity, ScanIngest, ScanResult
from app.services.pii import get_engine
from app.services.pii.engine import EngineResult
from app.services.report_service import ReportService


class ScanService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.scans = ScanRepository(db)
        self.audit = AuditRepository(db)
        self.engine = get_engine()

    def scan_text(
        self, *, owner_id: uuid.UUID, text: str, explain: bool, ip: str | None = None
    ) -> ScanResult:
        result: EngineResult = self.engine.scan(text, explain=explain)

        scan = Scan(
            owner_id=owner_id,
            source_type="text",
            char_count=len(text),
            risk_score=result.risk_score,
            risk_level=result.risk_level,
            entity_count=result.entity_count,
            findings_summary=result.summary,  # summary only — no raw PII
        )
        self.scans.add(scan)
        self.audit.record(
            action="scan.create",
            actor_id=owner_id,
            resource_type="scan",
            resource_id=str(scan.id),
            ip_address=ip,
            detail={"risk_level": result.risk_level, "entity_count": result.entity_count},
        )
        self.db.commit()

        return ScanResult(
            id=scan.id,
            risk_score=result.risk_score,
            risk_level=result.risk_level,
            entity_count=result.entity_count,
            entities=[
                DetectedEntity(
                    type=e.type, text=e.text, start=e.start, end=e.end, confidence=e.confidence
                )
                for e in result.entities
            ],
            findings_summary=result.summary,
            redacted_text=result.redacted_text,
            explanation=result.explanation,
            created_at=scan.created_at,
        )

    def ingest_summary(
        self, *, owner_id: uuid.UUID, data: ScanIngest, ip: str | None = None
    ) -> Scan:
        """Record a scan from a pre-computed summary (no raw text/PII).

        Used by clients that detect locally — the Chrome extension — so the scan
        appears on the dashboard and audit log without any sensitive content
        crossing the network.
        """
        scan = Scan(
            owner_id=owner_id,
            source_type=data.source_type,
            char_count=data.char_count,
            risk_score=data.risk_score,
            risk_level=data.risk_level,
            entity_count=data.entity_count,
            findings_summary=[item.model_dump() for item in data.findings_summary],
        )
        self.scans.add(scan)
        self.audit.record(
            action="scan.ingest",
            actor_id=owner_id,
            resource_type="scan",
            resource_id=str(scan.id),
            ip_address=ip,
            detail={"source": data.source_type, "risk_level": data.risk_level},
        )
        self.db.commit()
        return scan

    def get_owned(self, *, owner_id: uuid.UUID, scan_id: uuid.UUID) -> Scan:
        scan = self.scans.get(scan_id)
        if scan is None or scan.owner_id != owner_id:
            raise NotFoundError("Scan not found.")
        return scan

    def history(self, *, owner_id: uuid.UUID) -> list[Scan]:
        return self.scans.list_for_owner(owner_id)

    def generate_report(self, *, user: User, scan_id: uuid.UUID) -> bytes:
        """Build a PDF audit report for an owned scan and log the action."""
        scan = self.get_owned(owner_id=user.id, scan_id=scan_id)
        pdf = ReportService().build_pdf(scan, user)
        self.audit.record(
            action="report.generate",
            actor_id=user.id,
            resource_type="scan",
            resource_id=str(scan_id),
        )
        self.db.commit()
        return pdf
