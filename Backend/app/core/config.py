from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "Omnichannel Backend"
    app_env: str = "local"
    api_prefix: str = "/api/v1"

    database_provider: Literal["memory", "postgres", "mongo"] = "memory"
    database_url: str | None = None
    realtime_provider: Literal["memory", "redis", "socketio"] = "memory"
    ai_provider: Literal["mock", "openai"] = "mock"

    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"

    jwt_secret: str = "change-me"

    bootstrap_enabled: bool = False
    bootstrap_secret: str = ""
    seed_demo_users: bool = False

    instagram_access_token: str | None = None
    instagram_account_id: str | None = None
    instagram_verify_token: str = "change-me"
    instagram_api_base_url: str = "https://graph.instagram.com"
    instagram_api_version: str = "v25.0"

    # Meta Page — Facebook Messenger (send, profile, webhooks)
    meta_page_access_token: str | None = None
    meta_page_id: str | None = None
    meta_webhook_verify_token: str | None = None
    instagram_business_account_id: str | None = None
    meta_graph_api_base_url: str = "https://graph.facebook.com"
    meta_graph_api_version: str = "v25.0"

    whatsapp_access_token: str | None = None
    whatsapp_business_account_id: str | None = None
    whatsapp_phone_number_id: str | None = None
    whatsapp_verify_token: str = "change-me"

    sms_provider: Literal["demo"] = "demo"

    email_provider: Literal["smtp_demo"] = "smtp_demo"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None
    smtp_from_name: str = "Support"
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False

    demo_channels_enabled: bool = True
    demo_channel_secret: str = ""

    def resolved_meta_webhook_verify_token(self) -> str:
        if self.meta_webhook_verify_token:
            return self.meta_webhook_verify_token
        return self.instagram_verify_token

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


def get_settings() -> Settings:
    return Settings()


def validate_bootstrap_settings(settings: Settings) -> None:
    if settings.bootstrap_enabled and not settings.bootstrap_secret.strip():
        raise ValueError(
            "BOOTSTRAP_SECRET is required when BOOTSTRAP_ENABLED=true. "
            "Set a strong secret in the environment before starting the server."
        )
