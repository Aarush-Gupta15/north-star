"""Redis client provider.

Wrapped in a lazy singleton so the connection pool is created once. Used for
caching and as the backing store for rate-limiting. Kept deliberately thin —
callers get a ``redis.Redis`` and use it directly.
"""
from __future__ import annotations

import redis

from app.core.config import settings

_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    global _client
    if _client is None:
        # Short timeouts so a missing Redis fails fast and callers can fall back
        # to live computation instead of hanging.
        _client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=0.5,
            socket_timeout=0.5,
        )
    return _client
