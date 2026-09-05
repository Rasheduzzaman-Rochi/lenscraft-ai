"""API → service → repositories → SDK integration with mocked database HTTP."""

import json
import unittest
from unittest.mock import patch
from uuid import uuid4

import httpx
from fastapi.testclient import TestClient
from supabase import ClientOptions, create_client

from app.core.config import Settings
from app.main import create_app
from app.services.conversation_service import ConversationService


class LeadProcessingTests(unittest.TestCase):
    def setUp(self):
        self.company = uuid4()
        self.ids = [str(uuid4()) for _ in range(4)]
        self.settings = Settings(
            _env_file=None, environment='testing', agent_company_id=self.company,
            supabase_url='https://project.example.com', supabase_key='fake-test-only',
        )
        self.requests = []
        self.fail_at = None

    def run_request(self, payload):
        def handler(request):
            index = len(self.requests)
            self.requests.append(request)
            if index == self.fail_at:
                raise httpx.ReadTimeout('private-provider-detail')
            return httpx.Response(201, json=[{'id': self.ids[index]}])
        with httpx.Client(transport=httpx.MockTransport(handler)) as transport:
            client = create_client('https://project.example.com', 'fake-test-only', options=ClientOptions(
                httpx_client=transport, auto_refresh_token=False, persist_session=False,
            ))
            with patch('app.repositories.base.get_supabase_client', return_value=client):
                with TestClient(create_app(self.settings)) as api:
                    return api.post('/api/v1/agent/process', json=payload)

    def test_complete_workflow_links_all_records_to_customer_and_company(self):
        transcript = ('Name: Jane; Email: JANE@EXAMPLE.COM; Product category: jewelry; '
                      'Service type: product photography; Product count: 4; Image count: 12; '
                      'Deadline: 2026-12-01T12:00:00+06:00; Purpose: online store')
        response = self.run_request({'transcript': transcript})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json(), {
            'success': True, 'customer_id': self.ids[0], 'lead_id': self.ids[1],
            'project_id': self.ids[2], 'message': 'Lead processed successfully',
        })
        self.assertEqual(response.headers['cache-control'], 'no-store')
        self.assertEqual([r.url.path for r in self.requests], [
            '/rest/v1/customers', '/rest/v1/leads', '/rest/v1/projects', '/rest/v1/calls',
        ])
        bodies = [json.loads(r.content) for r in self.requests]
        for body in bodies:
            self.assertEqual(body['company_id'], str(self.company))
        for body in bodies[1:]:
            self.assertEqual(body['customer_id'], self.ids[0])
        self.assertEqual(bodies[0]['email'], 'jane@example.com')
        self.assertEqual(bodies[2]['image_count'], 12)
        self.assertEqual(bodies[2]['deadline'], '2026-12-01T12:00:00+06:00')
        self.assertEqual(bodies[3]['transcript'], transcript)

    def test_unstructured_text_is_preserved_without_invented_facts(self):
        response = self.run_request({'transcript': 'I need some photography next week.'})
        self.assertEqual(response.status_code, 201)
        bodies = [json.loads(r.content) for r in self.requests]
        self.assertEqual(bodies[0]['name'], 'Unidentified customer')
        self.assertIsNone(bodies[0]['email'])
        self.assertIsNone(bodies[2]['product_count'])
        self.assertIsNone(bodies[2]['deadline'])

    def test_each_failed_write_reports_partial_progress_and_stops(self):
        stages = ('customer', 'lead', 'project', 'call')
        fields = ('customer_id', 'lead_id', 'project_id')
        for fail_at in range(4):
            with self.subTest(fail_at=fail_at):
                self.requests = []
                self.fail_at = fail_at
                with self.assertLogs('app.services.lead_processing_service', level='ERROR') as logs:
                    response = self.run_request({'transcript': 'Name: Private Customer'})
                self.assertEqual(response.status_code, 503)
                detail = response.json()['detail']
                self.assertEqual(detail['failed_stage'], stages[fail_at])
                self.assertEqual(detail['confirmed_records'], dict(zip(fields[:fail_at], self.ids[:fail_at])))
                self.assertFalse(detail['retry_safe'])
                self.assertEqual(len(self.requests), fail_at + 1)
                self.assertNotIn('private-provider-detail', response.text + '\n'.join(logs.output))
                self.assertNotIn('Private Customer', '\n'.join(logs.output))

    def test_invalid_payloads_fail_before_database_calls(self):
        for payload in ({}, {'transcript': ' '}, {'transcript': 123},
                        {'transcript': 'x' * 100001}, {'transcript': 'hello', 'company_id': str(uuid4())},
                        {'transcript': 'Product count: -1'}, {'transcript': 'Name: A; Name: B'}):
            response = self.run_request(payload)
            self.assertEqual(response.status_code, 422)
        self.assertEqual(self.requests, [])

    def test_unknown_tenant_configuration_does_not_select_arbitrary_company(self):
        self.settings.agent_company_id = None
        response = self.run_request({'transcript': 'Name: Jane'})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(self.requests, [])

    def test_absent_supabase_credentials_fail_before_writes(self):
        self.settings.supabase_url = None
        response = self.run_request({'transcript': 'Name: Jane'})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(self.requests, [])

    def test_unresolved_deadline_is_not_fabricated(self):
        response = self.run_request({'transcript': 'Deadline: tomorrow; Image count: 0'})
        self.assertEqual(response.status_code, 201)
        project = json.loads(self.requests[2].content)
        self.assertIsNone(project['deadline'])
        self.assertEqual(project['image_count'], 0)

    def test_production_and_staging_do_not_expose_unauthenticated_writes(self):
        for environment in ('production', 'staging'):
            self.settings.environment = environment
            response = self.run_request({'transcript': 'hello'})
            self.assertEqual(response.status_code, 404)
        self.assertEqual(self.requests, [])

    def test_cors_allows_post_from_configured_origin(self):
        self.settings.cors_origins = ['http://localhost:3000']
        with TestClient(create_app(self.settings)) as client:
            response = client.options('/api/v1/agent/process', headers={
                'Origin': 'http://localhost:3000', 'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'content-type',
            })
            self.assertEqual(response.status_code, 200)

    def test_count_overflow_and_conflicting_aliases_rejected(self):
        parser = ConversationService()
        for text in ('Image count: 999999999999999', 'Name: Jane; Customer name: John'):
            with self.assertRaises(ValueError):
                parser.extract_from_transcript(text)


if __name__ == '__main__':
    unittest.main()
