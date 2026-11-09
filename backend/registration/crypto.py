"""Independent proofs. Never log the inputs or persist the returned delivery secrets."""
from dataclasses import dataclass, field
import hashlib
import hmac
import secrets
from uuid import UUID, uuid4


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def keyed(pepper: bytes, purpose: str, *parts: str) -> str:
    # Length-delimited components prevent ambiguity or cross-purpose reuse.
    message = ''.join(f'{len(p)}:{p}' for p in (purpose, *parts)).encode()
    return hmac.new(pepper, message, hashlib.sha256).hexdigest()


def replacement_attempt(pepper: bytes, previous: UUID, capability: str) -> UUID:
    """Recover the ID of one resend using its original binding, never its proofs."""
    value = keyed(pepper, 'resend-attempt', str(previous), capability)
    return UUID(hex=value[:32], version=4)


@dataclass(frozen=True, repr=False)
class Proofs:
    attempt: UUID = field(default_factory=uuid4)
    capability: str = field(default_factory=lambda: secrets.token_urlsafe(32))
    link: str = field(default_factory=lambda: secrets.token_urlsafe(32))
    otp: str = field(default_factory=lambda: f'{secrets.randbelow(1_000_000):06d}')

    def hashes(self, pepper: bytes, email: str) -> dict:
        return {'p_attempt': str(self.attempt), 'p_session': digest(self.capability),
                'p_link': digest(self.link),
                'p_otp': keyed(pepper, 'otp', str(self.attempt), email, self.otp),
                'p_email_mac': keyed(pepper, 'email', email)}
