"""Aggregates all v1 endpoint routers into one mountable router."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints import analytics, auth, health, incidents, scans

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(scans.router)
api_router.include_router(analytics.router)
api_router.include_router(incidents.router)
