from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def initialize_database() -> None:
    async with engine.begin() as connection:
        await connection.exec_driver_sql("""
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                first_name VARCHAR(120) NOT NULL,
                last_name VARCHAR(120) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(64) NOT NULL,
                student_id VARCHAR(32) UNIQUE NOT NULL,
                role VARCHAR(32) NOT NULL DEFAULT 'student',
                faculty VARCHAR(180),
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
