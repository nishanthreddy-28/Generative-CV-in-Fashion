"""Trusted coordinator adapters. Never imported by ordinary user-scoped database code."""
import asyncio
from email.message import EmailMessage
import hashlib
from html import escape
from pathlib import Path
import re
import smtplib
import ssl
from uuid import UUID
import httpx
from .config import RegistrationSettings


class Unavailable(Exception):
    pass


class PasswordPolicy:
    def __init__(self, path: Path, expected_sha256: str):
        # Reviewed public breach corpus, not customer password material.
        if path.is_symlink() or path.stat().st_size > 64 * 1024 * 1024:
            raise Unavailable()
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != expected_sha256:
            raise Unavailable()
        self.hashes = set(data.decode('ascii').splitlines())
        if not self.hashes or any(not re.fullmatch('[a-fA-F0-9]{64}', h) for h in self.hashes):
            raise Unavailable()
        self.hashes = {h.lower() for h in self.hashes}

    def accepts(self, password: str, email: str) -> bool:
        normalized = re.sub('[^a-z0-9]', '', password.lower())
        identity = [p for p in re.split('[^a-z0-9]+', email.split('@')[0].lower()) if len(p) >= 3]
        predictable = ('password', 'qwerty', 'letmein', 'welcome', 'admin', '123456', 'abcdef')
        return (8 <= len(password) <= 200 and not any(ord(c) < 32 for c in password)
                and bool(re.search('[A-Z]', password)) and bool(re.search('[a-z]', password))
                and bool(re.search('[0-9]', password)) and bool(re.search(r'[^A-Za-z0-9\s]', password))
                and not any(p in normalized for p in (*predictable, *identity))
                and not re.search(r'(.)\1{3}|^(.{1,4})\1{2,}$', password)
                and hashlib.sha256(password.encode()).hexdigest() not in self.hashes)


class TrustedGateway:
    def __init__(self, settings: RegistrationSettings, client: httpx.AsyncClient):
        self.settings, self.client = settings, client

    async def request(self, method, path, body=None):
        try:
            response = await self.client.request(method, self.settings.supabase_url + path,
                json=body, headers={'apikey': self.settings.secret_key.get_secret_value(),
                                   'Content-Profile': 'api'}, follow_redirects=False)
            return response
        except httpx.HTTPError:
            raise Unavailable() from None

    async def rpc(self, operation: str, body: dict):
        if operation not in {'registration_rate', 'registration_issue', 'registration_lookup',
                'registration_prove',
                'registration_expire'}:
            raise Unavailable()
        response = await self.request('POST', '/rest/v1/rpc/' + operation, body)
        if response.status_code != 200:
            raise Unavailable()
        try:
            return response.json()
        except ValueError:
            raise Unavailable() from None

    async def create_user(self, email: str, password: str, attempt_id: UUID) -> bool:
        response = await self.request('POST', '/auth/v1/admin/users', {
            'email': email, 'password': password, 'email_confirm': True,
            'app_metadata': {'dd_registration_attempt': str(attempt_id)},
        })
        if response.status_code in (400, 409, 422):
            try:
                if response.json().get('error_code') in {'email_exists', 'user_already_exists'}:
                    return False
            except (ValueError, AttributeError):
                pass
        if response.status_code not in (200, 201):
            raise Unavailable()
        try:
            user = response.json()
            if user.get('email', '').lower() != email or not user.get('email_confirmed_at'):
                raise Unavailable()
            UUID(user['id'])
        except (ValueError, KeyError, TypeError, AttributeError):
            raise Unavailable() from None
        return True


class Mailer:
    def __init__(self, settings: RegistrationSettings):
        self.settings = settings

    async def send(self, email: str, link: str, code: str):
        # TLS-only SMTP. No customer input becomes a header without validation.
        message = EmailMessage()
        message['From'], message['To'], message['Subject'] = self.settings.sender, email, 'Your Drape & Drop verification'
        message.set_content(
            'Verify your email for Drape & Drop.\n\n'
            '1. Copy the verification link below into your original signup tab:\n'
            + link + '\n\n'
            '2. After confirming the link, enter this security code:\n'
            'Code: ' + code + '\n\n'
            'Both expire after 10 minutes. If you did not start registration, ignore this email.'
        )
        message.add_alternative(f"""
          <html><body style="background:#121212;color:#f5f0e9;padding:24px;font-family:Arial,sans-serif">
          <div style="max-width:480px;margin:auto">
          <p style="letter-spacing:3px;color:#dcc4a6">DRAPE &amp; DROP</p>
          <h1 style="font-family:Georgia,serif">Verify your email</h1>
          <h2>1. Confirm the link</h2>
          <p>Copy this link into the tab where you started registration.</p>
          <p><a style="color:#dcc4a6" href="{escape(link, quote=True)}">Verification link</a></p>
          <h2>2. Enter the security code</h2>
          <p>After confirming the link, enter this code in that same tab.</p>
          <p style="font-size:26px;letter-spacing:5px"><strong>{escape(code)}</strong></p>
          <p>Both expire after 10 minutes. Ignore this email if you did not start registration.</p>
          </div></body></html>
        """, subtype='html')

        def deliver():
            try:
                if self.settings.local_preview:
                    # Preview never sends to the internet. Capture the message in local Mailpit.
                    with smtplib.SMTP('127.0.0.1', 54325, timeout=10) as smtp:
                        smtp.send_message(message)
                    return
                with smtplib.SMTP_SSL(self.settings.smtp_host, self.settings.smtp_port,
                        timeout=15, context=ssl.create_default_context()) as smtp:
                    smtp.login(self.settings.smtp_username.get_secret_value(), self.settings.smtp_password.get_secret_value())
                    smtp.send_message(message)
            except (OSError, smtplib.SMTPException):
                raise Unavailable() from None
        await asyncio.to_thread(deliver)
