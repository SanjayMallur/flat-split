from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from functools import lru_cache
import json


class Settings(BaseSettings):
    PROJECT_NAME: str = "Generated App"
    VERSION: str = "1.0.0"

    # Observability / Debugging
    # - DEBUG=true enables more verbose logs and more detailed 500 responses
    # - LOG_LEVEL controls Python logging level (e.g., DEBUG, INFO, WARNING, ERROR)
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # CORS
    # Environment-driven allowlist of origins.
    # - "*" allows all origins (dev/preview)
    # - Comma-separated: "https://a.com,https://b.com"
    # - Or JSON array: '["https://a.com","https://b.com"]'
    CORS_ALLOW_ORIGINS: str = "*"

    # Server Configuration
    # These can be overridden via environment variables or .env file
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8003  # Use 8003 for generated apps (API=8001, Worker=8002)

    # MongoDB Database
    # Connection URI (mongodb:// or mongodb+srv://)
    MONGODB_URL: str = Field(
        default="mongodb://localhost:27017",
        description="MongoDB connection URI (mongodb:// or mongodb+srv://)"
    )
    # Database name for this application
    MONGODB_DATABASE: str = Field(
        default="naapy_generated_app",
        description="MongoDB database name for this application"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )

    @property
    def cors_allow_origins_list(self) -> list[str]:
        value = (self.CORS_ALLOW_ORIGINS or "*").strip()
        if not value or value == "*":
            return ["*"]
        if value.startswith("["):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list) and all(isinstance(x, str) for x in parsed):
                    return [x.strip() for x in parsed if x.strip()]
            except Exception:
                pass
        return [x.strip() for x in value.split(",") if x.strip()]

@lru_cache()
def get_settings():
    return Settings()
