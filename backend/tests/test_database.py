"""Exercise Supabase request semantics and failures without real credentials."""

import os
import unittest
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient
from pydantic import ValidationError
from supabase import ClientOptions, create_client

from app.core.config import Settings
from app.database import supabase as database
from app.main import create_app


class DatabaseTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, {}, clear=True)
        env.start()
        self.addCleanup(env.stop)
        database.close_supabase_client()
        self.addCleanup(database.close_supabase_client)
        self.settings = Settings(
            _env_file=None, supabase_url='https://project.example.com',
            supabase_key='test-secret-not-a-real-key', environment='testing',
        )

    def request_with_transport(self, handler):
        with httpx.Client(transport=httpx.MockTransport(handler)) as transport:
            client = create_client(
                str(self.settings.supabase_url),
                self.settings.supabase_key.get_secret_value(),
                options=ClientOptions(
                    httpx_client=transport, auto_refresh_token=False, persist_session=False,
                ),
            )
            with patch('app.api.v1.routes.database.get_supabase_client', return_value=client):
                with TestClient(create_app(self.settings)) as api:
                    return api.get('/api/v1/test/database')

    def test_count_uses_head_and_exact_count_without_row_download(self):
        for count in (0, 2501):
            with self.subTest(count=count):
                def handler(request):
                    self.assertEqual(request.method, 'HEAD')
                    self.assertEqual(request.url.path, '/rest/v1/companies')
                    self.assertEqual(request.url.params['select'], 'id')
                    self.assertIn('count=exact', request.headers['prefer'])
                    return httpx.Response(200, headers={'Content-Range': f'*/{count}'})
                response = self.request_with_transport(handler)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), {'database': 'connected', 'companies_count': count})
                self.assertEqual(response.headers['cache-control'], 'no-store')

    def test_missing_config_returns_503_without_breaking_health(self):
        with TestClient(create_app(Settings(_env_file=None))) as api:
            self.assertEqual(api.get('/api/v1/health').status_code, 200)
            self.assertEqual(api.get('/api/v1/test/database').status_code, 503)

    def test_provider_failures_are_sanitized(self):
        for status in (401, 403, 404, 500):
            with self.subTest(status=status):
                response = self.request_with_transport(lambda request: httpx.Response(
                    status, json={'message': 'test-secret-not-a-real-key', 'code': '42501'},
                ))
                self.assertEqual(response.status_code, 503)
                self.assertNotIn('test-secret', response.text)

    def test_timeout_is_sanitized_in_response_and_logs(self):
        def handler(request):
            raise httpx.ReadTimeout('test-secret-not-a-real-key', request=request)
        with self.assertLogs('app.api.v1.routes.database', level='WARNING') as logs:
            response = self.request_with_transport(handler)
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('test-secret', response.text + '\n'.join(logs.output))

    def test_missing_count_is_not_reported_as_zero(self):
        response = self.request_with_transport(lambda request: httpx.Response(200))
        self.assertEqual(response.status_code, 502)

    def test_diagnostic_is_absent_in_staging_and_production(self):
        for environment in ('staging', 'production'):
            with TestClient(create_app(Settings(_env_file=None, environment=environment))) as api:
                self.assertEqual(api.get('/api/v1/test/database').status_code, 404)
                self.assertNotIn('/api/v1/test/database', api.get('/openapi.json').json()['paths'])

    def test_client_is_reused_and_http_pool_is_closed(self):
        with patch.object(database, 'create_client') as factory:
            client = database.get_supabase_client(self.settings)
            self.assertIs(client, database.get_supabase_client(self.settings))
            factory.assert_called_once()
            options = factory.call_args.kwargs['options']
            self.assertFalse(options.persist_session)
            self.assertFalse(options.auto_refresh_token)
            self.assertEqual(options.httpx_client.timeout.read, 10)
            self.assertFalse(options.httpx_client.is_closed)
            database.close_supabase_client()
            self.assertTrue(options.httpx_client.is_closed)
            self.assertIsNone(database.supabase_client)

    def test_creation_failure_closes_transport_and_can_retry(self):
        with patch.object(database, 'create_client', side_effect=ValueError('invalid')) as factory:
            with self.assertRaises(ValueError):
                database.get_supabase_client(self.settings)
            self.assertTrue(factory.call_args.kwargs['options'].httpx_client.is_closed)
            self.assertIsNone(database.supabase_client)
        with patch.object(database, 'create_client') as factory:
            self.assertIs(database.get_supabase_client(self.settings), factory.return_value)

    def test_invalid_settings_rejected_and_blank_url_allowed(self):
        self.assertIsNone(Settings(_env_file=None, supabase_url='').supabase_url)
        for value in ('not-a-url', 'postgresql://localhost/db', 'https://user:secret@example.com'):
            with self.assertRaises(ValidationError):
                Settings(_env_file=None, supabase_url=value)
        with self.assertRaises(ValidationError):
            Settings(_env_file=None, supabase_timeout_seconds=0)


if __name__ == '__main__':
    unittest.main()
