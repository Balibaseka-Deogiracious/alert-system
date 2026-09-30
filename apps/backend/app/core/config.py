from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]


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
        prefix = "sqlite+aiosqlite:///"
        if value.startswith(prefix):
            database_path = Path(value[len(prefix):])
            if not database_path.is_absolute():
                return f"{prefix}{(BACKEND_DIR / database_path).as_posix()}"
        return value


settings = Settings()
