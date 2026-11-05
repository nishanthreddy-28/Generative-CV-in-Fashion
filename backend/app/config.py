from urllib.parse import urlparse
from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")
    supabase_url: str
    supabase_publishable_key: SecretStr
    jwt_audience: str = "authenticated"
    jwt_algorithms: tuple[str, ...] = ("ES256", "RS256")
    jwt_leeway_seconds: int = Field(default=15, ge=0, le=60)
    jwks_ttl_seconds: int = Field(default=300, ge=1, le=600)

    @field_validator("supabase_url")
    @classmethod
    def secure_url(cls, value: str) -> str:
        parsed = urlparse(value)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
            raise ValueError("SUPABASE_URL must be an HTTPS project origin")
        return value.rstrip("/")

    @field_validator("supabase_publishable_key")
    @classmethod
    def public_key_only(cls, value: SecretStr) -> SecretStr:
        # Deliberately require the current publishable format; legacy keys need separate review.
        if not value.get_secret_value().startswith("sb_publishable_"):
            raise ValueError("Only a Supabase publishable key is allowed for user-scoped access")
        return value

    @field_validator("jwt_algorithms")
    @classmethod
    def asymmetric_only(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if not value or any(alg not in ("ES256", "RS256") for alg in value):
            raise ValueError("Only explicitly configured ES256/RS256 verification is supported")
        return value

    @property
    def issuer(self) -> str:
        return f"{self.supabase_url}/auth/v1"
