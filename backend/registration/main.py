"""Run separately: uvicorn registration.main:app --no-access-log.

Disabled by default. Ordinary application operations never use this process/key.
No hosted execution is authorized merely by importing this module.
"""
from contextlib import asynccontextmanager
import hmac
from urllib.parse import urlencode
from uuid import UUID
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator
from starlette.middleware.cors import CORSMiddleware
from .adapters import Mailer, PasswordPolicy, TrustedGateway, Unavailable
from .config import RegistrationSettings
from .crypto import Proofs, digest, keyed, replacement_attempt


class RegistrationEmail(BaseModel):
    model_config = ConfigDict(extra='forbid', hide_input_in_errors=True)
    email: str = Field(max_length=254)

    @field_validator('email')
    @classmethod
    def valid_email(cls, value):
        import re
        value = value.strip().lower()
        if not re.fullmatch(r'[^\s@<>\x00-\x1f]+@[^\s@<>\x00-\x1f]+\.[^\s@<>\x00-\x1f]+', value):
            raise ValueError('Enter a valid email address.')
        return value


class Bound(BaseModel):
    model_config = ConfigDict(extra='forbid', hide_input_in_errors=True)
    attemptId: UUID
    capability: SecretStr = Field(min_length=43, max_length=43)


class Finalize(Bound):
    password: SecretStr
    confirmPassword: SecretStr


class LinkProof(Bound):
    link: SecretStr = Field(min_length=43, max_length=43)


class CodeProof(Bound):
    code: SecretStr = Field(min_length=6, max_length=6)


def create_registration_app(settings=None, *, gateway=None, mailer=None, policy=None):
    configured = settings or RegistrationSettings()

    @asynccontextmanager
    async def lifespan(app):
        async with httpx.AsyncClient(timeout=15, follow_redirects=False) as client:
            app.state.gateway = gateway or TrustedGateway(configured, client)
            app.state.mailer = mailer or Mailer(configured)
            app.state.policy = policy
            if configured.enabled and policy is None:
                app.state.policy = PasswordPolicy(configured.password_blocklist_file, configured.password_blocklist_sha256)
            yield

    app = FastAPI(title='Drape & Drop registration', lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=configured.allowed_origins,
        allow_methods=['POST'], allow_headers=['Content-Type'], allow_credentials=False)

    @app.middleware('http')
    async def security_boundary(request, call_next):
        if request.method != 'OPTIONS':
            if not configured.enabled:
                return JSONResponse({'detail': 'Registration is not available yet.'}, status_code=503)
            # These endpoints are JSON POST-only. Proofs never appear in request URLs.
            if request.method != 'POST':
                return JSONResponse({'detail': 'Use the registration form.'}, status_code=405)
            if request.headers.get('content-type', '').split(';')[0] != 'application/json':
                return JSONResponse({'detail': 'JSON required.'}, status_code=415)
            received = bytearray()
            async for part in request.stream():
                received.extend(part)
                if len(received) > 8192:
                    return JSONResponse({'detail': 'Request too large.'}, status_code=413)
            request._body = bytes(received)
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store'
        response.headers['Referrer-Policy'] = 'no-referrer'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        return response

    @app.exception_handler(RequestValidationError)
    async def validation(request, error):
        # FastAPI's default validation response includes rejected input, including secrets.
        return JSONResponse({'detail': 'Check the required registration fields.'}, status_code=422)

    @app.exception_handler(Unavailable)
    async def unavailable(request, error):
        return JSONResponse({'detail': 'Verification is unavailable. Please try again.'}, status_code=503)

    async def limit(request: Request, scope: str, value: str, maximum: int):
        mac = keyed(configured.pepper.get_secret_value().encode(), 'rate:' + scope, value)
        if await request.app.state.gateway.rpc('registration_rate',
                {'p_scope': scope, 'p_key': mac, 'p_limit': maximum}) is not True:
            raise HTTPException(429, 'Please wait before trying again.', headers={'Retry-After': '60'})

    async def client_limit(request):
        # Trust only the ASGI server's configured peer. Never parse arbitrary forwarded headers.
        await limit(request, 'network', request.client.host if request.client else 'unknown', 100)

    def binding(body):
        return {'p_attempt': str(body.attemptId), 'p_session': digest(body.capability.get_secret_value())}

    async def lookup(request, body, *, recover_resend=False):
        await client_limit(request)
        capability = body.capability.get_secret_value()
        await limit(request, 'session', capability, 30)
        gateway = request.app.state.gateway
        query = binding(body)
        result = await gateway.rpc('registration_lookup', query)
        if result is None and recover_resend:
            # The original row no longer has a binding after rotation. Only status
            # may follow it; proof and finalization calls still target an exact ID.
            successor = replacement_attempt(configured.pepper.get_secret_value().encode(), body.attemptId, capability)
            result = await gateway.rpc('registration_lookup', {**query, 'p_attempt': str(successor)})
            if isinstance(result, dict):
                return result, successor
        if not isinstance(result, dict):
            raise HTTPException(400, 'This verification is invalid or expired. Request a new email.')
        return (result, None) if recover_resend else result

    async def deliver(request, email, proofs):
        # URL fragment stays out of HTTP access logs/Referer headers. No capability in email.
        link = configured.web_origin + '/verify-registration#' + urlencode({'attempt': str(proofs.attempt), 'link': proofs.link})
        try:
            await request.app.state.mailer.send(email, link, proofs.otp)
            return True
        except Unavailable:
            # Challenge remains durable. The original browser can request a fresh delivery.
            # Do not reveal account existence from a different duplicate/error response.
            return False

    @app.post('/auth/registration/start', status_code=202)
    async def start(body: RegistrationEmail, request: Request):
        await client_limit(request)
        await limit(request, 'address', body.email, 5)
        proofs = Proofs()
        args = {**proofs.hashes(configured.pepper.get_secret_value().encode(), body.email),
                'p_email': body.email, 'p_previous': None}
        if await request.app.state.gateway.rpc('registration_issue', args) is not True:
            raise Unavailable()
        dispatched = await deliver(request, body.email, proofs)
        return {'attemptId': str(proofs.attempt), 'capability': proofs.capability,
                'message': 'Check your inbox for the link and separate code.' if dispatched else 'Email delivery could not be confirmed. You can request a new email shortly.'}

    @app.post('/auth/registration/link')
    async def link(body: LinkProof, request: Request):
        record = await lookup(request, body)
        expected = record.get('link') or ''
        valid = hmac.compare_digest(digest(body.link.get_secret_value()), expected)
        accepted = await request.app.state.gateway.rpc('registration_prove',
            {**binding(body), 'p_kind': 'link', 'p_expected': expected, 'p_valid': valid})
        if accepted is not True:
            raise HTTPException(400, 'This verification is invalid or expired. Request a new email.')
        return {'status': 'link_verified'}

    @app.post('/auth/registration/verify')
    async def verify(body: CodeProof, request: Request):
        record = await lookup(request, body)
        expected = record.get('otp') or ''
        candidate = keyed(configured.pepper.get_secret_value().encode(), 'otp', str(body.attemptId), record['email'], body.code.get_secret_value())
        valid = body.code.get_secret_value().isascii() and body.code.get_secret_value().isdigit() and hmac.compare_digest(candidate, expected)
        if await request.app.state.gateway.rpc('registration_prove',
                {**binding(body), 'p_kind': 'otp', 'p_expected': expected, 'p_valid': valid}) is not True:
            raise HTTPException(400, 'The code is invalid, expired, or the email link has not been confirmed.')
        # No Auth admin confirmation on the proof request; retryable separate finalization step.
        return {'status': 'finalizing'}

    @app.post('/auth/registration/status')
    async def status(body: Bound, request: Request):
        record, successor = await lookup(request, body, recover_resend=True)
        state = record.get('state')
        if state not in {'pending','expired','locked','superseded','finalizing','complete'}:
            raise Unavailable()
        response = {'status': 'link_verified' if state == 'pending' and record.get('linkVerified') else state}
        if successor is not None:
            response['attemptId'] = str(successor)
        return response

    @app.post('/auth/registration/finalize')
    async def finalize(body: Finalize, request: Request):
        record = await lookup(request, body)
        if record.get('state') == 'complete':
            return {'status': 'complete'}
        if record.get('canFinalize') is not True:
            raise HTTPException(400, 'Verification is not ready to finish.')
        password = body.password.get_secret_value()
        email = record['email']
        if (not hmac.compare_digest(password.encode(), body.confirmPassword.get_secret_value().encode())
                or not request.app.state.policy.accepts(password, email)):
            raise HTTPException(422, 'Use a matching password that meets the password requirements and is not compromised.')
        gateway = request.app.state.gateway
        created = await gateway.create_user(email, password, body.attemptId)
        result = await gateway.rpc('registration_lookup', binding(body))
        if isinstance(result, dict) and result.get('state') == 'complete':
            return {'status': 'complete'}
        if not created:
            raise HTTPException(409, 'This address already has an account. Sign in or reset your password.')
        raise Unavailable()

    @app.post('/auth/registration/resend', status_code=202)
    async def resend(body: Bound, request: Request):
        record = await lookup(request, body)
        await limit(request, 'address', record['email'], 5)
        # Keep same browser capability, but rotate independent link and code/attempt.
        capability = body.capability.get_secret_value()
        pepper = configured.pepper.get_secret_value().encode()
        proofs = Proofs(attempt=replacement_attempt(pepper, body.attemptId, capability), capability=capability)
        args = {**proofs.hashes(pepper, record['email']),
                'p_email': record['email'], 'p_previous': str(body.attemptId)}
        if await request.app.state.gateway.rpc('registration_issue', args) is not True:
            raise HTTPException(429, 'Wait a minute before requesting a new email, or finish verification.', headers={'Retry-After': '60'})
        dispatched = await deliver(request, record['email'], proofs)
        return {'attemptId': str(proofs.attempt), 'capability': proofs.capability,
                'message': 'A fresh email has been requested. Earlier codes and links no longer work.' if dispatched else 'Email delivery could not be confirmed. Please try again shortly.'}

    return app


app = create_registration_app()
