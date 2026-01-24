from typing import Optional
from pydantic import computed_field
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
    )


settings = Settings()

