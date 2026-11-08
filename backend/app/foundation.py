"""The four existing profile/settings contracts supported by the foundation migration."""
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, StrictStr, ValidationError

from .data_api import UserDataAPI
from .dependencies import active_user_data
from .errors import DependencyUnavailable, Forbidden, Unauthorized


class ProfileWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Annotated[StrictStr, Field(min_length=1, max_length=200)]
    style: Annotated[StrictStr, Field(max_length=2000)] = ""
    location: Annotated[StrictStr, Field(max_length=200)] = ""
    bio: Annotated[StrictStr, Field(max_length=2000)] = ""


class ProfileRead(ProfileWrite):
    # Trusted bootstrap may have an incomplete empty name; the editor must still load.
    name: Annotated[StrictStr, Field(max_length=200)]


class Preferences(BaseModel):
    model_config = ConfigDict(extra="forbid")
    units: Literal["cm", "in", ""] = ""
    emailNotifications: Literal["Enabled", "Disabled", ""] = ""


router = APIRouter()
Data = Annotated[UserDataAPI, Depends(active_user_data)]


async def rpc(data: UserDataAPI, operation: str, body: dict, *, missing_detail: str | None = None, conflict_detail: str | None = None) -> object:
    response = await data.request("POST", f"rpc/{operation}", body=body)
    if response.status_code == 401:
        raise Unauthorized()
    if response.status_code == 403:
        raise Forbidden()
    if response.status_code not in (200, 204):
        try:
            code = response.json().get("code")
        except (ValueError, AttributeError):
            code = None
        if missing_detail and code == "P0002":
            raise HTTPException(404, missing_detail)
        if conflict_detail and code == "DD001":
            raise HTTPException(409, conflict_detail)
        if code == "23503":
            raise HTTPException(409, "Record is referenced by another record.")
        if response.status_code == 400 and code in ("22023", "22001", "23514"):
            raise HTTPException(422, "Invalid fields.")
        raise DependencyUnavailable()
    if response.status_code == 204:
        return None
    try:
        return response.json()
    except ValueError:
        raise DependencyUnavailable() from None


@router.get("/profile", response_model=ProfileRead)
async def read_profile(data: Data) -> ProfileRead:
    result = await rpc(data, "read_profile", {})
    try:
        return ProfileRead.model_validate(result)
    except ValidationError:
        raise DependencyUnavailable() from None


@router.patch("/profile", status_code=204)
async def update_profile(body: ProfileWrite, data: Data) -> Response:
    if not body.name.strip():
        raise HTTPException(422, "Name must not be blank.")
    await rpc(data, "update_profile", {f"p_{key}": value for key, value in body.model_dump().items()})
    return Response(status_code=204)


@router.get("/settings", response_model=Preferences)
async def read_preferences(data: Data) -> Preferences:
    result = await rpc(data, "read_preferences", {})
    try:
        # Require the full current editor representation, not a fabricated default
        # when the upstream service omitted its response fields.
        if not isinstance(result, dict) or set(result) != {"units", "emailNotifications"}:
            raise DependencyUnavailable()
        return Preferences.model_validate(result)
    except ValidationError:
        raise DependencyUnavailable() from None


@router.patch("/settings", status_code=204)
async def update_preferences(body: Preferences, data: Data) -> Response:
    await rpc(data, "update_preferences", {
        "p_units": body.units, "p_email_notifications": body.emailNotifications,
    })
    return Response(status_code=204)
