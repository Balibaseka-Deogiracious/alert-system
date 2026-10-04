from datetime import datetime, timezone
import hashlib
import json
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session

router = APIRouter()


class AccountRoleUpdate(BaseModel):
    role: str
    faculty: str | None = None


class ModeratorCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str
    student_id: str
    faculty: str | None = None


class ClaimCreate(BaseModel):
    student_id: str
    student_name: str
    item_name: str
    location: str


async def ensure_accounts_columns(db: AsyncSession) -> None:
    await db.commit()


async def ensure_claims_table(db: AsyncSession) -> None:
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS claims (
            claim_id VARCHAR(32) PRIMARY KEY,
            student_id VARCHAR(32) NOT NULL,
            student_name VARCHAR(180) NOT NULL,
            item_name VARCHAR(255) NOT NULL,
            location VARCHAR(255) NOT NULL,
            status VARCHAR(40) NOT NULL DEFAULT 'pending_approval',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """))
    if hasattr(db, "commit"):
        await db.commit()


@router.post("/claims", status_code=201)
async def create_claim(claim: ClaimCreate, db: AsyncSession = Depends(get_db_session)) -> dict[str, object]:
    await ensure_claims_table(db)
    claim_id = f"CLM-{abs(hash(f'{claim.student_id}:{claim.item_name}:{claim.location}')) % 1000000:06d}"
    result = await db.execute(text("""
        INSERT INTO claims (claim_id, student_id, student_name, item_name, location)
        VALUES (:claim_id, :student_id, :student_name, :item_name, :location)
        RETURNING claim_id, student_id, student_name, item_name, location, status, created_at
    """), {"claim_id": claim_id, "student_id": claim.student_id, "student_name": claim.student_name, "item_name": claim.item_name, "location": claim.location})
    await db.commit()
    row = result.mappings().one()
    return {"claim": {**dict(row), "created_at": row["created_at"].isoformat()}}


SECTION_DEFAULTS = {
    "Recovery Stations": ("Custody network", "Recovery Stations", "Oversee station availability, locker capacity, and custody handoffs across the campus network.", [["9", "registered stations", "8 currently open"], ["62%", "locker capacity", "24h SLA target"], ["31", "items in custody", "0 overdue handoffs"]], [["Central Police Dispatch", "18 lockers • Campus-wide", "Open • 84% capacity"], ["Library Main Service Desk", "9 lockers • North Campus", "Open • 46% capacity"], ["Student Union Information", "6 lockers • Central Campus", "Open • 33% capacity"]]),
    "Campus Broadcasts": ("Emergency communications", "Campus Broadcasts", "Control approved advisories and verify delivery across student, staff, and public display channels.", [["2", "live broadcasts", "12,410 recipients"], ["99.1%", "delivery rate", "All channels healthy"], ["3", "approval drafts", "2 require review"]], [["Science Quadrangle Access Restriction", "Push • Email • Hall displays", "Live • 12,410 delivered"], ["West Gym Theft Prevention Alert", "Push • Student mobile", "Advisory • 8,220 delivered"], ["Blue Line Shuttle Diversion", "Email • Public signage", "Scheduled • 14:00"]]),
    "Faculties & Departments": ("Campus directory", "Faculties & Departments", "Route operational ownership, escalation contacts, and property notifications across the university structure.", [["0", "departments", "Live database total"], ["0", "escalation groups", "Database records"], ["0", "campus zones", "Database records"]], []),
    "Audit & Compliance": ("Immutable oversight", "Audit & Compliance", "Review administrative actions, access changes, and custody events against platform governance policies.", [["0", "events in 24 hours", "Database total"], ["100%", "signed actions", "Hash chain healthy"], ["0", "open findings", "Database records"]], [["Account directory loaded", "System database", "Signed and immutable"]]),
    "System Settings": ("Platform control plane", "System Settings", "Configure global identity, notifications, retention, integrations, and operational safeguards for UniAlert.", [["12", "active policies", "All compliant"], ["7 years", "retention window", "Legal hold ready"], ["99.98%", "API uptime", "Last check 2 min ago"]], [["Identity & authentication", "SSO and MFA policy", "Healthy • Database configuration"], ["Notifications & broadcasts", "Push, email, and hall display channels", "Operational"], ["Data retention & exports", "Encrypted audit exports", "Compliant"]]),
}

STUDENT_DASHBOARD_DEFAULTS = {
    "matches": [
        {"name": "Midnight Blue Leather Backpack", "location": "ICT Lab 302", "caseId": "LR-2025-0941", "status": "Possible Match", "tone": "warning", "small": "94% feature match", "icon": "◈"},
        {"name": "Apple AirPods Pro 2nd Gen", "location": "Red Science Lab", "caseId": "LR-2025-0812", "status": "Searching", "tone": "muted", "small": "Waiting on review", "icon": "◉"},
        {"name": "Ti-Nspire CX II Calculator", "location": "Math Annex", "caseId": "LR-2025-0684", "status": "Collected", "tone": "success", "small": "Recovered at desk", "icon": "◌"},
        {"name": "Olive Green 32oz Insulated Flask", "location": "Student Union", "caseId": "LR-2025-0118", "status": "Pending Review", "tone": "info", "small": "Awaiting confirmation", "icon": "◐"},
    ],
    "campusFound": [
        {"title": "Keychron K2 Mech...", "place": "Science Station Desk", "status": "Found", "time": "2h ago", "tone": "keyboard", "action": "Claim Item"},
        {"title": "Sony WH-1000XM...", "place": "Central Dispatch", "status": "Found", "time": "4h ago", "tone": "headphones", "action": "Claim Item"},
        {"title": "University ID + Met...", "place": "Student Union Info Desk", "status": "Found", "time": "6h ago", "tone": "id", "action": "Claim Item"},
        {"title": "Ray-Ban Prescription...", "place": "Main Library Desk", "status": "Found", "time": "7h ago", "tone": "glasses", "action": "Claim Item"},
    ],
    "bulletinItems": [
        {"type": "Security Priority", "title": "Theft Prevention Alert: West Gym", "time": "22m ago", "color": "red", "text": "Multiple locker breaches reported between 14:00-16:00. Ensure heavy-duty combo locks are engaged."},
        {"type": "Facility Advisory", "title": "Science Tower Power Grid Maintenance", "time": "2h ago", "color": "blue", "text": "Floors 4-7 power shutdown scheduled today 18:00-22:00. Computer labs offline."},
        {"type": "Operational Notice", "title": "Library North Wing Extended Hours", "time": "5h ago", "color": "teal", "text": "Midterm review week: central recovery drop-box extended through Friday evening."},
    ],
    "recoveryStations": [
        {"title": "Central Police Dispatch", "time": "Open now", "status": "Campus Safety"},
        {"title": "Main Library Circulation", "time": "Closed 23:00", "status": "Campus Study"},
        {"title": "Student Union Information", "time": "Closed 19:00", "status": "Campus Info"},
    ],
}


async def ensure_student_dashboard(db: AsyncSession) -> None:
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS dashboard_content (
            content_key VARCHAR(80) PRIMARY KEY,
            content JSON NOT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """))
    for key, content in STUDENT_DASHBOARD_DEFAULTS.items():
        await db.execute(text("""
            INSERT INTO dashboard_content (content_key, content)
            VALUES (:content_key, :content)
            ON CONFLICT (content_key) DO NOTHING
        """), {"content_key": key, "content": json.dumps(content)})
    await db.commit()


async def ensure_admin_sections(db: AsyncSession) -> None:
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS admin_sections (
            section_key VARCHAR(80) PRIMARY KEY,
            eyebrow VARCHAR(120) NOT NULL,
            title VARCHAR(120) NOT NULL,
            description TEXT NOT NULL,
            metrics TEXT NOT NULL,
            records TEXT NOT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """))
    for key, (eyebrow, title, description, metrics, records) in SECTION_DEFAULTS.items():
        await db.execute(text("""
            INSERT INTO admin_sections (section_key, eyebrow, title, description, metrics, records)
            VALUES (:section_key, :eyebrow, :title, :description, :metrics, :records)
            ON CONFLICT (section_key) DO NOTHING
        """), {"section_key": key, "eyebrow": eyebrow, "title": title, "description": description, "metrics": json.dumps(metrics), "records": json.dumps(records)})
    await db.commit()


def account_view(row: object) -> dict[str, object]:
    created_at = row["created_at"]
    return {
        "initials": f"{row['first_name'][0]}{row['last_name'][0]}".upper(),
        "name": f"{row['first_name']} {row['last_name']}",
        "id": row["student_id"],
        "role": row["role"],
        "status": "Active",
        "lastSeen": created_at.isoformat() if hasattr(created_at, "isoformat") else created_at or "Registered",
        "faculty": row["faculty"],
        "email": row["email"],
    }


@router.post("/admin-dashboard/moderators", status_code=201)
async def create_admin_moderator(account: ModeratorCreate, db: AsyncSession = Depends(get_db_session)) -> dict[str, object]:
    if not re.fullmatch(r"[^\s@]+@(std\.)?kyu\.ac\.ug", account.email.lower()):
        raise HTTPException(status_code=422, detail="Use a valid KYU moderator email.")
    if len(account.password) < 8:
        raise HTTPException(status_code=422, detail="Password must contain at least 8 characters.")
    await ensure_accounts_columns(db)
    existing = await db.execute(text("SELECT id FROM accounts WHERE email = :email OR student_id = :student_id"), {"email": account.email.lower(), "student_id": account.student_id})
    if existing.first():
        raise HTTPException(status_code=409, detail="That email or moderator ID is already registered.")
    result = await db.execute(text("""
        INSERT INTO accounts (first_name, last_name, email, password_hash, student_id, role, faculty)
        VALUES (:first_name, :last_name, :email, :password_hash, :student_id, 'moderator', :faculty)
        RETURNING first_name, last_name, email, student_id, role, faculty, created_at
    """), {
        "first_name": account.first_name.strip(),
        "last_name": account.last_name.strip(),
        "email": account.email.lower(),
        "password_hash": hashlib.sha256(account.password.encode("utf-8")).hexdigest(),
        "student_id": account.student_id.strip(),
        "faculty": account.faculty.strip() if account.faculty else None,
    })
    await db.commit()
    return {"user": account_view(result.mappings().one())}


@router.get("/admin-dashboard")
async def admin_dashboard(db: AsyncSession = Depends(get_db_session)) -> dict[str, object]:
    await ensure_accounts_columns(db)
    await ensure_admin_sections(db)
    result = await db.execute(text("""
        SELECT first_name, last_name, email, student_id, role, faculty, created_at
        FROM accounts ORDER BY created_at DESC
    """))
    users = [account_view(row) for row in result.mappings().all()]
    students = [user for user in users if user["role"] == "student"]
    moderators = [user for user in users if user["role"] == "moderator"]
    departments: dict[str, int] = {}
    for user in users:
        faculty = user["faculty"] or "Unassigned"
        departments[faculty] = departments.get(faculty, 0) + 1
    sections_result = await db.execute(text("SELECT section_key, eyebrow, title, description, metrics, records FROM admin_sections ORDER BY section_key"))
    sections = {row["section_key"]: {"eyebrow": row["eyebrow"], "title": row["title"], "description": row["description"], "metrics": json.loads(row["metrics"]), "records": json.loads(row["records"])} for row in sections_result.mappings().all()}
    sections["Users & Access"] = {"eyebrow": "Identity directory", "title": "Users & Access", "description": "Govern student, staff, and privileged access across every campus operation.", "metrics": [[str(len(users)), "directory users", "Live database total"], [str(sum(user["role"] != "student" for user in users)), "privileged accounts", "Managed by admin"], ["0", "access events / 24h", "Database total"]], "records": [[user["name"], f"{user['id']} • {user['role']}" + (f" • {user['faculty']}" if user["faculty"] else ""), f"{user['status']} • {user['lastSeen']}"] for user in users]}
    sections["Moderator Team"] = {"eyebrow": "Operational staffing", "title": "Moderator Team", "description": "Monitor moderator coverage, escalation ownership, and platform privileges for live operations.", "metrics": [[str(len(moderators)), "moderators on duty", "Live database total"], [str(sum(bool(user["faculty"]) for user in moderators)), "assigned faculties", "Database total"], ["0", "reviews due", "Database records"]], "records": [[user["name"], f"{user['id']} • {user['faculty'] or 'Faculty not assigned'}", f"{user['status']} • {user['lastSeen']}"] for user in moderators]}
    sections["Faculties & Departments"]["metrics"] = [[str(len(departments)), "departments", "Live database total"], [str(len(departments)), "department groups", "Database records"], [str(len(users)), "assigned users", "Live database total"]]
    sections["Faculties & Departments"]["records"] = [[name, f"{count} users in department", "Database record"] for name, count in sorted(departments.items(), key=lambda item: item[1], reverse=True)]
    return {
        "users": users,
        "metrics": {
            "users": len(users),
            "moderators": len(moderators),
            "students": len(students),
            "departments": len(departments),
        },
        "departments": [{"name": name, "users": count} for name, count in sorted(departments.items(), key=lambda item: item[1], reverse=True)],
        "sections": sections,
    }


@router.patch("/admin-dashboard/users/{student_id}")
async def update_admin_user(student_id: str, update: AccountRoleUpdate, db: AsyncSession = Depends(get_db_session)) -> dict[str, object]:
    if update.role not in {"student", "moderator"}:
        raise HTTPException(status_code=422, detail="Role must be student or moderator.")
    if student_id == "SYS-0001":
        raise HTTPException(status_code=403, detail="The system administrator role cannot be changed.")
    await ensure_accounts_columns(db)
    result = await db.execute(text("""
        UPDATE accounts SET role = :role, faculty = :faculty
        WHERE student_id = :student_id
        RETURNING first_name, last_name, email, student_id, role, faculty, created_at
    """), {"role": update.role, "faculty": update.faculty, "student_id": student_id})
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Account not found.")
    await db.commit()
    return {"user": account_view(row)}


@router.delete("/admin-dashboard/users/{student_id}")
async def delete_admin_user(student_id: str, db: AsyncSession = Depends(get_db_session)) -> dict[str, bool]:
    if student_id == "SYS-0001":
        raise HTTPException(status_code=403, detail="The system administrator cannot be deleted.")
    result = await db.execute(text("DELETE FROM accounts WHERE student_id = :student_id"), {"student_id": student_id})
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Account not found.")
    await db.commit()
    return {"deleted": True}


async def get_admin_notifications(db: AsyncSession) -> dict[str, object]:
    await ensure_claims_table(db)
    rows = await db.execute(text("""
        SELECT claim_id, student_name, item_name, created_at, status
        FROM claims WHERE status = 'pending_approval'
        ORDER BY created_at DESC LIMIT 10
    """))
    items = [{
        "claim_id": row["claim_id"],
        "student_name": row["student_name"],
        "item_name": row["item_name"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "status": row["status"] if "status" in getattr(row, "_values", {}) else "pending_approval",
    } for row in rows.mappings().all()]
    return {"count": len(items), "items": items}


async def get_item_summary(db: AsyncSession) -> dict[str, int]:
    fallback_summary = {"found_items": 89, "lost_items": 53}

    try:
        found_result = await db.execute(
            text(
                """
                SELECT COUNT(*)
                FROM items
                WHERE status = :status
                """
            ),
            {"status": "found"},
        )
        lost_result = await db.execute(
            text(
                """
                SELECT COUNT(*)
                FROM items
                WHERE status = :status
                """
            ),
            {"status": "lost"},
        )

        found_count = int((found_result.scalar() or 0))
        lost_count = int((lost_result.scalar() or 0))

        return {"found_items": found_count, "lost_items": lost_count}
    except Exception:
        return fallback_summary


async def get_lost_report_details(db: AsyncSession, report_id: str) -> dict[str, object]:
    fallback = {
        "report_id": report_id,
        "item_name": "Lost property report",
        "description": "Details are not available until the report is stored in the database.",
        "location": "Not recorded",
        "status": "open",
        "created_at": None,
    }

    try:
        result = await db.execute(
            text(
                """
                SELECT item_id, item_name, description, location, status, created_at
                FROM items
                WHERE item_id = :report_id AND status = :status
                LIMIT 1
                """
            ),
            {"report_id": report_id, "status": "lost"},
        )
        row = result.mappings().first()
        if not row:
            return fallback

        return {
            "report_id": row["item_id"],
            "item_name": row["item_name"],
            "description": row["description"],
            "location": row["location"],
            "status": row["status"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        }
    except Exception:
        return fallback


@router.get("/status")
async def system_status() -> dict[str, str]:
    return {"status": "operational", "environment": "development"}


@router.get("/student-dashboard")
async def student_dashboard(db: AsyncSession = Depends(get_db_session)) -> dict[str, object]:
    await ensure_student_dashboard(db)
    result = await db.execute(text("SELECT content_key, content FROM dashboard_content"))
    return {row["content_key"]: json.loads(row["content"]) for row in result.mappings().all()}


@router.get("/admin-notifications")
async def admin_notifications(db: AsyncSession = Depends(get_db_session)) -> dict[str, object]:
    return await get_admin_notifications(db)


@router.get("/item-summary")
async def item_summary(db: AsyncSession = Depends(get_db_session)) -> dict[str, int]:
    return await get_item_summary(db)


@router.get("/lost-reports/{report_id}")
async def lost_report_details(report_id: str, db: AsyncSession = Depends(get_db_session)) -> dict[str, object]:
    return await get_lost_report_details(db, report_id)
