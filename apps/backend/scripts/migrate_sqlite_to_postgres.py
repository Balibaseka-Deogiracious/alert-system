import asyncio
import getpass
import json
import os
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import normalize_database_url
from app.db.compat import adapt_ddl_for_dialect


def quote_sqlite_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def convert_value(value: object, declared_type: str) -> object:
    if value is None:
        return None
    type_name = declared_type.upper()
    if "DATETIME" in type_name or "TIMESTAMP" in type_name:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is not None:
            return parsed.astimezone(timezone.utc).replace(tzinfo=None)
        return parsed
    if "JSON" in type_name and isinstance(value, str):
        json.loads(value)
    return value


async def migrate(source_path: Path, database_url: str) -> None:
    source = sqlite3.connect(source_path)
    source.row_factory = sqlite3.Row
    tables = source.execute("""
        SELECT name, sql FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
    """).fetchall()
    engine = create_async_engine(normalize_database_url(database_url), pool_pre_ping=True)

    try:
        async with engine.begin() as target:
            for table in tables:
                statement = adapt_ddl_for_dialect(table["sql"], "postgresql")
                statement = re.sub(r"^CREATE TABLE\s+", "CREATE TABLE IF NOT EXISTS ", statement, count=1, flags=re.IGNORECASE)
                await target.exec_driver_sql(statement)

            occupied = []
            for table in tables:
                name = table["name"]
                quoted_name = engine.dialect.identifier_preparer.quote(name)
                count = (await target.exec_driver_sql(f"SELECT COUNT(*) FROM {quoted_name}")).scalar_one()
                if count:
                    occupied.append(name)
            if occupied:
                raise RuntimeError("Destination tables are not empty; refusing to merge or overwrite: " + ", ".join(occupied))

            for table in tables:
                name = table["name"]
                columns = source.execute(f"PRAGMA table_info({quote_sqlite_identifier(name)})").fetchall()
                names = [column["name"] for column in columns]
                quoted_table = engine.dialect.identifier_preparer.quote(name)
                quoted_columns = [engine.dialect.identifier_preparer.quote(column) for column in names]
                placeholders = ", ".join(f"${index}" for index in range(1, len(names) + 1))
                insert_sql = f"INSERT INTO {quoted_table} ({', '.join(quoted_columns)}) VALUES ({placeholders})"
                rows = source.execute(f"SELECT * FROM {quote_sqlite_identifier(name)}").fetchall()
                values = [tuple(convert_value(row[column["name"]], column["type"]) for column in columns) for row in rows]
                for start in range(0, len(values), 250):
                    await target.exec_driver_sql(insert_sql, values[start:start + 250])

                create_sql = table["sql"] or ""
                for column in columns:
                    if column["pk"] and "AUTOINCREMENT" in create_sql.upper():
                        quoted_pk = engine.dialect.identifier_preparer.quote(column["name"])
                        await target.execute(text(f"""
                            SELECT setval(
                                pg_get_serial_sequence(:table_name, :column_name),
                                COALESCE(MAX({quoted_pk}), 1),
                                COUNT(*) > 0
                            ) FROM {quoted_table}
                        """), {"table_name": name, "column_name": column["name"]})
                        break

            print("Migration complete:")
            for table in tables:
                name = table["name"]
                quoted_name = engine.dialect.identifier_preparer.quote(name)
                count = (await target.exec_driver_sql(f"SELECT COUNT(*) FROM {quoted_name}")).scalar_one()
                print(f"  {name}: {count} rows")
    finally:
        source.close()
        await engine.dispose()


def main() -> None:
    source_path = Path(os.environ.get("SQLITE_DATABASE_PATH", BACKEND_DIR / "unialert.db"))
    if not source_path.is_file():
        raise SystemExit(f"SQLite database not found: {source_path}")

    database_url = os.environ.get("SUPABASE_DATABASE_URL")
    if not database_url:
        database_url = getpass.getpass("Supabase PostgreSQL connection string (input hidden): ")
    if not database_url:
        raise SystemExit("A Supabase connection string is required.")

    asyncio.run(migrate(source_path, database_url))


if __name__ == "__main__":
    main()