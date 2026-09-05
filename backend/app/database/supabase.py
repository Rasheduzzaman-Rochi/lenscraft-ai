"""One lazy, reusable server-side Supabase client per worker process."""

from threading import Lock

import httpx
from supabase import Client, ClientOptions, create_client

from app.core.config import Settings, get_settings

supabase_client: Client | None = None
_http_client: httpx.Client | None = None
_client_lock = Lock()


class SupabaseConfigurationError(RuntimeError):
    """Required database configuration is absent."""


def get_supabase_client(settings: Settings | None = None) -> Client:
    """Return the shared client, initializing on first use without a network probe.

    Use this accessor rather than importing the initially empty instance by value.
    Never sign users into this privileged, process-wide client.
    """
    global supabase_client, _http_client
    with _client_lock:
        if supabase_client is not None:
            return supabase_client
        settings = settings if settings is not None else get_settings()
        key = settings.supabase_key.get_secret_value().strip()
        if settings.supabase_url is None or not key:
            raise SupabaseConfigurationError("SUPABASE_URL and SUPABASE_KEY are required")

        transport = httpx.Client(timeout=httpx.Timeout(settings.supabase_timeout_seconds))
        try:
            client = create_client(
                str(settings.supabase_url).rstrip("/"),
                key,
                options=ClientOptions(
                    schema="public",
                    auto_refresh_token=False,
                    persist_session=False,
                    postgrest_client_timeout=settings.supabase_timeout_seconds,
                    httpx_client=transport,
                ),
            )
        except Exception:
            transport.close()
            raise
        _http_client = transport
        supabase_client = client
        return client


def close_supabase_client() -> None:
    """Release the HTTP connection pool after in-flight requests finish."""
    global supabase_client, _http_client
    with _client_lock:
        if _http_client is not None:
            _http_client.close()
        _http_client = None
        supabase_client = None
