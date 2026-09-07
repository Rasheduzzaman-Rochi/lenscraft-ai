"""Internal booking status route and service tests."""

import unittest
from datetime import UTC, datetime, timedelta, timezone
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.repositories.booking_repository import BookingRepository
from app.repositories.errors import (
    RecordNotFoundError,
    RepositoryConflictError,
    RepositoryError,
)
from app.schemas.booking import BookingStatus, UpdateBookingStatusResponse
from app.services.booking_service import (
    BookingService,
    BookingSlotConflictError,
    BookingStatusTransitionError,
)


class BookingStatusApiTests(unittest.TestCase):
    def setUp(self):
        self.company = uuid4()
        self.booking = uuid4()
        self.settings = Settings(
            _env_file=None,
            environment='testing',
            agent_company_id=self.company,
            supabase_url='https://project.example.com',
            supabase_key='server-test-key',
            admin_api_key='admin-test-key-not-real',
            retell_api_key='retell-test-key-not-real',
        )

    def send(self, status, company=None, *, admin_key='admin-test-key-not-real'):
        headers = {}
        if admin_key is not None:
            headers['X-Admin-API-Key'] = admin_key
        with TestClient(create_app(self.settings)) as client:
            return client.patch(
                f'/api/v1/bookings/{self.booking}/status',
                json={'company_id': str(company or self.company), 'status': status},
                headers=headers,
            )

    def test_missing_admin_header_is_rejected(self):
        response = self.send('confirmed', admin_key=None)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {'detail': 'Invalid admin credentials.'})

    def test_invalid_admin_key_is_rejected(self):
        response = self.send('confirmed', admin_key='wrong-key')
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {'detail': 'Invalid admin credentials.'})

    def test_unconfigured_admin_auth_fails_closed(self):
        self.settings.admin_api_key = type(self.settings.admin_api_key)('')
        response = self.send('confirmed')
        self.assertEqual(response.status_code, 503)

    def test_confirm_pending_booking(self):
        expected = UpdateBookingStatusResponse(
            booking_id=self.booking, status=BookingStatus.CONFIRMED,
            message='Booking confirmed successfully',
        )
        with patch('app.api.v1.routes.bookings.BookingService.update_status',
                   new=AsyncMock(return_value=expected)) as update:
            response = self.send('confirmed')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), expected.model_dump(mode='json'))
        update.assert_awaited_once()

    def test_reject_pending_booking(self):
        expected = UpdateBookingStatusResponse(
            booking_id=self.booking, status=BookingStatus.REJECTED,
            message='Booking rejected successfully',
        )
        with patch('app.api.v1.routes.bookings.BookingService.update_status',
                   new=AsyncMock(return_value=expected)):
            response = self.send('rejected')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'rejected')

    def test_invalid_status_is_rejected_before_service_execution(self):
        with patch('app.api.v1.routes.bookings.BookingService.update_status', new=AsyncMock()) as update:
            response = self.send('approved')
        self.assertEqual(response.status_code, 422)
        update.assert_not_awaited()

    def test_unknown_booking_returns_not_found(self):
        with patch('app.api.v1.routes.bookings.BookingService.update_status',
                   new=AsyncMock(side_effect=RecordNotFoundError('not found'))):
            response = self.send('confirmed')
        self.assertEqual(response.status_code, 404)

    def test_other_company_is_rejected_before_repository_execution(self):
        with patch('app.api.v1.routes.bookings.BookingService.update_status', new=AsyncMock()) as update:
            response = self.send('confirmed', uuid4())
        self.assertEqual(response.status_code, 403)
        update.assert_not_awaited()

    def test_repository_error_is_mapped(self):
        with patch('app.api.v1.routes.bookings.BookingService.update_status',
                   new=AsyncMock(side_effect=RepositoryError('database failed'))):
            response = self.send('confirmed')
        self.assertEqual(response.status_code, 503)

    def test_confirmed_slot_conflict_is_mapped_to_409(self):
        with patch(
            'app.api.v1.routes.bookings.BookingService.update_status',
            new=AsyncMock(side_effect=BookingSlotConflictError('private detail')),
        ):
            response = self.send('confirmed')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json(), {'detail': 'That time is already booked.'})
        self.assertNotIn('private detail', response.text)

    def test_authenticated_route_is_registered_in_production(self):
        self.settings.environment = 'production'
        expected = UpdateBookingStatusResponse(
            booking_id=self.booking, status=BookingStatus.CONFIRMED,
            message='Booking confirmed successfully',
        )
        with patch('app.api.v1.routes.bookings.BookingService.update_status',
                   new=AsyncMock(return_value=expected)):
            response = self.send('confirmed')
        self.assertEqual(response.status_code, 200)

    def test_unauthenticated_route_is_rejected_in_production(self):
        self.settings.environment = 'production'
        response = self.send('confirmed', admin_key=None)
        self.assertEqual(response.status_code, 401)

    def test_admin_key_does_not_authenticate_retell_tools(self):
        with TestClient(create_app(self.settings)) as client:
            response = client.post(
                '/api/v1/tools/search-service',
                json={'company_id': str(self.company), 'query': 'portrait'},
                headers={'X-Admin-API-Key': 'admin-test-key-not-real'},
            )
        self.assertEqual(response.status_code, 401)

    def test_admin_status_preflight_allows_patch_and_admin_header(self):
        self.settings.cors_origins = ['http://localhost:3000']
        with TestClient(create_app(self.settings)) as client:
            response = client.options(
                '/api/v1/bookings/status',
                headers={
                    'Origin': 'http://localhost:3000',
                    'Access-Control-Request-Method': 'PATCH',
                    'Access-Control-Request-Headers': 'x-admin-api-key',
                },
            )
        self.assertEqual(response.status_code, 200)
        self.assertIn('PATCH', response.headers['access-control-allow-methods'])
        self.assertIn('x-admin-api-key', response.headers['access-control-allow-headers'].lower())


class BookingStatusServiceTests(unittest.IsolatedAsyncioTestCase):
    def service(self, conflicts):
        company = uuid4()
        bookings = Mock(spec=BookingRepository)
        bookings.company_id = str(company)
        bookings.find_booking_conflicts = AsyncMock(return_value=conflicts)
        bookings.get_booking_by_id = AsyncMock()
        bookings.update_booking_status = AsyncMock()
        return BookingService(company, bookings=bookings), bookings

    async def test_pending_status_update_is_rejected(self):
        company = uuid4()
        bookings = Mock(spec=BookingRepository)
        bookings.company_id = str(company)
        bookings.update_booking_status = AsyncMock()
        service = BookingService(company, bookings=bookings)

        with self.assertRaises(BookingStatusTransitionError):
            await service.update_status(uuid4(), BookingStatus.PENDING)
        bookings.update_booking_status.assert_not_awaited()

    async def test_empty_slot_is_available(self):
        service, _ = self.service([])
        result = await service.check_availability(datetime.now(UTC))
        self.assertTrue(result.available)
        self.assertFalse(result.pending_conflict)

    async def test_confirmed_slot_is_unavailable(self):
        service, _ = self.service([{
            'id': str(uuid4()),
            'date_time': '2026-09-10T09:00:00Z',
            'status': 'confirmed',
        }])
        result = await service.check_availability(
            datetime(2026, 9, 10, 15, tzinfo=timezone(timedelta(hours=6))),
        )
        self.assertFalse(result.available)
        self.assertEqual(result.reason, 'confirmed_booking_exists')

    async def test_same_instant_with_different_offset_is_checked_as_one_slot(self):
        service, bookings = self.service([{
            'id': str(uuid4()),
            'date_time': '2026-09-10T09:00:00Z',
            'status': 'confirmed',
        }])
        requested = datetime(
            2026, 9, 10, 15, tzinfo=timezone(timedelta(hours=6)),
        )
        result = await service.check_availability(requested)
        self.assertFalse(result.available)
        checked = bookings.find_booking_conflicts.await_args.args[0]
        self.assertEqual(checked.astimezone(UTC), datetime(2026, 9, 10, 9, tzinfo=UTC))

    async def test_rejected_and_cancelled_bookings_do_not_block(self):
        for status in ('rejected', 'cancelled'):
            with self.subTest(status=status):
                service, _ = self.service([{
                    'id': str(uuid4()),
                    'date_time': '2026-09-10T09:00:00Z',
                    'status': status,
                }])
                result = await service.check_availability(datetime.now(UTC))
                self.assertTrue(result.available)
                self.assertFalse(result.pending_conflict)

    async def test_pending_booking_is_informational_and_available(self):
        service, _ = self.service([{
            'id': str(uuid4()),
            'date_time': '2026-09-10T09:00:00Z',
            'status': 'pending',
        }])
        result = await service.check_availability(datetime.now(UTC))
        self.assertTrue(result.available)
        self.assertTrue(result.pending_conflict)

    async def test_admin_cannot_confirm_over_confirmed_booking(self):
        booking_id = uuid4()
        service, bookings = self.service([{
            'id': str(uuid4()),
            'date_time': '2026-09-10T09:00:00Z',
            'status': 'confirmed',
        }])
        bookings.get_booking_by_id.return_value = {
            'id': str(booking_id),
            'date_time': '2026-09-10T09:00:00Z',
            'status': 'pending',
        }

        with self.assertRaises(BookingSlotConflictError):
            await service.update_status(booking_id, BookingStatus.CONFIRMED)
        bookings.update_booking_status.assert_not_awaited()

    async def test_unique_index_race_is_reported_as_conflict(self):
        booking_id = uuid4()
        service, bookings = self.service([])
        bookings.get_booking_by_id.return_value = {
            'id': str(booking_id),
            'date_time': '2026-09-10T09:00:00Z',
            'status': 'pending',
        }
        bookings.update_booking_status.side_effect = RepositoryConflictError(
            'unique index rejected update',
        )

        with self.assertRaises(BookingSlotConflictError):
            await service.update_status(booking_id, BookingStatus.CONFIRMED)
        bookings.update_booking_status.assert_awaited_once()


if __name__ == '__main__':
    unittest.main()
