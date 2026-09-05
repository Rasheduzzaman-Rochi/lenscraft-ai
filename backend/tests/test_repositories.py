"""Repository contract checks using the actual Supabase SDK and mock HTTP."""

import json
import threading
import unittest
from unittest.mock import patch
from uuid import uuid4

import httpx
from pydantic import ValidationError
from supabase import ClientOptions, create_client

from app.repositories.call_repository import CallRepository
from app.repositories.customer_repository import CustomerRepository
from app.repositories.errors import (
    RecordNotFoundError, RepositoryConflictError, RepositoryError, RepositoryIntegrityError,
)
from app.repositories.lead_repository import LeadRepository
from app.repositories.project_repository import ProjectRepository
from app.repositories.quote_repository import QuoteRepository
from app.repositories.schemas import CustomerUpdate


class RepositoryTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.company = uuid4()
        self.customer = uuid4()
        self.project = uuid4()
        self.record = uuid4()
        self.requests = []
        self.responses = []
        self.threads = []

        def handler(request):
            self.requests.append(request)
            self.threads.append(threading.get_ident())
            response = self.responses.pop(0)
            if isinstance(response, Exception):
                raise response
            return response

        transport = httpx.Client(transport=httpx.MockTransport(handler))
        self.addCleanup(transport.close)
        self.client = create_client('https://project.example.com', 'test-only-key', options=ClientOptions(
            httpx_client=transport, auto_refresh_token=False, persist_session=False,
        ))

    def row_response(self):
        return httpx.Response(200, json=[{'id': str(self.record)}])

    async def test_all_direct_inserts_attach_tenant_and_use_worker_thread(self):
        cases = [
            (CustomerRepository, 'create_customer', {'name': 'Customer', 'email': ' NAME@EXAMPLE.COM '}, 'customers'),
            (LeadRepository, 'create_lead', {'customer_id': self.customer}, 'leads'),
            (CallRepository, 'save_call_record', {'retell_call_id': 'call-1'}, 'calls'),
            (ProjectRepository, 'create_project', {'customer_id': self.customer, 'deadline': '2026-12-01T12:00:00Z'}, 'projects'),
        ]
        for cls, method, payload, table in cases:
            self.responses.append(self.row_response())
            result = await getattr(cls(self.company, client=self.client), method)(payload)
            request = self.requests[-1]
            self.assertEqual(request.method, 'POST')
            self.assertEqual(request.url.path, f'/rest/v1/{table}')
            body = json.loads(request.content)
            self.assertEqual(body['company_id'], str(self.company))
            self.assertEqual(result['id'], str(self.record))
            if table == 'customers':
                self.assertEqual(body['email'], 'name@example.com')
            if table == 'leads':
                self.assertNotIn('id', body)
        self.assertTrue(all(thread != threading.get_ident() for thread in self.threads))

    async def test_default_client_is_obtained_from_database_layer_off_thread(self):
        self.responses.append(self.row_response())
        def provide_client():
            self.assertNotEqual(threading.get_ident(), main_thread)
            return self.client
        main_thread = threading.get_ident()
        with patch('app.repositories.base.get_supabase_client', side_effect=provide_client) as getter:
            await LeadRepository(self.company).get_lead_by_id(self.record)
            getter.assert_called_once_with()

    async def test_updates_filter_both_company_and_record_id(self):
        cases = [
            (CustomerRepository, 'update_customer', CustomerUpdate(phone=None)),
            (LeadRepository, 'update_lead_status', 'qualified'),
            (ProjectRepository, 'update_project_status', 'active'),
        ]
        for cls, method, payload in cases:
            self.responses.append(self.row_response())
            await getattr(cls(self.company, client=self.client), method)(self.record, payload)
            request = self.requests[-1]
            self.assertEqual(request.method, 'PATCH')
            self.assertEqual(request.url.params['company_id'], f'eq.{self.company}')
            self.assertEqual(request.url.params['id'], f'eq.{self.record}')
            if cls is CustomerRepository:
                self.assertEqual(json.loads(request.content), {'phone': None})

    async def test_customer_and_lead_lookups_are_scoped(self):
        self.responses.extend([httpx.Response(200, json=[]), httpx.Response(200, json=[])])
        self.assertIsNone(await CustomerRepository(self.company, client=self.client).get_customer_by_email(' NAME@EXAMPLE.COM '))
        self.assertEqual(self.requests[-1].url.params['email'], 'eq.name@example.com')
        self.assertIsNone(await LeadRepository(self.company, client=self.client).get_lead_by_id(self.record))
        for request in self.requests:
            self.assertEqual(request.url.params['company_id'], f'eq.{self.company}')

    async def test_ambiguous_email_raises_conflict(self):
        self.responses.append(httpx.Response(200, json=[{'id': 'a'}, {'id': 'b'}]))
        with self.assertRaises(RepositoryConflictError):
            await CustomerRepository(self.company, client=self.client).get_customer_by_email('shared@example.com')
        self.assertEqual(self.requests[0].url.params['limit'], '2')

    async def test_call_history_is_scoped_filtered_and_paginated(self):
        self.responses.append(httpx.Response(200, json=[]))
        result = await CallRepository(self.company, client=self.client).get_call_history(
            customer_id=self.customer, limit=10, offset=20,
        )
        self.assertEqual(result, [])
        params = self.requests[0].url.params
        self.assertEqual(params['company_id'], f'eq.{self.company}')
        self.assertEqual(params['customer_id'], f'eq.{self.customer}')
        self.assertEqual(params['order'], 'created_at.desc,id.desc')
        self.assertEqual(params['offset'], '20')
        self.assertEqual(params['limit'], '10')

    async def test_quote_operations_verify_project_and_scope_queries(self):
        repo = QuoteRepository(self.company, client=self.client)
        self.responses.extend([self.row_response() for _ in range(6)])
        await repo.create_quote(self.project, {'total_price': '123.4500'})
        await repo.update_quote_status(self.project, self.record, 'sent')
        await repo.get_quotes_by_project(self.project, limit=5, offset=10)
        for request in self.requests[::2]:
            self.assertEqual(request.url.path, '/rest/v1/projects')
            self.assertEqual(request.url.params['company_id'], f'eq.{self.company}')
            self.assertEqual(request.url.params['id'], f'eq.{self.project}')
        body = json.loads(self.requests[1].content)
        self.assertEqual(body['project_id'], str(self.project))
        self.assertEqual(body['total_price'], '123.4500')
        self.assertNotIn('company_id', body)
        self.assertEqual(self.requests[3].url.params['id'], f'eq.{self.record}')
        for request in (self.requests[3], self.requests[5]):
            self.assertEqual(request.url.params['project_id'], f'eq.{self.project}')

    async def test_foreign_or_missing_project_prevents_every_quote_operation(self):
        repo = QuoteRepository(self.company, client=self.client)
        for action in (
            lambda: repo.create_quote(self.project, {'total_price': 1}),
            lambda: repo.update_quote_status(self.project, self.record, 'sent'),
            lambda: repo.get_quotes_by_project(self.project),
        ):
            self.responses.append(httpx.Response(200, json=[]))
            with self.assertRaises(RecordNotFoundError):
                await action()
        self.assertEqual(len(self.requests), 3)
        self.assertTrue(all(request.url.path == '/rest/v1/projects' for request in self.requests))

    async def test_not_found_update_is_explicit(self):
        self.responses.append(httpx.Response(200, json=[]))
        with self.assertRaises(RecordNotFoundError):
            await LeadRepository(self.company, client=self.client).update_lead_status(self.record, 'new')

    async def test_provider_errors_are_translated_and_sanitized(self):
        for code, error in [('23505', RepositoryConflictError), ('23503', RepositoryIntegrityError), ('42501', RepositoryError)]:
            self.responses.append(httpx.Response(400, json={'code': code, 'message': 'secret-provider-detail', 'details': None, 'hint': None}))
            with self.assertLogs('app.repositories.base', level='WARNING') as logs:
                with self.assertRaises(error) as raised:
                    await CallRepository(self.company, client=self.client).save_call_record({})
            self.assertNotIn('secret-provider-detail', str(raised.exception) + '\n'.join(logs.output))
        self.assertEqual(len(self.requests), 3)  # No automatic retries of writes.

    async def test_timeout_is_sanitized_and_not_retried(self):
        self.responses.append(httpx.ReadTimeout('secret-provider-detail'))
        with self.assertRaises(RepositoryError) as raised:
            await LeadRepository(self.company, client=self.client).get_lead_by_id(self.record)
        self.assertNotIn('secret-provider-detail', str(raised.exception))
        self.assertEqual(len(self.requests), 1)

    async def test_invalid_payloads_and_pagination_fail_before_network(self):
        customer = CustomerRepository(self.company, client=self.client)
        for payload in ({'company_id': str(uuid4())}, {'id': str(uuid4())}, {'name': None}, {'name': ' '}):
            with self.assertRaises(ValidationError):
                await customer.update_customer(self.record, payload)
        with self.assertRaises(ValueError):
            await customer.update_customer(self.record, {})
        for limit, offset in [(0, 0), (101, 0), (True, 0), (10, -1)]:
            with self.assertRaises(ValueError):
                await CallRepository(self.company, client=self.client).get_call_history(limit=limit, offset=offset)
        with self.assertRaises(ValidationError):
            await ProjectRepository(self.company, client=self.client).create_project({
                'customer_id': self.customer, 'deadline': '2026-12-01T12:00:00',
            })
        with self.assertRaises(ValidationError):
            await QuoteRepository(self.company, client=self.client).create_quote(self.project, {'total_price': 'NaN'})
        self.assertEqual(self.requests, [])


if __name__ == '__main__':
    unittest.main()
