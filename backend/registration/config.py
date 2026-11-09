from pathlib import Path
from urllib.parse import urlparse
from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class RegistrationSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix='DD_REGISTRATION_', env_file=None,
                                     extra='ignore', hide_input_in_errors=True)
    enabled: bool = False
    local_preview: bool = False
    project_ref: str = ''
    supabase_url: str = ''
    secret_key: SecretStr = SecretStr('')
    pepper: SecretStr = SecretStr('')
    web_origin: str = ''
    allowed_origins: list[str] = []
    smtp_host: str = ''
    smtp_port: int = Field(default=465, ge=1, le=65535)
    smtp_username: SecretStr = SecretStr('')
    smtp_password: SecretStr = SecretStr('')
    sender: str = ''
    password_blocklist_file: Path | None = None
    password_blocklist_sha256: str = ''

    @field_validator('web_origin', 'allowed_origins')
    @classmethod
    def origins(cls, value, info):
        for item in value if isinstance(value, list) else ([value] if value else []):
            url = urlparse(item)
            local = info.data.get('local_preview') is True and url.scheme == 'http' and url.hostname == 'localhost'
            if ((not local and url.scheme != 'https') or not url.hostname or url.username or url.password
                    or url.path or url.query or url.fragment):
                raise ValueError('An exact HTTPS origin is required')
        return value

    @model_validator(mode='after')
    def rollout(self):
        if self.enabled:
            if self.local_preview:
                upstream_ok = (self.project_ref == 'dd-registration-local'
                    and self.supabase_url == 'http://127.0.0.1:54321'
                    and self.smtp_host == '127.0.0.1' and self.smtp_port == 54325
                    and self.web_origin.startswith('http://localhost:')
                    and self.allowed_origins == [self.web_origin])
            else:
                upstream_ok = (bool(self.project_ref)
                    and self.supabase_url == f'https://{self.project_ref}.supabase.co'
                    and bool(self.smtp_host and self.smtp_username.get_secret_value() and self.smtp_password.get_secret_value()))
            if (not upstream_ok or not self.secret_key.get_secret_value().startswith('sb_secret_')
                    or len(self.pepper.get_secret_value().encode()) < 32
                    or not self.web_origin or self.web_origin not in self.allowed_origins
                    or '\r' in self.sender or '\n' in self.sender or '@' not in self.sender
                    or not self.password_blocklist_file or len(self.password_blocklist_sha256) != 64):
                raise ValueError('Private registration prerequisites are incomplete')
        return self
