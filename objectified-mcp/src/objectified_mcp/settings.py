"""Environment-backed settings for the MCP server process."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
Transport = Literal["stdio", "http"]


class Settings(BaseSettings):
    """Configuration loaded when ``objectified-mcp serve`` starts (fail-fast validation)."""

    model_config = SettingsConfigDict(
        env_prefix="OBJECTIFIED_MCP_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    database_url: PostgresDsn = Field(
        ...,
        description="PostgreSQL connection URI for the Objectified database.",
    )
    internal_secret: SecretStr = Field(
        ...,
        min_length=16,
        description="Secret material for internal signing (e.g. HMAC, session derivation).",
    )
    log_level: LogLevel = Field(default="INFO")
    transport: Transport = Field(default="stdio")
    http_host: str = Field(default="127.0.0.1", min_length=1)
    http_port: int = Field(default=8765, ge=1, le=65535)

    @field_validator("log_level", mode="before")
    @classmethod
    def normalize_log_level(cls, value: object) -> str:
        if isinstance(value, str):
            return value.upper()
        return str(value).upper()


@lru_cache
def get_settings() -> Settings:
    """Return process-wide settings (parsed once per interpreter)."""
    # Required fields are populated from the environment by pydantic-settings.
    return Settings()  # type: ignore[call-arg]
