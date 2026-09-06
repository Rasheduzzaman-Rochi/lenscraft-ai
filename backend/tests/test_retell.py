"""Retell signature, schema, normalization, and webhook integration tests."""

import hashlib
import hmac
import json
import time
import unittest
from unittest.mock import Mock
from uuid import uuid4

from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.core.config import Settings
from app.core.security import verify_retell_webhook_signature
from app.main import create_app
from app.schemas.retell import RetellWebhookRequest
from app.services.agent_service import AgentService
from app.services.conversation_service import ConversationService
from app.services.retell_service import RetellService


def signature(body: bytes, key: str, timestamp_ms: int | None = None) -> str:
    timestamp = str(timestamp_ms if timestamp_ms is not None else int(time.time() * 1000))
    digest = hmac.new(key.encode(), body + timestamp.encode(), hashlib.sha256).hexdigest()
    return f"v={timestamp},d={digest}"


class RetellWebhookTests(unittest.TestCase):
    def setUp(self):
        self.key = "retell-test-key-not-real"
        self.company = uuid4()
        self.settings = Settings(
            _env_file=None,
            environment="testing",
            agent_company_id=self.company,
            retell_api_key=self.key,
        )

    def send(self, payload: object, supplied_signature: str | None = None):
        body = json.dumps(payload, separators=(",", ":")).encode()
        headers = {"content-type": "application/json"}
        if supplied_signature is not None:
            headers["x-retell-signature"] = supplied_signature
        else:
            headers["x-retell-signature"] = signature(body, self.key)
        with TestClient(create_app(self.settings)) as client:
            return client.post("/api/v1/retell/webhook", content=body, headers=headers)

    def test_signed_call_ended_is_processed_without_disclosing_payload(self):
        payload = {
            "event": "call_ended",
            "call": {
                "call_id": "call-123",
                "agent_id": "agent-123",
                "transcript": "Name: Jane; Service type: product photography; Image count: 12",
                "metadata": {"crm_reference": "private-reference"},
                "start_timestamp": 1_000,
                "end_timestamp": 13_500,
                "provider_future_field": "accepted",
            },
            "transfer_destination": {"number": "+10000000000"},
        }
        with self.assertLogs("app.api.v1.routes.retell", level="INFO") as logs:
            response = self.send(payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "received": True,
            "call_id": "call-123",
            "event_type": "call_ended",
            "status": "processed",
            "message": "Retell event processed",
            "company_id": str(self.company),
        })
        combined = response.text + "\n".join(logs.output)
        self.assertNotIn("private-reference", combined)
        self.assertNotIn("Name: Jane", combined)

    def test_transcript_items_are_normalized_when_flat_transcript_is_absent(self):
        response = self.send({
            "event": "call_analyzed",
            "call": {
                "call_id": "call-items",
                "metadata": {},
                "transcript_object": [
                    {"role": "agent", "content": "How can I help?", "words": []},
                    {"role": "user", "content": "Purpose: online store", "words": []},
                ],
                "call_analysis": {"call_successful": True},
            },
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "processed")

    def test_nonfinal_and_unknown_events_are_acknowledged(self):
        for event in ("call_started", "transcript_updated", "transfer_started", "future_event"):
            with self.subTest(event=event):
                response = self.send({"event": event, "call": {"call_id": "call-1"}})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["status"], "ignored")

    def test_missing_invalid_and_stale_signatures_are_rejected(self):
        payload = {"event": "call_ended", "call": {"call_id": "call-1"}}
        body = json.dumps(payload, separators=(",", ":")).encode()
        stale = int((time.time() - 301) * 1000)
        for supplied in ("", "invalid", signature(body, "wrong-key"), signature(body, self.key, stale)):
            with self.subTest(signature=supplied):
                response = self.send(payload, supplied)
                self.assertEqual(response.status_code, 401)

    def test_signed_malformed_payloads_return_400(self):
        for payload in ({}, {"event": "call_ended"}, {"event": "", "call": {"call_id": "x"}},
                        {"event": "call_ended", "call": {"call_id": ""}}):
            with self.subTest(payload=payload):
                self.assertEqual(self.send(payload).status_code, 400)

    def test_configuration_is_required_before_body_processing(self):
        self.settings.retell_api_key = SecretStr("")
        self.assertEqual(self.send({"anything": "untrusted"}).status_code, 503)
        self.settings.retell_api_key = SecretStr(self.key)
        self.settings.agent_company_id = None
        self.assertEqual(self.send({"anything": "untrusted"}).status_code, 503)

    def test_route_is_available_in_production_with_signature_verification(self):
        self.settings.environment = "production"
        response = self.send({"event": "call_started", "call": {"call_id": "call-1"}})
        self.assertEqual(response.status_code, 200)


class RetellServiceTests(unittest.TestCase):
    def test_normalization_and_existing_agent_service_handoff(self):
        company = uuid4()
        agent = Mock(wraps=AgentService())
        service = RetellService(company, agent_service=agent, conversation_service=ConversationService())
        result = service.process_event(RetellWebhookRequest.model_validate({
            "event": "call_ended",
            "call": {
                "call_id": "call-1",
                "transcript": "Product category: jewelry; Image count: 4",
                "metadata": {"source": "phone"},
                "start_timestamp": 1000,
                "end_timestamp": 5500,
            },
        }))
        self.assertEqual(result.status, "processed")
        self.assertEqual(result.call.duration_seconds, 4)
        self.assertEqual(result.call.metadata, {"source": "phone"})
        self.assertEqual(result.requirements["product_category"], "jewelry")
        self.assertEqual(result.requirements["image_count"], 4)
        agent.handle_conversation.assert_called_once()

    def test_ignored_event_does_not_call_agent(self):
        agent = Mock(spec=AgentService)
        result = RetellService(uuid4(), agent_service=agent).process_event(
            RetellWebhookRequest.model_validate({
                "event": "call_started", "call": {"call_id": "call-1"},
            })
        )
        self.assertEqual(result.status, "ignored")
        agent.handle_conversation.assert_not_called()

    def test_signature_verification_uses_exact_body_and_timestamp(self):
        key = "key"
        now = 1_700_000_000.0
        timestamp = int(now * 1000)
        body = b'{"event":"call_started"}'
        signed = signature(body, key, timestamp)
        self.assertTrue(verify_retell_webhook_signature(
            body, signed, key, current_time_seconds=now,
        ))
        self.assertFalse(verify_retell_webhook_signature(
            body + b" ", signed, key, current_time_seconds=now,
        ))
        self.assertFalse(verify_retell_webhook_signature(
            body, signed, key, current_time_seconds=now + 301,
        ))


if __name__ == "__main__":
    unittest.main()
