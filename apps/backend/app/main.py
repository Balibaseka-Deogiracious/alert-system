from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError

from app.core.config import settings
from app.api.router import api_router
from app.db.session import initialize_database


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await initialize_database()
    yield

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Campus safety, property recovery, and alert management API.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.exception_handler(DBAPIError)
async def database_error_handler(_request, _exc: DBAPIError) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={"detail": "Database unavailable. Check the SQLite database file and try again."},
    )


@app.exception_handler(ConnectionRefusedError)
async def database_connection_error_handler(_request, _exc: ConnectionRefusedError) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={"detail": "Database unavailable. Check the SQLite database file and try again."},
    )


@app.get("/health", tags=["system"])
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "unialert-api"}