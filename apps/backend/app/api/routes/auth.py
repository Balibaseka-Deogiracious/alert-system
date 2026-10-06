import hashlib
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.compat import execute_ddl
from app.db.session import get_db_session

router = APIRouter()
KYU_EMAIL = re.compile(r"^[^\s@]+@(std\.)?kyu\.ac\.ug$")


class AccountInput(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str


class LoginInput(BaseModel):
    email: str
    password: str


def password_hash(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def account_payload(row: Any) -> dict[str, str]:
    return {
        "firstName": row["first_name"],
        "lastName": row["last_name"],
        "email": row["email"],
        "role": row.get("role", "student"),
        "studentId": row["student_id"],
        "faculty": row.get("faculty"),
    }


async def ensure_accounts_table(db: AsyncSession) -> None:
    await execute_ddl(db, """
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
    await db.commit()


def validate_email(email: str) -> None:
    if not KYU_EMAIL.fullmatch(email.lower()):
        raise HTTPException(status_code=422, detail="Use a KYU email ending in @std.kyu.ac.ug or @kyu.ac.ug.")


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(account: AccountInput, db: AsyncSession = Depends(get_db_session)) -> dict[str, object]:
    validate_email(str(account.email))
    if len(account.password) < 8:
        raise HTTPException(status_code=422, detail="Password must contain at least 8 characters.")

    await ensure_accounts_table(db)
    existing = await db.execute(text("SELECT id FROM accounts WHERE email = :email"), {"email": str(account.email).lower()})
    if existing.first():
        raise HTTPException(status_code=409, detail="An account already exists for this email.")

    student_id = f"STU-{abs(hash(str(account.email))) % 1_000_000:06d}"
    result = await db.execute(
        text("""
            INSERT INTO accounts (first_name, last_name, email, password_hash, student_id, role)
            VALUES (:first_name, :last_name, :email, :password_hash, :student_id, 'student')
            RETURNING first_name, last_name, email, student_id, role, NULL AS faculty
        """),
        {"first_name": account.first_name.strip(), "last_name": account.last_name.strip(), "email": str(account.email).lower(), "password_hash": password_hash(account.password), "student_id": student_id},
    )
    await db.commit()
    return {"account": account_payload(result.mappings().one())}


@router.post("/signin")
async def signin(credentials: LoginInput, db: AsyncSession = Depends(get_db_session)) -> dict[str, object]:
    validate_email(str(credentials.email))
    await ensure_accounts_table(db)
    result = await db.execute(
        text("SELECT first_name, last_name, email, student_id, role, faculty FROM accounts WHERE email = :email AND password_hash = :password_hash"),
        {"email": str(credentials.email).lower(), "password_hash": password_hash(credentials.password)},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return {"account": account_payload(row)}
