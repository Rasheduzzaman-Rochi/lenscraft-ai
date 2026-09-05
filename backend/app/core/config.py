"""Validated environment configuration."""

from functools import lru_cache
from pathlib import Path
from typing import Literal
from uuid import UUID

from pydantic import AnyHttpUrl, Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )

    app_name: str = Field(default="lenscraft-backend", min_length=1)
    environment: Literal["development", "testing", "staging", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    cors_origins: list[str] = Field(default_factory=list)
    supabase_url: AnyHttpUrl | None = None
    supabase_key: SecretStr = SecretStr("")
    supabase_timeout_seconds: float = Field(default=10, gt=0, le=60)
    agent_company_id: UUID | None = None
    # Reserved for future integrations.
    retell_api_key: SecretStr = SecretStr("")
    openai_api_key: SecretStr = SecretStr("")

    @field_validator("agent_company_id", mode="before")
    @classmethod
    def empty_agent_company_id(cls, value: object) -> object:
        return None if isinstance(value, str) and not value.strip() else value

    @field_validator("supabase_url", mode="before")
    @classmethod
    def empty_supabase_url(cls, value: object) -> object:
        return None if isinstance(value, str) and not value.strip() else value

    @field_validator("supabase_url")
    @classmethod
    def validate_supabase_url(cls, value: AnyHttpUrl | None) -> AnyHttpUrl | None:
        if value and (value.username or value.password or value.query or value.fragment):
            raise ValueError("SUPABASE_URL must not contain credentials, query parameters, or fragments")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
