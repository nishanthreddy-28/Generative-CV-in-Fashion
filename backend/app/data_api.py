from dataclasses import dataclass
from typing import Any, Literal
import re
import time

import httpx

from .config import Settings
from .errors import DependencyUnavailable, Unauthorized
from .security import Principal


@dataclass(frozen=True)
class UserDataAPI:
    settings: Settings
    transport: httpx.AsyncClient
    principal: Principal

    async def request(
        self, method: Literal["GET", "POST", "PATCH", "DELETE"], resource: str,
        *, params: dict[str, str] | None = None, body: Any = None,
    ) -> httpx.Response:
        """Internal repository boundary, never a public arbitrary-resource proxy."""
        if not re.fullmatch(r"(?:rpc/)?[a-z][a-z0-9_]*", resource):
            raise ValueError("Invalid Data API resource")
        if self.principal.expires_at <= time.time():
            raise Unauthorized()
        # Build a fresh request. Never mutate shared headers, cookies or auth state.
        request = httpx.Request(
            method, f"{self.settings.supabase_url}/rest/v1/{resource}",
            headers={
                "apikey": self.settings.supabase_publishable_key.get_secret_value(),
                "Authorization": f"Bearer {self.principal.access_token}",
                "Accept": "application/json",
                **({"Accept-Profile" if method == "GET" else "Content-Profile": "api"}
                   if self.settings.database_foundation_enabled else {}),
            }, params=params, **({"json": body} if body is not None else {}),
            extensions={"timeout": {"connect": 5.0, "read": 10.0, "write": 10.0, "pool": 5.0}},
        )
        try:
            return await self.transport.send(request, auth=None, follow_redirects=False)
        except httpx.HTTPError:
            raise DependencyUnavailable() from None
        # Caller interprets status; never retries with an elevated credential.
