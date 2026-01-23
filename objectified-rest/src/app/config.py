from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    database_url: str = "postgresql://postgres:password@localhost:5432/objectified"
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = True

    # JWT settings (should match NextAuth secret)
    jwt_secret: str = "your-secret-key-here"  # Override via NEXTAUTH_SECRET env var
    jwt_algorithm: str = "HS256"

    class Config:
        env_file = ".env"
        case_sensitive = False
        # Allow NEXTAUTH_SECRET to be used for jwt_secret
        fields = {
            'jwt_secret': {
                'env': ['JWT_SECRET', 'NEXTAUTH_SECRET']
            }
        }


settings = Settings()

