from typing import Optional

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database settings - can use DATABASE_URL directly or build from components
    database_url: Optional[str] = None
    postgres_user: str = "postgres"
    postgres_password: str = "password"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "objectified"

    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = True

    # JWT settings (should match NextAuth secret)
    # Can be set via JWT_SECRET or NEXTAUTH_SECRET env var
    jwt_secret: Optional[str] = None
    nextauth_secret: Optional[str] = None
    jwt_algorithm: str = "HS256"

    # Embedding (Ollama) for data_snapshot vectorization
    ollama_base_url: str = "http://localhost:11434"

    # Pre-commit policy default when project metadata omits maxCommitPayloadBytes (#2565)
    commit_policy_max_payload_bytes_default: int = 5_242_880

    # Fernet key (url-safe base64) from `Fernet.generate_key()` — encrypts webhook signing secrets at rest (#2588)
    webhook_signing_secret_encryption_key: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices(
            "OBJECTIFIED_WEBHOOK_SIGNING_SECRET_ENCRYPTION_KEY",
            "webhook_signing_secret_encryption_key",
        ),
    )

    # MCP internal resolve + revocation fan-out (#2824)
    internal_api_secret: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices(
            "OBJECTIFIED_INTERNAL_API_SECRET",
            "internal_api_secret",
        ),
    )
    redis_url: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices(
            "OBJECTIFIED_REDIS_URL",
            "redis_url",
        ),
    )

    @property
    def effective_database_url(self) -> str:
        """Get the database URL, preferring DATABASE_URL over building from components."""
        if self.database_url:
            return self.database_url
        return f"postgresql://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"

    @property
    def effective_jwt_secret(self) -> str:
        """Get the JWT secret, preferring NEXTAUTH_SECRET over JWT_SECRET."""
        return self.nextauth_secret or self.jwt_secret or "your-secret-key-here"

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
        populate_by_name=True,
    )


settings = Settings()

# Maximum number of HTTP delivery attempts before an event is moved to dead-letter.
# Shared by the delivery worker (push_webhook_delivery.py) and the DB query in database.py
# to ensure the retry policy is defined in exactly one place (#2588).
WEBHOOK_MAX_DELIVERY_ATTEMPTS: int = 4

