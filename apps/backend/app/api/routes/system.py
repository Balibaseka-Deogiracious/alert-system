from datetime import datetime, timedelta, timezone
import hashlib
import json
import re
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.compat import execute_ddl
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


class AdminUserCreate(BaseModel):
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


class ItemCreate(BaseModel):
    reporter_id: str
    item_type: str
    item_name: str
    category: str | None = None
    description: str
    location: str
    image_data: str | None = None
    status: str | None = None


class ItemUpdate(BaseModel):
    item_name: str | None = None
    category: str | None = None
    description: str | None = None
    location: str | None = None
    status: str | None = None


class ClaimDecision(BaseModel):
    status: str


class FacultyCreate(BaseModel):
    name: str
    campus: str


class StationCreate(BaseModel):
    name: str
    campus: str
    lockers: int


class AlertCreate(BaseModel):
    title: str
    message: str
    audience: str


async def ensure_accounts_columns(db: AsyncSession) -> None:
    if hasattr(db, "commit"):
        await db.commit()


async def ensure_claims_table(db: AsyncSession) -> None:
    await execute_ddl(db, """
        CREATE TABLE IF NOT EXISTS claims (
            claim_id VARCHAR(32) PRIMARY KEY,
            student_id VARCHAR(32) NOT NULL,
            student_name VARCHAR(180) NOT NULL,
            item_name VARCHAR(255) NOT NULL,
            location VARCHAR(255) NOT NULL,
            status VARCHAR(40) NOT NULL DEFAULT 'pending_approval',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    if hasattr(db, "commit"):
        await db.commit()


async def ensure_dashboard_tables(db: AsyncSession) -> None:
    await execute_ddl(db, """
        CREATE TABLE IF NOT EXISTS items (
            item_id VARCHAR(32) PRIMARY KEY,
            reporter_id VARCHAR(32) NOT NULL,
            item_type VARCHAR(16) NOT NULL,
            item_name VARCHAR(255) NOT NULL,
            category VARCHAR(120),
            description TEXT NOT NULL,
            location VARCHAR(255) NOT NULL,
            status VARCHAR(40) NOT NULL,
            image_data TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    await execute_ddl(db, """
        CREATE TABLE IF NOT EXISTS audit_events (
            event_id INTEGER PRIMARY KEY AUTOINCREMENT,
            actor_id VARCHAR(32),
            action VARCHAR(120) NOT NULL,
            entity_type VARCHAR(80) NOT NULL,
            entity_id VARCHAR(80),
            details TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    await execute_ddl(db, """
        CREATE TABLE IF NOT EXISTS system_settings (
            setting_key VARCHAR(100) PRIMARY KEY,
            setting_value TEXT NOT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    await execute_ddl(db, """
        CREATE TABLE IF NOT EXISTS faculties (
            faculty_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(180) UNIQUE NOT NULL,
            campus VARCHAR(180) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    await execute_ddl(db, """
        CREATE TABLE IF NOT EXISTS recovery_stations (
            station_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(180) UNIQUE NOT NULL,
            campus VARCHAR(180) NOT NULL,
            lockers INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    await execute_ddl(db, """
        CREATE TABLE IF NOT EXISTS campus_alerts (
            alert_id INTEGER PRIMARY KEY AUTOINCREMENT,
            title VARCHAR(180) NOT NULL,
            message TEXT NOT NULL,
            audience VARCHAR(120) NOT NULL,
            status VARCHAR(40) NOT NULL DEFAULT 'Draft',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    if hasattr(db, "commit"):
        await db.commit()


def timestamp_value(value: object) -> str | None:
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


async def record_audit_event(
    db: AsyncSession,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    actor_id: str | None = None,
    details: str | None = None,
) -> None:
    await db.execute(text("""
        INSERT INTO audit_events (actor_id, action, entity_type, entity_id, details)
        VALUES (:actor_id, :action, :entity_type, :entity_id, :details)
    """), {"actor_id": actor_id, "action": action, "entity_type": entity_type, "entity_id": entity_id, "details": details})


@router.post("/claims", status_code=201)
async def create_claim(claim: ClaimCreate, db: AsyncSession = Depends(get_db_session)) -> dict[str, object]:
    await ensure_claims_table(db)
    await ensure_dashboard_tables(db)
    claim_id = f"CLM-{uuid4().hex[:10].upper()}"
    result = await db.execute(text("""
        INSERT INTO claims (claim_id, student_id, student_name, item_name, location)
        VALUES (:claim_id, :student_id, :student_name, :item_name, :location)
        RETURNING claim_id, student_id, student_name, item_name, location, status, created_at
    """), {"claim_id": claim_id, "student_id": claim.student_id, "student_name": claim.student_name, "item_name": claim.item_name, "location": claim.location})
    await record_audit_event(db, "Claim submitted", "claim", claim_id, claim.student_id)
    await db.commit()
    row = result.mappings().one()
    return {"claim": {**dict(row), "created_at": timestamp_value(row["created_at"])}}


@router.post("/items", status_code=201)
async def create_item(item: ItemCreate, db: AsyncSession = Depends(get_db_session)) -> dict[str, object]:
    if item.item_type not in {"lost", "found"}:
        raise HTTPException(status_code=422, detail="Item type must be lost or found.")
    await ensure_dashboard_tables(db)
    item_status = (item.status or item.item_type).strip().lower().replace(" ", "_")
    allowed_statuses = {item.item_type, "possible_match", "pending_review", "searching", "awaiting_review", "recovered", "returned", "in_custody"}
    if item_status not in allowed_statuses:
        raise HTTPException(status_code=422, detail="Unsupported item status.")
    item_id = f"{'LR' if item.item_type == 'lost' else 'FOUND'}-{uuid4().hex[:10].upper()}"
    result = await db.execute(text("""
        INSERT INTO items (item_id, reporter_id, item_type, item_name, category, description, location, status, image_data)
        VALUES (:item_id, :reporter_id, :item_type, :item_name, :category, :description, :location, :status, :image_data)
        RETURNING item_id, reporter_id, item_type, item_name, category, description, location, status, created_at
    """), {
        "item_id": item_id,
        "reporter_id": item.reporter_id.strip(),
        "item_type": item.item_type,
        "item_name": item.item_name.strip(),
        "category": item.category.strip() if item.category else None,
        "description": item.description.strip(),
        "location": item.location.strip(),
        "status": item_status,
        "image_data": item.image_data,
    })
    await record_audit_event(db, f"{item.item_type.title()} item reported", "item", item_id, item.reporter_id)
    await db.commit()
    row = dict(result.mappings().one())
    row["created_at"] = timestamp_value(row["created_at"])
    row.pop("image_data", None)
    return {"item": row}


@router.patch("/items/{item_id}")
async def update_item(item_id: str, update: ItemUpdate, db: AsyncSession = Depends(get_db_session)) -> dict[str, object]:
    changes = update.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Provide at least one item field to update.")
    allowed_statuses = {"lost", "found", "possible_match", "searching", "awaiting_review", "recovered", "returned", "in_custody"}
    if "status" in changes and changes["status"] not in allowed_statuses:
        raise HTTPException(status_code=422, detail="Unsupported item status.")
    await ensure_dashboard_tables(db)
    assignments = ", ".join(f"{column} = :{column}" for column in changes)
    changes["item_id"] = item_id
    result = await db.execute(text(f"""
        UPDATE items SET {assignments}
        WHERE item_id = :item_id
        RETURNING item_id, reporter_id, item_type, item_name, category, description, location, status, created_at
    """), changes)
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Item not found.")
    await record_audit_event(db, "Item updated", "item", item_id)
    await db.commit()
    return {"item": {**dict(row), "created_at": timestamp_value(row["created_at"])} }


@router.patch("/claims/{claim_id}")
async def update_claim(claim_id: str, decision: ClaimDecision, db: AsyncSession = Depends(get_db_session)) -> dict[str, object]:
    allowed_statuses = {"pending_approval", "approved", "rejected", "returned", "collected", "completed"}
    status_value = decision.status.lower()
    if status_value not in allowed_statuses:
        raise HTTPException(status_code=422, detail="Unsupported claim status.")
    await ensure_claims_table(db)
    result = await db.execute(text("""
        UPDATE claims SET status = :status
        WHERE claim_id = :claim_id
        RETURNING claim_id, student_id, student_name, item_name, location, status, created_at
    """), {"claim_id": claim_id, "status": status_value})
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Claim not found.")
    await ensure_dashboard_tables(db)
    await record_audit_event(db, "Claim status changed", "claim", claim_id, row["student_id"], status_value)
    await db.commit()
    return {"claim": {**dict(row), "created_at": timestamp_value(row["created_at"])} }


@router.get("/student-dashboard")
async def student_dashboard(student_id: str, db: AsyncSession = Depends(get_db_session)) -> dict[str, object]:
    await ensure_dashboard_tables(db)
    await ensure_claims_table(db)
    lost_rows = (await db.execute(text("""
        SELECT item_id, item_name, category, description, location, status, created_at
        FROM items WHERE item_type = 'lost' AND reporter_id = :student_id
        ORDER BY created_at DESC LIMIT 20
    """), {"student_id": student_id})).mappings().all()
    found_rows = (await db.execute(text("""
        SELECT item_id, item_name, category, location, status, created_at
        FROM items WHERE item_type = 'found' ORDER BY created_at DESC LIMIT 20
    """))).mappings().all()
    alert_rows = (await db.execute(text("""
        SELECT alert_id, title, message, audience, status, created_at
        FROM campus_alerts WHERE lower(status) IN ('active', 'live', 'published', 'advisory')
        ORDER BY created_at DESC LIMIT 20
    """))).mappings().all()
    station_rows = (await db.execute(text("""
        SELECT station_id, name, campus, lockers, created_at
        FROM recovery_stations ORDER BY name LIMIT 20
    """))).mappings().all()
    found_item_count = (await db.execute(text("SELECT COUNT(*) FROM items WHERE item_type = 'found'"))).scalar_one()
    claim_rows = (await db.execute(text("""
        SELECT claim_id, item_name, location, status, created_at
        FROM claims WHERE student_id = :student_id ORDER BY created_at DESC LIMIT 20
    """), {"student_id": student_id})).mappings().all()
    lost_report_count = (await db.execute(text("SELECT COUNT(*) FROM items WHERE item_type = 'lost' AND reporter_id = :student_id"), {"student_id": student_id})).scalar_one()
    safe_transfer_count = (await db.execute(text("""
        SELECT COUNT(*) FROM claims WHERE student_id = :student_id AND lower(status) IN ('collected', 'returned', 'completed', 'transferred')
    """), {"student_id": student_id})).scalar_one()
    pending_claim_count = (await db.execute(text("SELECT COUNT(*) FROM claims WHERE student_id = :student_id AND lower(status) = 'pending_approval'"), {"student_id": student_id})).scalar_one()
    live_bulletin_count = (await db.execute(text("SELECT COUNT(*) FROM campus_alerts WHERE lower(status) IN ('active', 'live', 'published', 'advisory')"))).scalar_one()
    found_item_count = (await db.execute(text("SELECT COUNT(*) FROM items WHERE item_type = 'found'"))).scalar_one()

    return {
        "metrics": {
            "lost_reports": int(lost_report_count),
            "safe_transfers": int(safe_transfer_count),
            "live_bulletins": int(live_bulletin_count),
            "pending_claims": int(pending_claim_count),
            "found_items": int(found_item_count),
        },
        "matches": [{
            "name": row["item_name"],
            "location": row["location"],
            "caseId": row["item_id"],
            "status": row["status"],
            "tone": "warning" if row["status"] in {"possible_match", "pending_review"} else "muted",
            "small": row["category"] or "Awaiting matching review",
            "icon": "◈",
            "time": timestamp_value(row["created_at"]),
        } for row in lost_rows],
        "campusFound": [{
            "id": row["item_id"],
            "title": row["item_name"],
            "place": row["location"],
            "category": row["category"] or "Uncategorized",
            "status": "Found",
            "time": timestamp_value(row["created_at"]),
            "tone": "id",
            "action": "Claim Item",
        } for row in found_rows],
        "bulletinItems": [{
            "type": row["audience"],
            "title": row["title"],
            "time": timestamp_value(row["created_at"]),
            "color": "blue",
            "text": row["message"],
        } for row in alert_rows],
        "recoveryStations": [{
            "title": row["name"],
            "time": f"{row['lockers']} lockers",
            "status": row["campus"],
        } for row in station_rows],
        "claims": [{
            "id": row["claim_id"],
            "itemName": row["item_name"],
            "location": row["location"],
            "status": row["status"],
            "createdAt": timestamp_value(row["created_at"]),
        } for row in claim_rows],
    }


SECTION_DEFAULTS = {
    "Recovery Stations": ("Custody network", "Recovery Stations", "Oversee station availability, locker capacity, and custody handoffs across the campus network.", [["9", "registered stations", "8 currently open"], ["62%", "locker capacity", "24h SLA target"], ["31", "items in custody", "0 overdue handoffs"]], [["Central Police Dispatch", "18 lockers • Campus-wide", "Open • 84% capacity"], ["Library Main Service Desk", "9 lockers • North Campus", "Open • 46% capacity"], ["Student Union Information", "6 lockers • Central Campus", "Open • 33% capacity"]]),
    "Campus Broadcasts": ("Emergency communications", "Campus Broadcasts", "Control approved advisories and verify delivery across student, staff, and public display channels.", [["2", "live broadcasts", "12,410 recipients"], ["99.1%", "delivery rate", "All channels healthy"], ["3", "approval drafts", "2 require review"]], [["Science Quadrangle Access Restriction", "Push • Email • Hall displays", "Live • 12,410 delivered"], ["West Gym Theft Prevention Alert", "Push • Student mobile", "Advisory • 8,220 delivered"], ["Blue Line Shuttle Diversion", "Email • Public signage", "Scheduled • 14:00"]]),
    "Faculties & Departments": ("Campus directory", "Faculties & Departments", "Route operational ownership, escalation contacts, and property notifications across the university structure.", [["0", "departments", "Live database total"], ["0", "escalation groups", "Database records"], ["0", "campus zones", "Database records"]], []),
    "Audit & Compliance": ("Immutable oversight", "Audit & Compliance", "Review administrative actions, access changes, and custody events against platform governance policies.", [["0", "events in 24 hours", "Database total"], ["100%", "signed actions", "Hash chain healthy"], ["0", "open findings", "Database records"]], [["Account directory loaded", "System database", "Signed and immutable"]]),
    "System Settings": ("Platform control plane", "System Settings", "Configure global identity, notifications, retention, integrations, and operational safeguards for UniAlert.", [["12", "active policies", "All compliant"], ["7 years", "retention window", "Legal hold ready"], ["99.98%", "API uptime", "Last check 2 min ago"]], [["Identity & authentication", "SSO and MFA policy", "Healthy • Database configuration"], ["Notifications & broadcasts", "Push, email, and hall display channels", "Operational"], ["Data retention & exports", "Encrypted audit exports", "Compliant"]]),
}
def account_view(row: object) -> dict[str, object]:
    created_at = row["created_at"]
    first_name = (row["first_name"] or "").strip()
    last_name = (row["last_name"] or "").strip()
    display_name = " ".join(name for name in (first_name, last_name) if name) or "Unknown user"
    initials = f"{first_name[:1]}{last_name[:1]}".upper() or "?"
    return {
        "initials": initials,
        "name": display_name,
        "id": row["student_id"],
        "role": row["role"],
        "status": "Registered",
        "lastSeen": timestamp_value(created_at) or "Not recorded",
        "faculty": row["faculty"],
        "email": row["email"],
    }


async def dashboard_snapshot(db: AsyncSession) -> dict[str, object]:
    await ensure_dashboard_tables(db)
    await ensure_claims_table(db)
    users_result = await db.execute(text("""
        SELECT first_name, last_name, email, student_id, role, faculty, created_at
        FROM accounts ORDER BY created_at DESC
    """))
    users = [account_view(row) for row in users_result.mappings().all()]
    items_result = await db.execute(text("""
        SELECT item_id, reporter_id, item_type, item_name, category, description, location, status, created_at
        FROM items ORDER BY created_at DESC LIMIT 200
    """))
    items = [{**dict(row), "created_at": timestamp_value(row["created_at"])} for row in items_result.mappings().all()]
    claims_result = await db.execute(text("""
        SELECT claim_id, student_id, student_name, item_name, location, status, created_at
        FROM claims ORDER BY created_at DESC LIMIT 200
    """))
    claims = [{**dict(row), "created_at": timestamp_value(row["created_at"])} for row in claims_result.mappings().all()]
    alerts_result = await db.execute(text("""
        SELECT alert_id, title, message, audience, status, created_at
        FROM campus_alerts ORDER BY created_at DESC LIMIT 200
    """))
    alerts = [{**dict(row), "created_at": timestamp_value(row["created_at"])} for row in alerts_result.mappings().all()]
    stations_result = await db.execute(text("""
        SELECT station_id, name, campus, lockers, created_at
        FROM recovery_stations ORDER BY name
    """))
    stations = [{**dict(row), "created_at": timestamp_value(row["created_at"])} for row in stations_result.mappings().all()]
    faculties_result = await db.execute(text("""
        SELECT faculty_id, name, campus, created_at
        FROM faculties ORDER BY name
    """))
    faculties = [{**dict(row), "created_at": timestamp_value(row["created_at"])} for row in faculties_result.mappings().all()]
    audit_result = await db.execute(text("""
        SELECT event_id, actor_id, action, entity_type, entity_id, details, created_at
        FROM audit_events ORDER BY created_at DESC LIMIT 100
    """))
    audit_events = [{**dict(row), "created_at": timestamp_value(row["created_at"])} for row in audit_result.mappings().all()]

    role_counts: dict[str, int] = {}
    for user in users:
        role_counts[user["role"]] = role_counts.get(user["role"], 0) + 1
    students = role_counts.get("student", 0)
    moderators = role_counts.get("moderator", 0)
    system_admins = role_counts.get("system_admin", 0)
    assigned_faculties: dict[str, int] = {}
    for user in users:
        faculty = user.get("faculty")
        if faculty:
            assigned_faculties[faculty] = assigned_faculties.get(faculty, 0) + 1

    lost_items = [item for item in items if item["item_type"] == "lost"]
    found_items = [item for item in items if item["item_type"] == "found"]
    pending_claims = [claim for claim in claims if claim["status"].lower() == "pending_approval"]
    active_alerts = [alert for alert in alerts if alert["status"].lower() in {"active", "live", "published", "advisory"}]
    draft_alerts = [alert for alert in alerts if alert["status"].lower() == "draft"]
    item_type_counts = {row[0]: int(row[1]) for row in (await db.execute(text("SELECT item_type, COUNT(*) FROM items GROUP BY item_type"))).all()}
    claim_status_counts = {row[0]: int(row[1]) for row in (await db.execute(text("SELECT lower(status), COUNT(*) FROM claims GROUP BY lower(status)"))).all()}
    alert_status_counts = {row[0]: int(row[1]) for row in (await db.execute(text("SELECT lower(status), COUNT(*) FROM campus_alerts GROUP BY lower(status)"))).all()}
    total_claim_count = sum(claim_status_counts.values())
    total_alert_count = sum(alert_status_counts.values())
    active_alert_count = sum(alert_status_counts.get(status, 0) for status in ("active", "live", "published", "advisory"))
    recent_audit_count = (await db.execute(text("""
        SELECT COUNT(*) FROM audit_events WHERE created_at >= :cutoff
    """), {"cutoff": datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1)})).scalar_one()
    total_lockers = sum(int(station["lockers"] or 0) for station in stations)
    custody_items = sum(item["status"].lower() in {"custody", "in_custody"} for item in items)
    settings_count = (await db.execute(text("SELECT COUNT(*) FROM system_settings"))).scalar_one()

    user_records = [[user["name"], f"{user['id']} • {user['role']}" + (f" • {user['faculty']}" if user["faculty"] else ""), f"{user['status']} • {user['lastSeen']}"] for user in users]
    moderator_records = [[user["name"], f"{user['id']} • {user['faculty'] or 'Faculty not assigned'}", user["status"]] for user in users if user["role"] == "moderator"]
    sections = {
        "Users & Access": {
            "eyebrow": "Identity directory", "title": "Users & Access", "description": "Accounts and privileges recorded in the database.",
            "metrics": [[str(len(users)), "directory users", "Live database total"], [str(moderators + system_admins), "privileged accounts", "Live database total"], [str(recent_audit_count), "audit events / 24h", "Database total"]],
            "records": user_records,
        },
        "Moderator Team": {
            "eyebrow": "Operational staffing", "title": "Moderator Team", "description": "Moderator accounts currently stored in the database.",
            "metrics": [[str(moderators), "moderator accounts", "Live database total"], [str(sum(bool(user["faculty"]) for user in users if user["role"] == "moderator")), "assigned faculties", "Live database total"], [str(len(pending_claims)), "pending claims", "Live database total"]],
            "records": moderator_records,
        },
        "Recovery Stations": {
            "eyebrow": "Custody network", "title": "Recovery Stations", "description": "Stations and locker capacity recorded in the database.",
            "metrics": [[str(len(stations)), "registered stations", "Live database total"], [str(total_lockers), "registered lockers", "Live database total"], [str(custody_items), "items in custody", "Live database total"]],
            "records": [[station["name"], f"{station['campus']} • {station['lockers']} lockers", "Registered"] for station in stations],
        },
        "Campus Broadcasts": {
            "eyebrow": "Emergency communications", "title": "Campus Broadcasts", "description": "Alerts currently recorded in the database.",
            "metrics": [[str(active_alert_count), "active alerts", "Live database total"], [str(total_alert_count), "total alerts", "Live database total"], [str(alert_status_counts.get("draft", 0)), "draft alerts", "Live database total"]],
            "records": [[alert["title"], alert["audience"], alert["status"]] for alert in alerts],
        },
        "Faculties & Departments": {
            "eyebrow": "Campus directory", "title": "Faculties & Departments", "description": "Faculties and account assignments stored in the database.",
            "metrics": [[str(len(faculties)), "registered faculties", "Live database total"], [str(len(assigned_faculties)), "faculties with accounts", "Live database total"], [str(sum(assigned_faculties.values())), "assigned accounts", "Live database total"]],
            "records": [[faculty["name"], faculty["campus"], f"{assigned_faculties.get(faculty['name'], 0)} assigned accounts"] for faculty in faculties],
        },
        "Audit & Compliance": {
            "eyebrow": "Audit records", "title": "Audit & Compliance", "description": "Administrative events recorded in the database.",
            "metrics": [[str(recent_audit_count), "events in 24 hours", "Live database total"], [str(len(audit_events)), "recent audit records", "Live database total"], ["0", "signed events", "No signature data stored"]],
            "records": [[event["action"], f"{event['entity_type']} • {event['entity_id'] or 'No ID'}", timestamp_value(event["created_at"]) or ""] for event in audit_events],
        },
        "System Settings": {
            "eyebrow": "Platform configuration", "title": "System Settings", "description": "Only settings persisted in the database are listed here.",
            "metrics": [[str(settings_count), "stored settings", "Live database total"], ["0", "integration records", "No integration table"], ["0", "retention policies", "No policy records"]],
            "records": [],
        },
    }
    return {
        "users": users,
        "metrics": {
            "users": len(users), "moderators": moderators, "students": students,
            "system_admins": system_admins, "departments": len(assigned_faculties),
            "lost_items": item_type_counts.get("lost", 0), "found_items": item_type_counts.get("found", 0),
            "pending_claims": claim_status_counts.get("pending_approval", 0), "claims": total_claim_count,
            "active_alerts": active_alert_count, "alerts": total_alert_count,
            "stations": len(stations), "faculties": len(faculties),
            "audit_events_24h": int(recent_audit_count), "roles": len(role_counts),
        },
        "role_counts": role_counts,
        "departments": [{"name": name, "users": count} for name, count in sorted(assigned_faculties.items())],
        "sections": sections,
        "items": items,
        "claims": claims,
        "alerts": alerts,
        "stations": stations,
        "faculties": faculties,
        "audit_events": audit_events,
    }


@router.post("/admin-dashboard/moderators", status_code=201)
async def create_admin_moderator(account: ModeratorCreate, db: AsyncSession = Depends(get_db_session)) -> dict[str, object]:
    if not re.fullmatch(r"[^\s@]+@(std\.)?kyu\.ac\.ug", account.email.lower()):
        raise HTTPException(status_code=422, detail="Use a valid KYU moderator email.")
    if len(account.password) < 8:
        raise HTTPException(status_code=422, detail="Password must contain at least 8 characters.")
    await ensure_dashboard_tables(db)
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
    await record_audit_event(db, "Moderator account created", "account", account.student_id)
    await db.commit()
    return {"user": account_view(result.mappings().one())}


@router.post("/admin-dashboard/users", status_code=201)
async def create_admin_user(account: AdminUserCreate, db: AsyncSession = Depends(get_db_session)) -> dict[str, object]:
    if not re.fullmatch(r"[^\s@]+@(std\.)?kyu\.ac\.ug", account.email.lower()):
        raise HTTPException(status_code=422, detail="Use a valid KYU user email.")
    if len(account.password) < 8 or not account.student_id.strip():
        raise HTTPException(status_code=422, detail="A password with at least 8 characters and a user ID are required.")
    await ensure_dashboard_tables(db)
    existing = await db.execute(text("SELECT id FROM accounts WHERE email = :email OR student_id = :student_id"), {"email": account.email.lower(), "student_id": account.student_id.strip()})
    if existing.first():
        raise HTTPException(status_code=409, detail="That email or user ID is already registered.")
    result = await db.execute(text("""
        INSERT INTO accounts (first_name, last_name, email, password_hash, student_id, role, faculty)
        VALUES (:first_name, :last_name, :email, :password_hash, :student_id, 'student', :faculty)
        RETURNING first_name, last_name, email, student_id, role, faculty, created_at
    """), {
        "first_name": account.first_name.strip(), "last_name": account.last_name.strip(),
        "email": account.email.lower(), "password_hash": hashlib.sha256(account.password.encode("utf-8")).hexdigest(),
        "student_id": account.student_id.strip(), "faculty": account.faculty.strip() if account.faculty else None,
    })
    await record_audit_event(db, "Student account created", "account", account.student_id.strip())
    await db.commit()
    return {"user": account_view(result.mappings().one())}


@router.post("/admin-dashboard/faculties", status_code=201)
async def create_admin_faculty(faculty: FacultyCreate, db: AsyncSession = Depends(get_db_session)) -> dict[str, object]:
    name = faculty.name.strip()
    campus = faculty.campus.strip()
    if not name or not campus:
        raise HTTPException(status_code=422, detail="Faculty name and campus are required.")
    await ensure_dashboard_tables(db)
    existing = await db.execute(text("SELECT faculty_id FROM faculties WHERE lower(name) = lower(:name)"), {"name": name})
    if existing.first():
        raise HTTPException(status_code=409, detail="That faculty already exists.")
    result = await db.execute(text("""
        INSERT INTO faculties (name, campus) VALUES (:name, :campus)
        RETURNING faculty_id, name, campus, created_at
    """), {"name": name, "campus": campus})
    row = result.mappings().one()
    await record_audit_event(db, "Faculty created", "faculty", str(row["faculty_id"]))
    await db.commit()
    return {"faculty": {"id": row["faculty_id"], "name": row["name"], "campus": row["campus"]}}


@router.post("/admin-dashboard/stations", status_code=201)
async def create_admin_station(station: StationCreate, db: AsyncSession = Depends(get_db_session)) -> dict[str, object]:
    name = station.name.strip()
    campus = station.campus.strip()
    if not name or not campus or station.lockers < 0:
        raise HTTPException(status_code=422, detail="Station name, campus, and non-negative locker capacity are required.")
    await ensure_dashboard_tables(db)
    existing = await db.execute(text("SELECT station_id FROM recovery_stations WHERE lower(name) = lower(:name)"), {"name": name})
    if existing.first():
        raise HTTPException(status_code=409, detail="That recovery station already exists.")
    result = await db.execute(text("""
        INSERT INTO recovery_stations (name, campus, lockers) VALUES (:name, :campus, :lockers)
        RETURNING station_id, name, campus, lockers
    """), {"name": name, "campus": campus, "lockers": station.lockers})
    row = result.mappings().one()
    await record_audit_event(db, "Recovery station created", "station", str(row["station_id"]))
    await db.commit()
    return {"station": {"id": row["station_id"], "name": row["name"], "campus": row["campus"], "lockers": row["lockers"]}}


@router.post("/admin-dashboard/alerts", status_code=201)
async def create_admin_alert(alert: AlertCreate, db: AsyncSession = Depends(get_db_session)) -> dict[str, object]:
    if not alert.title.strip() or not alert.message.strip() or not alert.audience.strip():
        raise HTTPException(status_code=422, detail="Alert title, message, and audience are required.")
    await ensure_dashboard_tables(db)
    result = await db.execute(text("""
        INSERT INTO campus_alerts (title, message, audience, status)
        VALUES (:title, :message, :audience, 'Draft')
        RETURNING alert_id, title, message, audience, status
    """), {"title": alert.title.strip(), "message": alert.message.strip(), "audience": alert.audience.strip()})
    row = result.mappings().one()
    await record_audit_event(db, "Campus alert drafted", "alert", str(row["alert_id"]))
    await db.commit()
    return {"alert": {"id": row["alert_id"], "title": row["title"], "message": row["message"], "audience": row["audience"], "status": row["status"]}}


@router.get("/admin-dashboard")
async def admin_dashboard(db: AsyncSession = Depends(get_db_session)) -> dict[str, object]:
    return await dashboard_snapshot(db)


@router.get("/moderator-dashboard")
async def moderator_dashboard(db: AsyncSession = Depends(get_db_session)) -> dict[str, object]:
    return await dashboard_snapshot(db)


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
        "created_at": timestamp_value(row["created_at"]),
        "status": row["status"] if "status" in getattr(row, "_values", {}) else "pending_approval",
    } for row in rows.mappings().all()]
    return {"count": len(items), "items": items}


async def get_item_summary(db: AsyncSession) -> dict[str, int]:
    await ensure_dashboard_tables(db)
    found_count = (await db.execute(text("SELECT COUNT(*) FROM items WHERE item_type = 'found'"))).scalar() or 0
    lost_count = (await db.execute(text("SELECT COUNT(*) FROM items WHERE item_type = 'lost'"))).scalar() or 0
    return {"found_items": int(found_count), "lost_items": int(lost_count)}


async def get_lost_report_details(db: AsyncSession, report_id: str) -> dict[str, object]:
    await ensure_dashboard_tables(db)
    result = await db.execute(text("""
        SELECT item_id, item_name, category, description, location, status, created_at
        FROM items WHERE item_id = :report_id AND item_type = 'lost' LIMIT 1
    """), {"report_id": report_id})
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Lost report not found.")
    return {
        "report_id": row["item_id"],
        "item_name": row["item_name"],
        "category": row.get("category") if hasattr(row, "get") else None,
        "description": row["description"],
        "location": row["location"],
        "status": row["status"],
        "created_at": timestamp_value(row["created_at"]),
    }


@router.get("/status")
async def system_status() -> dict[str, str]:
    return {"status": "operational", "environment": "development"}


@router.get("/admin-notifications")
async def admin_notifications(db: AsyncSession = Depends(get_db_session)) -> dict[str, object]:
    return await get_admin_notifications(db)


@router.get("/item-summary")
async def item_summary(db: AsyncSession = Depends(get_db_session)) -> dict[str, int]:
    return await get_item_summary(db)


@router.get("/lost-reports/{report_id}")
async def lost_report_details(report_id: str, db: AsyncSession = Depends(get_db_session)) -> dict[str, object]:
    return await get_lost_report_details(db, report_id)
