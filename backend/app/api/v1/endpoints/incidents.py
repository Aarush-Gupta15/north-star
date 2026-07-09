from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.db.models.user import User, UserRole
from app.db.session import get_db
from app.schemas.incident import IncidentCreate, IncidentOut
from app.services.incident_service import IncidentService
from app.services.report_service import ReportService

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.post("", response_model=IncidentOut, status_code=status.HTTP_201_CREATED,
             summary="Report a policy incident (sent sensitive data despite warning)")
def create_incident(
    payload: IncidentCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> IncidentOut:
    ip = request.client.host if request.client else None
    return IncidentService(db).record(user=user, data=payload, ip=ip)  # type: ignore[return-value]


@router.get("", response_model=list[IncidentOut], summary="List incidents (admin/analyst)")
def list_incidents(
    days: int | None = Query(default=None, ge=1, le=365),
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.ANALYST)),
) -> list[IncidentOut]:
    return IncidentService(db).list(days=days)  # type: ignore[return-value]


@router.get("/report.pdf", summary="Download the weekly incident digest (admin/analyst)")
def incident_report(
    days: int = Query(default=7, ge=1, le=90),
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.ANALYST)),
) -> Response:
    incidents = IncidentService(db).since(days=days)
    pdf = ReportService().build_incident_digest(incidents, days=days)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="north-star-incidents-{days}d.pdf"'},
    )
