"""Owner-scoped body editor contracts; optional PATCH fields are never default writes."""
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from pydantic import BaseModel, ConfigDict, Field, StrictStr, ValidationError, field_validator

from .errors import DependencyUnavailable
from .foundation import Data, rpc


Measurement = Annotated[Decimal, Field(ge=1, le=300, decimal_places=4, allow_inf_nan=False)]
ShortText = Annotated[StrictStr, Field(max_length=200)]
Units = Literal["cm", "in"]
Undertone = Literal["Warm", "Cool", "Neutral", "Not sure"]
Fit = Literal["Fitted", "Regular", "Relaxed", "Oversized"]


class BodyPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    units: Units | None = None
    height: Measurement | None = None
    chest: Measurement | None = None
    waist: Measurement | None = None
    hips: Measurement | None = None
    inseam: Measurement | None = None
    bodyShape: ShortText | None = None
    skinTone: ShortText | None = None
    undertone: Undertone | Literal[""] | None = None
    fit: Fit | Literal[""] | None = None

    @field_validator("height", "chest", "waist", "hips", "inseam", mode="before")
    @classmethod
    def json_numbers_only(cls, value: object) -> object:
        if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float, Decimal))):
            raise ValueError("Measurements must be JSON numbers or null.")
        return value


class BodyRead(BaseModel):
    # Require the complete actual editor representation; never fabricate missing fields.
    model_config = ConfigDict(extra="forbid")
    units: Units | Literal[""]
    height: Annotated[float | None, Field(ge=1, le=300, allow_inf_nan=False, strict=True)]
    chest: Annotated[float | None, Field(ge=1, le=300, allow_inf_nan=False, strict=True)]
    waist: Annotated[float | None, Field(ge=1, le=300, allow_inf_nan=False, strict=True)]
    hips: Annotated[float | None, Field(ge=1, le=300, allow_inf_nan=False, strict=True)]
    inseam: Annotated[float | None, Field(ge=1, le=300, allow_inf_nan=False, strict=True)]
    bodyShape: ShortText
    skinTone: ShortText
    undertone: Undertone | Literal[""]
    fit: Fit | Literal[""]


class BodyRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def validated(request: Request) -> Response:
            try:
                return await handler(request)
            except RequestValidationError:
                # Do not echo personal measurements or non-finite JSON inputs in errors.
                raise HTTPException(422, "Invalid body profile fields.") from None

        return validated


router = APIRouter(route_class=BodyRoute)


@router.get("/profile/body", response_model=BodyRead)
async def read_body_profile(data: Data) -> BodyRead:
    result = await rpc(data, "read_body_profile", {}, missing_detail="Body profile not found.")
    try:
        return BodyRead.model_validate(result)
    except ValidationError:
        raise DependencyUnavailable() from None


@router.patch("/profile/body", status_code=204)
async def update_body_profile(body: BodyPatch, data: Data) -> Response:
    changes = body.model_dump(exclude_unset=True)
    # Decimal is for validation; the existing HTTP adapter must send JSON numbers.
    changes = {key: float(value) if isinstance(value, Decimal) else value for key, value in changes.items()}
    await rpc(data, "update_body_profile", {"p_changes": changes}, missing_detail="Body profile not found.")
    return Response(status_code=204)
