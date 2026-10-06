from app.core.config import normalize_database_url
from app.db.compat import adapt_ddl_for_dialect


def test_postgres_ddl_rewrites_sqlite_autoincrement_and_datetime():
    statement = "CREATE TABLE sample (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at DATETIME)"

    result = adapt_ddl_for_dialect(statement, "postgresql")

    assert "id SERIAL PRIMARY KEY" in result
    assert "created_at TIMESTAMP" in result


def test_sqlite_ddl_remains_unchanged():
    statement = "CREATE TABLE sample (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at DATETIME)"

    assert adapt_ddl_for_dialect(statement, "sqlite") == statement


def test_supabase_postgres_url_uses_async_driver_and_ssl_option():
    result = normalize_database_url("postgresql://app:secret@db.example.test/postgres?sslmode=require")

    assert result.startswith("postgresql+asyncpg://app:secret@db.example.test/postgres")
    assert "ssl=require" in result