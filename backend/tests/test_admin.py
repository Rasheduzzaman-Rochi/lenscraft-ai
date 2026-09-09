"""Authenticated administration read API tests."""

import unittest
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.repositories.errors import RecordNotFoundError
from app.schemas.admin import (
    AdminBooking,
    AdminBookingList,
    AdminBookingStats,
    AdminDashboard,
    AdminDeleteResponse,
    AdminLead,
)
from app.schemas.booking import BookingStatus


class AdminReadApiTests(unittest.TestCase):
    def setUp(self):
        self.company = uuid4()
        self.settings = Settings(
            _env_file=None,
            environment="testing",
            agent_company_id=self.company,
            supabase_url="https://project.example.com",
            supabase_key="server-test-key",
            admin_api_key="admin-test-key-not-real",
        )

    def client(self) -> TestClient:
        return TestClient(create_app(self.settings))

    def test_dashboard_requires_existing_admin_authentication(self):
        with self.client() as client:
            response = client.get("/api/v1/admin/dashboard")
        self.assertEqual(response.status_code, 401)

    def test_dashboard_returns_bounded_operational_summary(self):
        expected = AdminDashboard(
            bookings=AdminBookingStats(total=7, pending=3, confirmed=2),
            recent_leads=[AdminLead(
                id=uuid4(),
                customer_name="Studio Customer",
                email="customer@example.com",
                status="new",
                intent="Fashion campaign",
                created_at=datetime.now(UTC),
            )],
        )
        with patch(
            "app.api.v1.routes.admin.AdminService.dashboard",
            new=AsyncMock(return_value=expected),
        ) as method, self.client() as client:
            response = client.get(
                "/api/v1/admin/dashboard",
                headers={"X-Admin-API-Key": "admin-test-key-not-real"},
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["bookings"]["pending"], 3)
        self.assertEqual(response.headers["cache-control"], "no-store")
        method.assert_awaited_once()

    def test_booking_list_validates_filter_and_keeps_response_contract(self):
        booking_id = uuid4()
        expected = AdminBookingList(
            items=[AdminBooking(
                id=booking_id,
                customer_name="Studio Customer",
                email="customer@example.com",
                phone="+8801700000000",
                service="Fashion Photography",
                date_time=datetime.now(UTC),
                status=BookingStatus.PENDING,
                notes="Campaign request",
                created_at=datetime.now(UTC),
            )],
            total=1,
            limit=25,
            offset=0,
        )
        with patch(
            "app.api.v1.routes.admin.AdminService.list_bookings",
            new=AsyncMock(return_value=expected),
        ) as method, self.client() as client:
            response = client.get(
                "/api/v1/admin/bookings?limit=25&status=pending",
                headers={"X-Admin-API-Key": "admin-test-key-not-real"},
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["items"][0]["id"], str(booking_id))
        method.assert_awaited_once_with(
            limit=25,
            offset=0,
            status=BookingStatus.PENDING,
        )

        with self.client() as client:
            invalid = client.get(
                "/api/v1/admin/bookings?status=unknown",
                headers={"X-Admin-API-Key": "admin-test-key-not-real"},
            )
        self.assertEqual(invalid.status_code, 422)

    def test_booking_detail_and_lead_routes_require_admin_key_and_return_data(self):
        booking = AdminBooking(
            id=uuid4(), customer_name="Customer", service="Portrait",
            date_time=datetime.now(UTC), status=BookingStatus.PENDING,
            created_at=datetime.now(UTC),
        )
        lead = AdminLead(
            id=uuid4(), customer_name="Lead", status="new",
            created_at=datetime.now(UTC),
        )
        with patch("app.api.v1.routes.admin.AdminService.get_booking", new=AsyncMock(return_value=booking)):
            with self.client() as client:
                response = client.get(
                    f"/api/v1/admin/bookings/{booking.id}",
                    headers={"X-Admin-API-Key": "admin-test-key-not-real"},
                )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], str(booking.id))

        with patch("app.api.v1.routes.admin.AdminService.list_leads", new=AsyncMock(return_value={
            "items": [lead], "total": 1, "limit": 50, "offset": 0,
        })) as method:
            with self.client() as client:
                response = client.get(
                    "/api/v1/admin/leads",
                    headers={"X-Admin-API-Key": "admin-test-key-not-real"},
                )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["items"][0]["id"], str(lead.id))
        method.assert_awaited_once_with(limit=50, offset=0)

    def test_admin_can_delete_company_booking_and_lead(self):
        for resource, method_name in (("bookings", "delete_booking"), ("leads", "delete_lead")):
            record_id = uuid4()
            expected = AdminDeleteResponse(id=record_id)
            with self.subTest(resource=resource), patch(
                f"app.api.v1.routes.admin.AdminService.{method_name}",
                new=AsyncMock(return_value=expected),
            ) as method, self.client() as client:
                response = client.delete(
                    f"/api/v1/admin/{resource}/{record_id}",
                    headers={"X-Admin-API-Key": "admin-test-key-not-real"},
                )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), {"id": str(record_id), "deleted": True})
            self.assertEqual(response.headers["cache-control"], "no-store")
            method.assert_awaited_once_with(record_id)

    def test_admin_delete_requires_authentication_and_maps_not_found(self):
        record_id = uuid4()
        with self.client() as client:
            unauthenticated = client.delete(f"/api/v1/admin/bookings/{record_id}")
        self.assertEqual(unauthenticated.status_code, 401)

        with patch(
            "app.api.v1.routes.admin.AdminService.delete_lead",
            new=AsyncMock(side_effect=RecordNotFoundError("not found")),
        ), self.client() as client:
            missing = client.delete(
                f"/api/v1/admin/leads/{record_id}",
                headers={"X-Admin-API-Key": "admin-test-key-not-real"},
            )
        self.assertEqual(missing.status_code, 404)
        self.assertEqual(missing.json(), {"detail": "Lead not found."})


if __name__ == "__main__":
    unittest.main()
