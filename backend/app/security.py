import asyncio
import time
from dataclasses import dataclass, field
from uuid import UUID

import httpx
import jwt

from .config import Settings
from .errors import DependencyUnavailable, Unauthorized


@dataclass(frozen=True)
class Principal:
    user_id: UUID
    expires_at: int
    access_token: str = field(repr=False)
    session_id: UUID | None = None


class JWTVerifier:
    """Fixed-origin async JWKS verification. No Auth sessions or refresh tokens."""

    def __init__(self, settings: Settings, transport: httpx.AsyncClient):
        self.settings = settings
        self.transport = transport
        self._keys: dict[str, jwt.PyJWK] = {}
        self._expires = 0.0
        self._next_refresh = 0.0
        self._lock = asyncio.Lock()

    async def _key(self, kid: str) -> jwt.PyJWK:
        async with self._lock:
            now = time.monotonic()
            if now < self._expires and kid in self._keys:
                return self._keys[kid]
            if now < self._next_refresh:
                if now >= self._expires:
                    raise DependencyUnavailable()
                raise Unauthorized()
            # Bound unknown-kid requests and failure retries without using stale expired keys.
            self._next_refresh = now + 10
            try:
                response = await self.transport.get(
                    f"{self.settings.issuer}/.well-known/jwks.json",
                    timeout=5, follow_redirects=False,
                )
                response.raise_for_status()
                if len(response.content) > 100_000:
                    raise ValueError("Oversized JWKS")
                document = response.json()
                keys = {}
                for item in document["keys"]:
                    if item.get("alg") not in self.settings.jwt_algorithms or item.get("use", "sig") != "sig":
                        continue
                    if item.get("key_ops") and "verify" not in item["key_ops"]:
                        continue
                    key = jwt.PyJWK.from_dict(item)
                    if not key.key_id or key.key_id in keys:
                        raise ValueError("Invalid JWKS key IDs")
                    keys[key.key_id] = key
                if not keys:
                    raise ValueError("No supported public signing keys")
                self._keys = keys
                self._expires = now + self.settings.jwks_ttl_seconds
            except (httpx.HTTPError, ValueError, KeyError, TypeError, jwt.PyJWTError):
                raise DependencyUnavailable() from None
            if kid not in self._keys:
                raise Unauthorized()
            return self._keys[kid]

    async def verify(self, token: str) -> Principal:
        if not token or len(token) > 16384:
            raise Unauthorized()
        try:
            header = jwt.get_unverified_header(token)
            if header.get("alg") not in self.settings.jwt_algorithms or not isinstance(header.get("kid"), str):
                raise Unauthorized()
            key = await self._key(header["kid"])
            if key.algorithm_name != header["alg"]:
                raise Unauthorized()
            claims = jwt.decode(
                token, key.key, algorithms=list(self.settings.jwt_algorithms),
                audience=self.settings.jwt_audience, issuer=self.settings.issuer,
                leeway=self.settings.jwt_leeway_seconds,
                options={"require": ["exp", "iat", "sub", "iss", "aud", "role"]},
            )
            if claims["role"] != "authenticated" or claims.get("is_anonymous", False) is not False:
                raise Unauthorized()
            if not isinstance(claims["exp"], int) or isinstance(claims["exp"], bool):
                raise Unauthorized()
            return Principal(
                UUID(claims["sub"]), claims["exp"], token,
                UUID(claims["session_id"]) if claims.get("session_id") else None,
            )
        except (jwt.PyJWTError, ValueError, TypeError, KeyError):
            raise Unauthorized() from None
