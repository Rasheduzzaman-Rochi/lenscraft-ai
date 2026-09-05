"""Pure service contract checks; no network, credentials, or database required."""

import unittest
from decimal import Decimal
from unittest.mock import Mock
from uuid import uuid4

from pydantic import ValidationError

from app.services.agent_service import AgentRequest, AgentService
from app.services.conversation_service import ConversationInput, ConversationService, CustomerRequirements
from app.services.lead_service import LeadData, LeadPatch, LeadService
from app.services.quote_service import PriceCalculation, QuoteRequest, QuoteResult, QuoteService


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.company_id = uuid4()
        self.leads = LeadService()

    def test_transcript_alone_does_not_invent_requirements(self):
        result = ConversationService().extract_requirements(ConversationInput(
            transcript='We need 20 images tomorrow', customer_messages=('Quote please',),
        ))
        self.assertEqual(result.model_dump(), {
            'product_category': '', 'service_type': '', 'product_count': None,
            'image_count': None, 'deadline': '', 'purpose': '',
        })

    def test_supplied_requirements_are_normalized(self):
        result = ConversationService().extract_requirements(ConversationInput(
            extracted_information={'service_type': ' Product photography ', 'image_count': 20},
        ))
        self.assertEqual(result.service_type, 'Product photography')
        self.assertEqual(result.image_count, 20)
        self.assertIsNone(result.product_count)

    def test_invalid_requirements_are_rejected(self):
        for value in (-1, True, '3', 1.5):
            with self.subTest(value=value), self.assertRaises(ValidationError):
                CustomerRequirements(image_count=value)
        with self.assertRaises(ValidationError):
            CustomerRequirements(unexpected='field')

    def test_lead_update_preserves_omitted_fields_and_clears_explicit_nulls(self):
        original = self.leads.create_lead(company_id=self.company_id, data=LeadData(
            source='phone', intent='quote', status='qualified', estimated_value=Decimal('12.3400'),
        ))
        updated = self.leads.update_lead(
            company_id=self.company_id, lead=original, patch=LeadPatch(intent=None),
        )
        self.assertEqual(updated.id, original.id)
        self.assertEqual(updated.status, 'qualified')
        self.assertEqual(updated.source, 'phone')
        self.assertIsNone(updated.intent)
        self.assertEqual(original.intent, 'quote')
        payload = self.leads.prepare_lead_data(company_id=self.company_id, lead=updated)
        self.assertEqual(payload['company_id'], str(self.company_id))
        self.assertEqual(payload['estimated_value'], '12.3400')
        self.assertEqual(set(payload), {
            'id', 'company_id', 'customer_id', 'source', 'intent', 'status', 'estimated_value',
        })

    def test_lead_tenant_and_identity_are_protected(self):
        lead = self.leads.create_lead(company_id=self.company_id, data=LeadData())
        with self.assertRaises(ValueError):
            self.leads.update_lead(company_id=uuid4(), lead=lead, patch=LeadPatch())
        with self.assertRaises(ValueError):
            self.leads.prepare_lead_data(company_id=uuid4(), lead=lead)
        for fields in ({'company_id': uuid4()}, {'id': uuid4()}, {'status': None}, {'status': ' '}):
            with self.assertRaises(ValidationError):
                LeadPatch(**fields)

    def test_invalid_monetary_values_are_rejected(self):
        for amount in ('NaN', 'Infinity', '-1', '1.00001'):
            with self.subTest(amount=amount):
                with self.assertRaises(ValidationError):
                    LeadData(estimated_value=amount)
                with self.assertRaises(ValidationError):
                    PriceCalculation(currency='USD', total_price=amount)

    def test_quote_without_calculator_has_no_price(self):
        result = QuoteService().handle_quote_request(QuoteRequest(
            company_id=self.company_id, requirements=CustomerRequirements(),
        ))
        self.assertEqual(result.status, 'awaiting_pricing')
        self.assertIsNone(result.calculation)

    def test_quote_delegates_to_calculator_and_propagates_errors(self):
        request = QuoteRequest(company_id=self.company_id, requirements=CustomerRequirements())
        calculator = Mock()
        calculator.calculate.return_value = PriceCalculation(currency='USD', total_price='123.45')
        result = QuoteService(calculator).handle_quote_request(request)
        calculator.calculate.assert_called_once_with(request)
        self.assertEqual(result.status, 'calculated')
        self.assertEqual(result.calculation.total_price, Decimal('123.45'))
        calculator.calculate.side_effect = ValueError('Pricing rules unavailable')
        with self.assertRaises(ValueError):
            QuoteService(calculator).handle_quote_request(request)
        with self.assertRaises(ValidationError):
            QuoteResult(request=request, status='calculated')

    def test_orchestrator_selects_only_requested_service(self):
        leads = Mock(wraps=LeadService())
        quotes = Mock(wraps=QuoteService())
        service = AgentService(lead_service=leads, quote_service=quotes)
        extracted = service.handle_conversation(AgentRequest(
            company_id=self.company_id, action='extract_requirements',
        ))
        self.assertIsNone(extracted.lead)
        leads.create_lead.assert_not_called()
        quotes.handle_quote_request.assert_not_called()
        created = service.handle_conversation(AgentRequest(
            company_id=self.company_id, action='create_lead', lead_data=LeadData(intent='quote'),
        ))
        leads.create_lead.assert_called_once()
        quotes.handle_quote_request.assert_not_called()
        updated = service.handle_conversation(AgentRequest(
            company_id=self.company_id, action='update_lead', existing_lead=created.lead,
            lead_patch=LeadPatch(status='qualified'),
        ))
        self.assertEqual(updated.lead.status, 'qualified')
        quoted = service.handle_conversation(AgentRequest(
            company_id=self.company_id, action='request_quote',
            conversation=ConversationInput(extracted_information={'image_count': 10}),
        ))
        self.assertEqual(quoted.quote.request.requirements.image_count, 10)
        self.assertEqual(quoted.quote.request.company_id, self.company_id)
        leads.create_lead.assert_called_once()
        leads.update_lead.assert_called_once()
        quotes.handle_quote_request.assert_called_once()

    def test_bad_or_ambiguous_agent_commands_are_rejected(self):
        for fields in (
            {'action': 'unknown'}, {'action': 'create_lead'}, {'action': 'update_lead'},
            {'action': 'request_quote', 'lead_data': LeadData()},
            {'action': 'create_lead', 'lead_data': LeadData(), 'customer_id': uuid4()},
            {'action': 'update_lead', 'lead_patch': LeadPatch(),
             'existing_lead': self.leads.create_lead(company_id=uuid4(), data=LeadData())},
        ):
            with self.assertRaises(ValidationError):
                AgentRequest(company_id=self.company_id, **fields)


if __name__ == '__main__':
    unittest.main()
