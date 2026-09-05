"""Foundation checks without external service access."""

import json
import logging
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.core.logging import JsonFormatter
from app.main import create_app


class FoundationTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {}, clear=True)
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def test_health_and_versioning(self):
        with TestClient(create_app(Settings(_env_file=None))) as client:
            response = client.get('/api/v1/health')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), {
                'status': 'healthy', 'service': 'lenscraft-backend',
            })
            self.assertEqual(client.get('/health').status_code, 404)

    def test_cors_allowlist(self):
        settings = Settings(_env_file=None, cors_origins=['http://localhost:3000'])
        with TestClient(create_app(settings)) as client:
            for origin, allowed in [
                ('http://localhost:3000', True),
                ('https://untrusted.example', False),
            ]:
                response = client.options('/api/v1/health', headers={
                    'Origin': origin,
                    'Access-Control-Request-Method': 'GET',
                })
                self.assertEqual(response.status_code, 200 if allowed else 400)
                self.assertEqual(
                    response.headers.get('access-control-allow-origin'),
                    origin if allowed else None,
                )
                self.assertNotIn('access-control-allow-credentials', response.headers)

    def test_cors_denies_origins_by_default(self):
        with TestClient(create_app(Settings(_env_file=None))) as client:
            response = client.get('/api/v1/health', headers={
                'Origin': 'https://untrusted.example',
            })
            self.assertNotIn('access-control-allow-origin', response.headers)

    def test_environment_overrides_dotenv_and_masks_secrets(self):
        with tempfile.TemporaryDirectory() as directory:
            dotenv = Path(directory) / '.env'
            dotenv.write_text(
                'APP_NAME=from-file\nSUPABASE_KEY=test-secret\n'
                'CORS_ORIGINS=["http://localhost:3000"]\n', encoding='utf-8',
            )
            with patch.dict(os.environ, {'APP_NAME': 'from-environment'}):
                settings = Settings(_env_file=dotenv)
            self.assertEqual(settings.app_name, 'from-environment')
            self.assertEqual(settings.cors_origins, ['http://localhost:3000'])
            self.assertNotIn('test-secret', repr(settings))

    def test_invalid_environment_rejected(self):
        with self.assertRaises(ValidationError):
            Settings(_env_file=None, environment='invalid')

    def test_json_log_format(self):
        record = logging.LogRecord(
            'app.test', logging.INFO, __file__, 1, 'line one\nline two', (), None,
        )
        output = JsonFormatter().format(record)
        self.assertEqual(len(output.splitlines()), 1)
        payload = json.loads(output)
        self.assertEqual(payload['service'], 'lenscraft-backend')
        self.assertEqual(payload['level'], 'INFO')
        self.assertTrue(payload['timestamp'].endswith('+00:00'))


if __name__ == '__main__':
    unittest.main()
