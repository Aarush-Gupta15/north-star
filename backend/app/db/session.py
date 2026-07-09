"""Engine + session factory + FastAPI dependency.

``get_db`` yields a request-scoped session and guarantees cleanup. This is the
*only* place the rest of the app obtains a Session, so connection handling is
centralised and testable (tests override this dependency).
"""
from __future__ import annotations

from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


@lru_cache
def get_engine() -> Engine:
    """Lazily build the engine on first use.

    Done lazily (not at import time) so importing this module never forces a DB
    driver to load — tests override ``get_db`` and never touch Postgres, and the
    app fails fast only when it genuinely needs the database.
    """
    return create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,  # transparently recover from dropped connections
        future=True,
    )


@lru_cache
def _session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autocommit=False, autoflush=False, future=True)


def get_db() -> Generator[Session, None, None]:
    db = _session_factory()()
    try:
        yield db
    finally:
        db.close()
