from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    twilio_account_sid: str
    twilio_auth_token: str
    twilio_from_number: str

    otp_length: int = 6
    otp_expire_minutes: int = 10
    otp_max_requests_per_window: int = 3
    otp_request_window_minutes: int = 60
    otp_max_verify_attempts: int = 3

    cors_origins: str = "*"
    admin_api_key: str = "change-me-to-a-secure-random-admin-key"

    sentry_dsn: str | None = None
    environment: str = "production"

    default_rate_limit: str = "60/minute"

    max_upload_size_mb: int = 5
    storage_backend: str = "local"
    upload_dir: str = "uploads"

    @property
    def cors_origin_list(self) -> List[str]:
        raw = self.cors_origins
        if not raw or raw == "*":
            return ["*"]
        return [origin.strip() for origin in raw.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
