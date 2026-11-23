"""Owner-scoped private body-photo onboarding; analysis remains an explicit future integration."""
import hashlib
from decimal import Decimal, InvalidOperation
import logging
from typing import Annotated, Literal
from uuid import UUID

import anyio
import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from pydantic import BaseModel, ConfigDict, Field, StrictStr, ValidationError, field_validator
from starlette.datastructures import UploadFile
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.formparsers import MultiPartException

from .errors import DependencyUnavailable, Forbidden, Unauthorized
from .foundation import Data, rpc
from .wardrobe import MAX_IMAGE, MAX_REQUEST, normalize_image, storage

BUCKET = "onboarding-body-images"
logger = logging.getLogger(__name__)


class Review(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Annotated[StrictStr, Field(min_length=1, max_length=200)]
    location: Annotated[StrictStr, Field(max_length=200)] = ""
    units: Literal["cm", "in"]
    height: Annotated[float, Field(ge=1, le=300, allow_inf_nan=False, strict=True)] | None = None
    chest: Annotated[float, Field(ge=1, le=300, allow_inf_nan=False, strict=True)] | None = None
    waist: Annotated[float, Field(ge=1, le=300, allow_inf_nan=False, strict=True)] | None = None
    hips: Annotated[float, Field(ge=1, le=300, allow_inf_nan=False, strict=True)] | None = None
    inseam: Annotated[float, Field(ge=1, le=300, allow_inf_nan=False, strict=True)] | None = None

    @field_validator("name", "location")
    @classmethod
    def clean_text(cls, value: str) -> str:
        if "\x00" in value:
            raise ValueError("Invalid text")
        return value.strip()

    @field_validator("name")
    @classmethod
    def name_required(cls, value: str) -> str:
        if not value:
            raise ValueError("Name is required")
        return value

    @field_validator("height", "chest", "waist", "hips", "inseam")
    @classmethod
    def database_precision(cls, value: float | None) -> float | None:
        if value is None:
            return value
        try:
            exact = Decimal(str(value))
            if exact != exact.quantize(Decimal("0.0001")):
                raise ValueError("Use no more than four decimal places")
        except InvalidOperation:
            raise ValueError("Invalid measurement") from None
        return value


class OnboardingRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def safe(request: Request):
            try:
                return await handler(request)
            except RequestValidationError:
                raise HTTPException(422, "Invalid onboarding request.") from None
        return safe


router = APIRouter(route_class=OnboardingRoute)


async def onboarding_rpc(data: Data, operation: str, body: dict, *, missing: bool = False):
    return await rpc(data, operation, body,
                     missing_detail="Onboarding photo or draft not found." if missing else None,
                     conflict_detail="This onboarding draft conflicts with another upload." if missing else None)


def owner_object(data: Data, value: object) -> str:
    try:
        if not isinstance(value, str):
            raise ValueError
        owner, filename = value.split("/")
        if owner != str(data.principal.user_id) or not filename.endswith(".jpg"):
            raise ValueError
        UUID(filename[:-4])
        return value
    except (ValueError, AttributeError):
        raise DependencyUnavailable() from None


async def parse_photo(request: Request) -> bytes:
    raw = bytearray()
    async for chunk in request.stream():
        if len(raw) + len(chunk) > MAX_REQUEST:
            raise HTTPException(413, "Photo exceeds the 10 MB upload limit.")
        raw.extend(chunk)
    sent = False

    async def receive():
        nonlocal sent
        if sent:
            return {"type": "http.request", "body": b"", "more_body": False}
        sent = True
        return {"type": "http.request", "body": bytes(raw), "more_body": False}

    parsed = Request(request.scope, receive=receive)
    try:
        async with parsed.form(max_files=1, max_fields=0, max_part_size=MAX_IMAGE) as form:
            if len(list(form.multi_items())) != 1:
                raise HTTPException(422, "Choose one body photo.")
            upload = form.get("image")
            if not isinstance(upload, UploadFile):
                raise HTTPException(422, "Choose a valid body photo.")
            content = await upload.read(MAX_IMAGE + 1)
    except StarletteHTTPException as error:
        if error.status_code == 400:
            raise HTTPException(422, "Invalid photo upload form.") from None
        raise
    except MultiPartException:
        raise HTTPException(422, "Invalid photo upload form.") from None
    if not content or len(content) > MAX_IMAGE:
        raise HTTPException(413, "Photo exceeds the 10 MB upload limit.")
    return await anyio.to_thread.run_sync(normalize_image, content)


@router.get("/onboarding")
async def read_onboarding(data: Data):
    result = await onboarding_rpc(data, "onboarding_status", {})
    if not isinstance(result, dict) or result.get("processingAvailable") is not False:
        raise DependencyUnavailable()
    return result


@router.post("/onboarding/body-photo/{upload_id}", status_code=200)
async def upload_body_photo(upload_id: UUID, request: Request, data: Data):
    image = await parse_photo(request)
    digest = hashlib.sha256(image).hexdigest()
    info = await onboarding_rpc(data, "onboarding_image", {
        "p_id": str(upload_id), "p_sha256": digest, "p_byte_size": len(image),
    }, missing=True)
    expected = f"{data.principal.user_id}/{upload_id}.jpg"
    if not isinstance(info, dict) or info.get("id") != str(upload_id) or info.get("object") != expected \
            or info.get("sha256") != digest or info.get("byteSize") != len(image):
        raise DependencyUnavailable()
    path = owner_object(data, info["object"])
    if not info.get("present"):
        await storage(data, "POST", f"object/{BUCKET}/{path}", content=image)
    try:
        version = await onboarding_rpc(data, "finish_onboarding_upload", {"p_id": str(upload_id)}, missing=True)
    except (DependencyUnavailable, Unauthorized, Forbidden, HTTPException):
        # Leave the idempotent pending reservation so the same upload can be retried;
        # background retention only removes abandoned uploads after its grace period.
        logger.warning("Body photo confirmation remains incomplete; same draft can be retried.")
        raise
    return {"version": version, "imageUrl": f"/onboarding/body-photo/{upload_id}"}


@router.get("/onboarding/body-photo/{image_id}")
async def read_body_photo(image_id: UUID, data: Data):
    info = await onboarding_rpc(data, "onboarding_image", {"p_id": str(image_id)}, missing=True)
    if not isinstance(info, dict) or info.get("id") != str(image_id) or not info.get("present"):
        raise HTTPException(404, "Onboarding photo not found.")
    path = owner_object(data, info.get("object"))
    content = await storage(data, "GET", f"object/{BUCKET}/{path}")
    return StreamingResponse(iter([content]), media_type="image/jpeg", headers={
        "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    })


@router.post("/onboarding/body-photo/{image_id}/review")
async def review_onboarding(image_id: UUID, body: Review, data: Data):
    result = await onboarding_rpc(data, "review_onboarding", {
        "p_id": str(image_id), "p_values": body.model_dump(),
    }, missing=True)
    if not isinstance(result, dict) or result.get("id") != str(image_id) or result.get("state") != "reviewed":
        raise DependencyUnavailable()
    return result


@router.delete("/onboarding/body-photo/{image_id}", status_code=204)
async def discard_onboarding(image_id: UUID, data: Data):
    await onboarding_rpc(data, "discard_onboarding", {"p_id": str(image_id)}, missing=True)
    return Response(status_code=204)
