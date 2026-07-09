"""Application configuration.

Single, validated source of truth for settings, loaded from environment
variables (12-factor). Using ``pydantic-settings`` means misconfiguration fails
loudly at startup with a clear error, rather than surfacing as a mysterious bug
later. Nothing else in the app reads ``os.environ`` directly.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- Meta ---
    PROJECT_NAME: str = "North Star"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # --- Security ---
    SECRET_KEY: str = Field(min_length=32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # --- CORS (comma-separated origins) ---
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173"

    # --- Postgres ---
    POSTGRES_USER: str = "privacy"
    POSTGRES_PASSWORD: str = "change-me-in-prod"
    POSTGRES_DB: str = "northstar"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432

    # --- Redis ---
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    # --- LLM (explanations only; optional) ---
    ANTHROPIC_API_KEY: str | None = None
    LLM_MODEL: str = "claude-haiku-4-5-20251001"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def REDIS_URL(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/0"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.BACKEND_CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached accessor so settings are parsed exactly once per process."""
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
