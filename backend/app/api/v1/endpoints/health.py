from __future__ import annotations

from fastapi import APIRouter

from app.services.pii import get_engine

router = APIRouter(tags=["health"])


@router.get("/health", summary="Liveness probe")
def health() -> dict:
    return {"status": "ok", "pii_backend": get_engine().backend}
