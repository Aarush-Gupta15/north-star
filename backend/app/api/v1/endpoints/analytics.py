from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models.user import User, UserRole
from app.db.session import get_db
from app.schemas.analytics import DashboardStats
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])

# Analysts and admins see organization-wide stats; regular users see their own.
_ORG_SCOPE_ROLES = {UserRole.ANALYST, UserRole.ADMIN}


@router.get("/dashboard", response_model=DashboardStats, summary="Dashboard metrics")
def dashboard(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> DashboardStats:
    owner_id = None if user.role in _ORG_SCOPE_ROLES else user.id
    return AnalyticsService(db).dashboard(owner_id=owner_id)
