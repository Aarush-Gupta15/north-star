from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.scan import ScanIngest, ScanRequest, ScanResult, ScanSummary
from app.services.scan_service import ScanService

router = APIRouter(prefix="/scans", tags=["scans"])


@router.post("", response_model=ScanResult, summary="Scan text for PII")
def create_scan(
    payload: ScanRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ScanResult:
    return ScanService(db).scan_text(
        owner_id=user.id,
        text=payload.text,
        explain=payload.explain,
        ip=request.client.host if request.client else None,
    )


@router.post(
    "/ingest",
    response_model=ScanSummary,
    status_code=201,
    summary="Record a scan from a client-side summary (no raw text)",
)
def ingest_scan(
    payload: ScanIngest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ScanSummary:
    return ScanService(db).ingest_summary(  # type: ignore[return-value]
        owner_id=user.id,
        data=payload,
        ip=request.client.host if request.client else None,
    )


@router.get("", response_model=list[ScanSummary], summary="List my scans")
def list_scans(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[ScanSummary]:
    return ScanService(db).history(owner_id=user.id)  # type: ignore[return-value]


@router.get("/{scan_id}", response_model=ScanSummary, summary="Get one of my scans")
def get_scan(
    scan_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ScanSummary:
    return ScanService(db).get_owned(owner_id=user.id, scan_id=scan_id)  # type: ignore[return-value]


@router.get(
    "/{scan_id}/report",
    summary="Download a PDF audit report for a scan",
    responses={200: {"content": {"application/pdf": {}}}},
)
def download_report(
    scan_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    pdf = ScanService(db).generate_report(user=user, scan_id=scan_id)
    filename = f"privacy-report-{scan_id}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
