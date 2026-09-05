"""Pricing arithmetic and full HTTP/repository contracts without a live database."""

import unittest
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

import httpx
from fastapi.testclient import TestClient
from supabase import ClientOptions, create_client

from app.core.config import Settings
from app.main import create_app
from app.repositories.service_repository import ServiceRepository
from app.schemas.quote import PricingRule, QuoteCalculateRequest
from app.services.pricing_engine import calculate_price


class PricingTests(unittest.TestCase):
    def setUp(self):
        self.company = uuid4()
        self.service = uuid4()
        self.rules = []
        self.service_row = {'id': str(self.service), 'company_id': str(self.company),
                            'name': 'Product photography', 'pricing_type': 'per_image', 'is_active': True}
        self.settings = Settings(_env_file=None, environment='testing', agent_company_id=self.company)
        self.requests = []
        self.count_override = None

    def rule(self, kind, amount, condition=None):
        return {'id': str(uuid4()), 'service_id': str(self.service), 'rule_type': kind,
                'value': amount, 'condition': condition or {}}

    def request(self, **changes):
        data = {'company_id': str(self.company), 'service_name': 'Product photography', 'image_count': 10, 'addons': []}
        data.update(changes)
        return data

    def call_api(self, payload):
        def handler(request):
            self.requests.append(request)
            if request.url.path.endswith('/services'):
                return httpx.Response(200, json=[] if self.service_row is None else [self.service_row])
            count = len(self.rules) if self.count_override is None else self.count_override
            return httpx.Response(200, json=self.rules, headers={'Content-Range': f'*/{count}'})
        with httpx.Client(transport=httpx.MockTransport(handler)) as transport:
            client = create_client('https://project.example.com', 'fake-test-only', options=ClientOptions(
                httpx_client=transport, auto_refresh_token=False, persist_session=False,
            ))
            with patch('app.repositories.base.get_supabase_client', return_value=client):
                with TestClient(create_app(self.settings)) as api:
                    return api.post('/api/v1/quotes/calculate', json=payload)

    def test_full_calculation_uses_tenant_rules_and_numeric_response(self):
        self.rules = [self.rule('per_image', '2.25'),
                      self.rule('addon', '10.50', {'code': 'rush', 'pricing_type': 'fixed'}),
                      self.rule('addon', '0.15', {'code': 'retouch', 'pricing_type': 'per_image'})]
        response = self.call_api(self.request(addons=['rush', 'retouch']))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'service': 'Product photography', 'base_price': 22.5,
                                           'addons': 12, 'total_price': 34.5})
        self.assertEqual(response.headers['cache-control'], 'no-store')
        self.assertEqual(self.requests[0].url.params['company_id'], f'eq.{self.company}')
        self.assertEqual(self.requests[1].url.params['services.company_id'], f'eq.{self.company}')
        self.assertEqual(self.requests[1].url.params['service_id'], f'eq.{self.service}')
        self.assertIn('services!inner(company_id)', self.requests[1].url.params['select'])
        self.assertTrue(all(request.method == 'GET' for request in self.requests))

    def test_pricing_updates_are_read_on_next_request(self):
        self.rules = [self.rule('per_image', '0.1')]
        self.assertEqual(self.call_api(self.request(image_count=3)).json()['total_price'], 0.3)
        self.rules[0]['value'] = '0.2'
        self.assertEqual(self.call_api(self.request(image_count=3)).json()['total_price'], 0.6)

    def test_fixed_price_and_zero_images(self):
        self.service_row['pricing_type'] = 'fixed'
        self.rules = [self.rule('base', '42.1234')]
        self.assertEqual(self.call_api(self.request(image_count=0)).json()['base_price'], 42.1234)
        self.service_row['pricing_type'] = 'per_image'
        self.rules = [self.rule('per_image', '42.1234')]
        self.assertEqual(self.call_api(self.request(image_count=0)).json()['base_price'], 0)

    def test_unknown_or_duplicate_addons_rejected(self):
        self.rules = [self.rule('per_image', 1)]
        self.assertEqual(self.call_api(self.request(addons=['missing'])).status_code, 422)
        self.requests = []
        self.assertEqual(self.call_api(self.request(addons=['rush', 'rush'])).status_code, 422)
        self.assertEqual(self.requests, [])

    def test_invalid_configurations_never_fall_back_to_zero(self):
        cases = [[], [self.rule('base', 1)], [self.rule('per_image', 1), self.rule('per_image', 2)],
                 [self.rule('per_image', -1)], [self.rule('per_image', 'NaN')],
                 [self.rule('per_image', 1, {'min_images': 20})], [self.rule('unknown', 1)],
                 [self.rule('per_image', 1), self.rule('addon', 2, {'code': 'rush'})],
                 [self.rule('per_image', 1), self.rule('addon', 2, {'code': 'rush', 'pricing_type': 'fixed'}),
                  self.rule('addon', 3, {'code': 'rush', 'pricing_type': 'fixed'})]]
        for rules in cases:
            with self.subTest(rules=rules):
                self.rules = rules
                self.assertEqual(self.call_api(self.request()).status_code, 409)

    def test_missing_or_inactive_service(self):
        self.service_row['is_active'] = False
        self.assertEqual(self.call_api(self.request()).status_code, 404)
        self.service_row = None
        self.assertEqual(self.call_api(self.request()).status_code, 404)
        self.assertEqual(len(self.requests), 2)

    def test_truncated_rule_set_is_rejected(self):
        self.rules = [self.rule('per_image', 1)]
        self.count_override = 1001
        self.assertEqual(self.call_api(self.request()).status_code, 503)

    def test_tenant_and_input_validation_before_queries(self):
        self.assertEqual(self.call_api(self.request(company_id=str(uuid4()))).status_code, 403)
        for changes in ({'image_count': -1}, {'image_count': True}, {'image_count': '10'},
                        {'image_count': 1.5}, {'addons': [{'code': 'rush', 'price': 0}]},
                        {'service_name': ' '}, {'base_price': 0}):
            self.assertEqual(self.call_api(self.request(**changes)).status_code, 422)
        self.assertEqual(self.requests, [])

    def test_rule_service_mismatch_and_overflow_rejected(self):
        self.rules = [self.rule('per_image', 1)]
        self.rules[0]['service_id'] = str(uuid4())
        self.assertEqual(self.call_api(self.request()).status_code, 409)
        self.rules = [self.rule('per_image', '99999999999999.9999')]
        self.assertEqual(self.call_api(self.request(image_count=2147483647)).status_code, 409)

    def test_decimal_arithmetic_and_unselected_addons(self):
        rules = [PricingRule.model_validate(self.rule('per_image', '0.1')),
                 PricingRule.model_validate(self.rule('addon', '100', {'code': 'rush', 'pricing_type': 'fixed'}))]
        result = calculate_price(QuoteCalculateRequest(**self.request(image_count=3)),
                                 service_name='Product photography', pricing_type='per_image', rules=rules)
        self.assertEqual(result.total_price, Decimal('0.3'))
        self.assertEqual(result.addons, Decimal(0))

    def test_staging_and_production_route_absent(self):
        for environment in ('staging', 'production'):
            self.settings.environment = environment
            self.assertEqual(self.call_api(self.request()).status_code, 404)
        self.assertEqual(self.requests, [])


class ServiceRepositoryTests(unittest.IsolatedAsyncioTestCase):
    async def test_active_catalog_filters_and_pagination(self):
        company = uuid4()
        def handler(request):
            self.assertEqual(request.url.params['company_id'], f'eq.{company}')
            self.assertEqual(request.url.params['is_active'].lower(), 'eq.true')
            self.assertEqual(request.url.params['limit'], '10')
            self.assertEqual(request.url.params['offset'], '20')
            return httpx.Response(200, json=[])
        with httpx.Client(transport=httpx.MockTransport(handler)) as transport:
            client = create_client('https://project.example.com', 'fake', options=ClientOptions(
                httpx_client=transport, auto_refresh_token=False, persist_session=False,
            ))
            self.assertEqual(await ServiceRepository(company, client=client).get_active_services(limit=10, offset=20), [])
