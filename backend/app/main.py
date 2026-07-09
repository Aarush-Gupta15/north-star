"""FastAPI application factory + composition root.

This is where the layers are wired together: middleware, exception handlers, and
the versioned API router. Keeping a ``create_app`` factory (rather than a bare
module-level app) makes the application easy to instantiate in tests with
overridden dependencies.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version="0.1.0",
        description="AI-powered privacy assistant — detect, redact, score, and report on PII.",
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
        docs_url="/docs",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    @app.get("/", include_in_schema=False)
    def root() -> dict:
        return {"service": settings.PROJECT_NAME, "docs": "/docs"}

    logger.info("%s started in %s mode", settings.PROJECT_NAME, settings.ENVIRONMENT)
    return app


app = create_app()
