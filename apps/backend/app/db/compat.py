from sqlalchemy import text


def adapt_ddl_for_dialect(statement: str, dialect_name: str) -> str:
    if dialect_name == "postgresql":
        return statement.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY").replace("DATETIME", "TIMESTAMP")
    return statement


async def execute_ddl(db, statement: str) -> None:
    get_bind = getattr(db, "get_bind", None)
    dialect_name = get_bind().dialect.name if get_bind else "sqlite"
    await db.execute(text(adapt_ddl_for_dialect(statement, dialect_name)))