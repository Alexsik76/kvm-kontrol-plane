"""
core/config.py

Centralised configuration loaded from environment variables / .env file.
Uses pydantic-settings so every setting is type-validated at startup.

Usage
-----
    from core.config import settings
    db_url = settings.DATABASE_URL
"""

from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings — all values come from environment variables.

    pydantic-settings reads them in this priority order:
        1. Environment variables (highest)
        2. .env file in the current working directory
        3. Default values defined here (lowest)
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # silently ignore unknown env vars
    )

    # --- Application ---
    APP_TITLE: str = "IP-KVM Control Plane"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # --- CORS ---
    # Accepts a comma-separated string from the env; validated into a list below
    CORS_ORIGINS: str = "http://localhost:3000,https://kvm.lab.vn.ua"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors(cls, v: str) -> str:  # kept as str; split in property
        return v

    @property
    def cors_origins_list(self) -> List[str]:
        """Return CORS_ORIGINS as a list of stripped origin strings."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    # --- Database ---
    DATABASE_URL: str  # required — no default; must be set in env

    # --- JWT ---
    JWT_SECRET_KEY: str  # required — generate with: openssl rand -hex 32
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # --- First Superuser (used by db/init_db.py) ---
    FIRST_SUPERUSER: str = "admin"
    FIRST_SUPERUSER_EMAIL: str = "admin@kvm.local"
    FIRST_SUPERUSER_PASSWORD: str  # required

    # --- Node Health Poller ---
    NODE_POLL_INTERVAL_SECONDS: int = 15
    NODE_HTTP_TIMEOUT_SECONDS: int = 5

    # --- Cloudflare Tunnels ---
    # Public HTTPS URL of this Control-Plane API (used in CORS, docs, etc.)
    KVM_API_TUNNEL_URL: str = "https://kvm-api.lab.vn.ua"
    # Default Cloudflare Tunnel HTTPS URL for RPi nodes.
    # Used as fallback when a node's tunnel_url field is empty.
    # Leave empty to force per-node configuration.
    NODE_DEFAULT_TUNNEL_URL: str = "https://pi4.lab.vn.ua"

    # --- MediaMTX Node Authentication ---
    MEDIAMTX_USERNAME: str = "pi_admin"  # Default placeholder
    MEDIAMTX_PASSWORD: str = "pi_secure_pass"  # Default placeholder


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached Settings singleton.

    Using lru_cache ensures the .env file is read only once, making the
    settings object cheap to import anywhere in the application.
    """
    return Settings()


# Module-level convenience alias so callers can do `from core.config import settings`
settings: Settings = get_settings()
