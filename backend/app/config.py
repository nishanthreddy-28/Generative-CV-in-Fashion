from urllib.parse import urlparse
from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore", hide_input_in_errors=True)
    ml_receipt_signing_key: SecretStr | None = None
    ml_worker_url: str | None = None
    ml_worker_token: SecretStr | None = None
    local_preview: bool = False
    supabase_url: str
    supabase_publishable_key: SecretStr
    jwt_audience: str = "authenticated"
    jwt_algorithms: tuple[str, ...] = ("ES256", "RS256")
    jwt_leeway_seconds: int = Field(default=15, ge=0, le=60)
    jwks_ttl_seconds: int = Field(default=300, ge=1, le=600)
    database_foundation_enabled: bool = False
    api_cors_origins: list[str] = []

    @field_validator("ml_worker_url")
    @classmethod
    def private_worker_url(cls, value):
        if value is None:
            return value
        parsed = urlparse(value)
        local = parsed.scheme == "http" and parsed.hostname in ("127.0.0.1", "::1", "localhost")
        if (not local and parsed.scheme != "https") or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
            raise ValueError("ML_WORKER_URL requires HTTPS or direct loopback HTTP")
        return value.rstrip("/")

    @field_validator("ml_worker_token","ml_receipt_signing_key")
    @classmethod
    def private_worker_token(cls, value):
        if value is not None and len(value.get_secret_value()) < 32:
            raise ValueError("ML_WORKER_TOKEN requires at least 32 characters")
        return value

    @field_validator("api_cors_origins")
    @classmethod
    def explicit_origins(cls, values: list[str]) -> list[str]:
        for value in values:
            origin = urlparse(value)
            if (origin.scheme not in ("https", "http") or not origin.hostname or origin.username or origin.password
                    or origin.path or origin.query or origin.fragment
                    or (origin.scheme == "http" and origin.hostname not in ("localhost", "127.0.0.1", "::1"))):
                raise ValueError("CORS requires explicit HTTPS origins or local development loopback origins")
        return values

    @field_validator("supabase_url")
    @classmethod
    def secure_url(cls, value: str, info) -> str:
        parsed = urlparse(value)
        local = info.data.get("local_preview") is True
        if local and (parsed.scheme != "http" or parsed.hostname != "127.0.0.1" or parsed.port != 54321):
            raise ValueError("Local preview requires the isolated Supabase loopback endpoint")
        if (not local and parsed.scheme != "https") or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
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
