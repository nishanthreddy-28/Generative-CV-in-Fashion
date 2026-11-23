"""Structured user-owned style preferences and recommendation feedback."""
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict, Field, StrictStr, ValidationError, field_validator, model_validator

from .errors import DependencyUnavailable
from .foundation import Data, rpc
from .recommendations import RecommendationRoute

Fit = Literal["Fitted", "Regular", "Relaxed", "Oversized"]
Occasion = Literal["Everyday", "Work", "Evening", "Weekend", "Special occasion"]
Sentiment = Literal["like", "dislike"]
Reason = Literal[
    "matches_style", "color_pairing", "occasion_match", "already_owned",
    "not_my_style", "color_mismatch", "wrong_occasion", "not_relevant", "other",
]


class PreferencePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    styleTags: list[StrictStr] | None = Field(default=None, max_length=20)
    colorTags: list[StrictStr] | None = Field(default=None, max_length=20)
    preferredFit: Fit | None = None
    preferredOccasions: list[Occasion] | None = Field(default=None, max_length=5)
    budgetMin: float | None = Field(default=None, ge=0, le=1_000_000, strict=True)
    budgetMax: float | None = Field(default=None, ge=0, le=1_000_000, strict=True)

    @field_validator("styleTags", "colorTags")
    @classmethod
    def clean_tags(cls, values):
        if values is None:
            return values
        cleaned = []
        seen = set()
        for value in values:
            value = value.strip()
            key = value.casefold()
            if not value or len(value) > 40 or key in seen:
                raise ValueError("Use unique, non-empty tags up to 40 characters.")
            seen.add(key)
            cleaned.append(value)
        return cleaned

    @field_validator("preferredOccasions")
    @classmethod
    def unique_occasions(cls, values):
        if values is not None and len(set(values)) != len(values):
            raise ValueError("Choose each occasion only once.")
        return values

    @field_validator("budgetMin", "budgetMax", mode="before")
    @classmethod
    def budget_precision(cls, value):
        if value is None:
            return value
        try:
            exact = Decimal(str(value))
            if exact != exact.quantize(Decimal("0.01")):
                raise ValueError("Use no more than two decimal places.")
        except InvalidOperation:
            raise ValueError("Enter a valid budget.") from None
        return value

    @model_validator(mode="after")
    def coherent_range(self):
        if self.budgetMin is not None and self.budgetMax is not None and self.budgetMin > self.budgetMax:
            raise ValueError("Minimum budget must not exceed maximum budget.")
        return self


class PreferenceRead(PreferencePatch):
    styleTags: list[StrictStr]
    colorTags: list[StrictStr]
    preferredFit: Fit | None
    preferredOccasions: list[Occasion]
    currency: Literal["INR"]


class FeedbackWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sentiment: Sentiment
    reasonCode: Reason
    note: Annotated[StrictStr, Field(max_length=1000)] = ""

    @field_validator("note")
    @classmethod
    def clean_note(cls, value):
        if "\x00" in value:
            raise ValueError("Use valid text.")
        return value.strip()


class FeedbackRead(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    recommendationId: UUID
    sentiment: Sentiment
    reasonCode: Reason
    note: str
    createdAt: datetime
    updatedAt: datetime

    @model_validator(mode="after")
    def timezone_aware(self):
        if self.createdAt.tzinfo is None or self.updatedAt.tzinfo is None:
            raise ValueError("Feedback timestamps must include a timezone.")
        return self


class FeedbackPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[FeedbackRead]


router = APIRouter(route_class=RecommendationRoute)


def validate_result(value, model):
    try:
        return model.model_validate(value)
    except (ValidationError, ValueError):
        raise DependencyUnavailable() from None


@router.get("/personalization/preferences", response_model=PreferenceRead)
async def read_personalization_preferences(data: Data):
    return validate_result(await rpc(data, "read_personalization_preferences", {}), PreferenceRead)


@router.patch("/personalization/preferences", response_model=PreferenceRead)
async def update_personalization_preferences(body: PreferencePatch, data: Data):
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(422, "Choose at least one preference to update.")
    return validate_result(await rpc(data, "update_personalization_preferences", {"p_changes": changes}), PreferenceRead)


@router.get("/recommendations/feedback", response_model=FeedbackPage)
async def list_feedback(data: Data, limit: Annotated[int, Query(ge=1, le=100)] = 50):
    return validate_result(await rpc(data, "list_recommendation_feedback", {"p_limit": limit}), FeedbackPage)


@router.put("/recommendations/{recommendation_id}/feedback", response_model=FeedbackRead)
async def upsert_feedback(recommendation_id: UUID, body: FeedbackWrite, data: Data):
    value = await rpc(data, "upsert_recommendation_feedback", {
        "p_id": str(recommendation_id),
        "p_sentiment": body.sentiment,
        "p_reason_code": body.reasonCode,
        "p_note": body.note,
    }, missing_detail="Recommendation not found.")
    return validate_result(value, FeedbackRead)


@router.delete("/recommendations/{recommendation_id}/feedback", status_code=204)
async def delete_feedback(recommendation_id: UUID, data: Data):
    await rpc(data, "delete_recommendation_feedback", {"p_id": str(recommendation_id)}, missing_detail="Feedback not found.")
    return Response(status_code=204)
