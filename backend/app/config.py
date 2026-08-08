from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    environment: str = "development"
    app_name: str = "Sistema de Assistencia API"
    api_prefix: str = "/api/v1"
    supabase_url: str
    supabase_publishable_key: str
    frontend_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:5173"]
    )
    equipment_encryption_key: str | None = None

    @field_validator("supabase_url")
    @classmethod
    def validate_supabase_url(cls, value: str) -> str:
        clean = value.strip().rstrip("/")
        if not clean.startswith("https://") or ".supabase.co" not in clean:
            raise ValueError("SUPABASE_URL deve ter o formato https://<projeto>.supabase.co")
        return clean

    @field_validator("supabase_publishable_key")
    @classmethod
    def validate_publishable_key(cls, value: str) -> str:
        clean = value.strip()
        if not clean:
            raise ValueError("SUPABASE_PUBLISHABLE_KEY não pode ficar vazia")
        return clean

    @field_validator("frontend_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip().rstrip("/") for item in value.split(",") if item.strip()]
        return value

    @property
    def supabase_issuer(self) -> str:
        return f"{self.supabase_url}/auth/v1"

    @property
    def supabase_jwks_url(self) -> str:
        return f"{self.supabase_issuer}/.well-known/jwks.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
