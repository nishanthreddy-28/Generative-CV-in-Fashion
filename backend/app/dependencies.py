from typing import Annotated, Protocol
from fastapi import Depends, Request

from .data_api import UserDataAPI
from .errors import DependencyUnavailable, Unauthorized
from .security import Principal


class AccountEligibility(Protocol):
    async def require_active(self, principal: Principal, data: UserDataAPI) -> None: ...


class UnconfiguredEligibility:
    async def require_active(self, principal: Principal, data: UserDataAPI) -> None:
        # Do not treat a valid JWT as proof an account is active.
        raise DependencyUnavailable()


async def verified_principal(request: Request) -> Principal:
    values = request.headers.getlist("authorization")
    if len(values) != 1:
        raise Unauthorized()
    parts = values[0].split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise Unauthorized()
    return await request.app.state.verifier.verify(parts[1])


async def active_user_data(
    request: Request, principal: Annotated[Principal, Depends(verified_principal)],
) -> UserDataAPI:
    data = UserDataAPI(request.app.state.settings, request.app.state.transport, principal)
    await request.app.state.eligibility.require_active(principal, data)
    return data
