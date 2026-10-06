from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


BACKEND_DIR = Path(__file__).resolve().parents[2]


def normalize_database_url(value: str) -> str:
    if value.startswith("postgres://"):
        value = value.replace("postgres://", "postgresql+asyncpg://", 1)
    elif value.startswith("postgresql://"):
        value = value.replace("postgresql://", "postgresql+asyncpg://", 1)

    if value.startswith("postgresql+asyncpg://"):
        parsed = make_url(value)
        query = dict(parsed.query)
        if "sslmode" in query:
            query["ssl"] = query.pop("sslmode")
        value = parsed.set(query=query).render_as_string(hide_password=False)
    return value


class Settings(BaseSettings):
    app_name: str = "UniAlert API"
    environment: str = "development"
    database_url: str = f"sqlite+aiosqlite:///{(BACKEND_DIR / 'unialert.db').as_posix()}"
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    @field_validator("database_url")
    @classmethod
    def resolve_sqlite_path(cls, value: str) -> str:
        value = normalize_database_url(value)

        prefix = "sqlite+aiosqlite:///"
        if value.startswith(prefix):
            database_path = Path(value[len(prefix):])
            if not database_path.is_absolute():
                return f"{prefix}{(BACKEND_DIR / database_path).as_posix()}"
        return value


settings = Settings()
