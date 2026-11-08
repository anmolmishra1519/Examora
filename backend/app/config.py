"""
Central application configuration.

Everything that varies between environments (local dev, demo, staging,
production on Render) is read from environment variables here. Nothing
below should ever be a secret literal - see ../.env.example for the
variables an operator is expected to set.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "Examora"
    ENV: str = "development"

    # Defaults to a local SQLite file so the project runs with zero
    # external services. Point this at a real Postgres instance
    # (e.g. postgresql://user:pass@host:5432/examora) for production -
    # every model uses the SQLAlchemy ORM so no code change is required.
    DATABASE_URL: str = "sqlite:///./examora.db"

    JWT_SECRET: str = "change-this-in-production-CHANGE-ME"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12  # 12 hours

    # "rules" = the built-in deterministic parser (no external calls,
    # works out of the box). "llm" = route extraction through an LLM
    # for messier documents once AI_API_KEY is supplied.
    AI_PROVIDER: str = "rules"
    AI_API_KEY: str | None = None

    # "demo" generates deterministic sample proctor events for
    # walkthroughs/screenshots. "live" only records events the frontend
    # detection engine (face-api.js / coco-ssd / browser signals) reports.
    PROCTORING_MODE: str = "live"

    STORAGE_PROVIDER: str = "local"
    STORAGE_PATH: str = "./uploads"

    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:4173"

    MAX_UPLOAD_MB: int = 20


@lru_cache
def get_settings() -> Settings:
    return Settings()
