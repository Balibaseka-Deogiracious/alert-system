import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace

from app.api.routes.system import get_admin_notifications, get_item_summary, get_lost_report_details


class FakeRow:
    def __init__(self, **kwargs):
        self._values = kwargs

    def __getitem__(self, key):
        return self._values[key]


class FakeRows:
    def __init__(self, items):
        self._items = items

    def mappings(self):
        return self

    def all(self):
        return self._items

    def first(self):
        return self._items[0] if self._items else None

    def scalar(self):
        if not self._items:
            return None
        return self._items[0]


class FakeSession:
    async def execute(self, *_args, **_kwargs):
        row = FakeRow(
            claim_id="CLM-1001",
            student_name="Amina Said",
            item_name="Laptop",
            created_at=datetime.now(timezone.utc),
        )
        return FakeRows([row])


def test_get_admin_notifications_returns_pending_claims():
    result = asyncio.run(get_admin_notifications(db=FakeSession()))

    assert result["count"] == 1
    assert result["items"][0]["claim_id"] == "CLM-1001"
    assert result["items"][0]["student_name"] == "Amina Said"


def test_get_item_summary_returns_found_and_lost_counts():
    class ItemSummarySession:
        async def execute(self, *_args, **_kwargs):
            return FakeRows([12])

    result = asyncio.run(get_item_summary(db=ItemSummarySession()))

    assert result["found_items"] == 12
    assert result["lost_items"] == 12


def test_get_lost_report_details_returns_database_record():
    class LostReportSession:
        async def execute(self, *_args, **_kwargs):
            return FakeRows([
                FakeRow(
                    item_id="LR-2025-0941",
                    item_name="Midnight Blue Leather Backpack",
                    description="Laptop compartment and silver keychain",
                    location="West Gym",
                    status="lost",
                    created_at=datetime(2025, 9, 1, tzinfo=timezone.utc),
                )
            ])

    result = asyncio.run(get_lost_report_details(LostReportSession(), "LR-2025-0941"))

    assert result["report_id"] == "LR-2025-0941"
    assert result["location"] == "West Gym"
