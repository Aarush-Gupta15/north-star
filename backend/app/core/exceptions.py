"""Domain exceptions + centralised exception handlers.

Services raise *domain* exceptions that know nothing about HTTP. The API layer
translates them into HTTP responses via registered handlers. This keeps the
service layer transport-agnostic (it could be reused behind a CLI or queue
worker) and gives clients a consistent JSON error envelope.
"""
from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.core.logging import get_logger

logger = get_logger(__name__)


class AppError(Exception):
    """Base class for all expected, handled application errors."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "app_error"

    def __init__(self, message: str | None = None) -> None:
        self.message = message or self.__class__.__doc__ or "Application error"
        super().__init__(self.message)


class NotFoundError(AppError):
    """The requested resource was not found."""

    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


class ConflictError(AppError):
    """The request conflicts with current state (e.g. duplicate)."""

    status_code = status.HTTP_409_CONFLICT
    code = "conflict"


class AuthenticationError(AppError):
    """Authentication failed or credentials are invalid."""

    status_code = status.HTTP_401_UNAUTHORIZED
    code = "authentication_error"


class PermissionDeniedError(AppError):
    """The authenticated user lacks permission for this action."""

    status_code = status.HTTP_403_FORBIDDEN
    code = "permission_denied"


def _error_response(code: str, message: str, status_code: int) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message}},
    )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        logger.info("Handled AppError: %s (%s)", exc.message, exc.code)
        return _error_response(exc.code, exc.message, exc.status_code)

    @app.exception_handler(Exception)
    async def _handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
        # Never leak internals to the client; log full detail server-side.
        logger.exception("Unhandled exception: %s", exc)
        return _error_response(
            "internal_error",
            "An unexpected error occurred.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
