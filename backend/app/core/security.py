"""Webhook authentication utilities; end-user authentication is not implemented."""

import hashlib
import hmac
import re
import time

_RETELL_SIGNATURE_PATTERN = re.compile(r"^v=(\d+),d=([0-9a-fA-F]{64})$")


def verify_retell_webhook_signature(
    raw_body: bytes,
    signature: str | None,
    api_key: str,
    *,
    tolerance_seconds: int = 300,
    current_time_seconds: float | None = None,
) -> bool:
    """Verify Retell's timestamped HMAC over the exact raw request body.

    Retell signs ``raw_body + timestamp`` using the webhook-enabled API key.
    Timestamp freshness limits replay. This function performs no network calls.
    """
    if not signature or not api_key or not raw_body or tolerance_seconds <= 0:
        return False
    match = _RETELL_SIGNATURE_PATTERN.fullmatch(signature.strip())
    if match is None:
        return False
    timestamp_text, supplied_digest = match.groups()
    timestamp_seconds = int(timestamp_text) / 1000
    now = time.time() if current_time_seconds is None else current_time_seconds
    if abs(now - timestamp_seconds) > tolerance_seconds:
        return False
    signed_payload = raw_body + timestamp_text.encode("ascii")
    expected_digest = hmac.new(
        api_key.encode("utf-8"), signed_payload, hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected_digest, supplied_digest.lower())
