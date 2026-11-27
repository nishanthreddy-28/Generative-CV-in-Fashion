from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator, field_validator

from app.contracts.wardrobe import Item


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Intent(StrictModel):
    occasion: str | None = Field(default=None, max_length=160)
    weather: str | None = Field(default=None, max_length=160)
    preferences: list[str] = Field(default_factory=list, max_length=12)
    required_ids: list[str] = Field(default_factory=list, max_length=4)
    required_categories: list[str] = Field(default_factory=list, max_length=4)
    excluded_ids: list[str] = Field(default_factory=list, max_length=100)
    count: int = Field(default=1, ge=1, le=5)
    outerwear: Literal["optional", "required", "excluded"] = "optional"
    another: bool = False

    @model_validator(mode="after")
    def consistent(self):
        if set(self.required_ids) & set(self.excluded_ids):
            raise ValueError("An item cannot be both required and excluded")
        if len(self.required_ids) != len(set(self.required_ids)):
            raise ValueError("Required items must be distinct")
        return self

    def contextual(self):
        return bool(self.occasion or self.weather or self.preferences)


class ChatRequest(StrictModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = Field(default=None, pattern=r"^[a-f0-9]{32}$")
    count: int | None = Field(default=None, ge=1, le=5)

    @field_validator("message")
    @classmethod
    def nonblank_message(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Enter a message before sending")
        return value


class SelectionEvidence(StrictModel):
    item_id: str
    action: Literal["require", "exclude"]
    quote: str = Field(min_length=1, max_length=300)


class Interpretation(StrictModel):
    action: Literal["recommend", "chat"] = "recommend"
    reply: str | None = Field(default=None, max_length=500)
    intent: Intent
    needs_clarification: bool
    clarification: str | None = Field(default=None, max_length=500)
    selections: list[SelectionEvidence] = Field(default_factory=list, max_length=104)

    @model_validator(mode="after")
    def clarification_contract(self):
        if self.action == "chat" and not (self.reply and self.reply.strip()):
            raise ValueError("A conversational response requires a reply")
        if not self.needs_clarification:
            self.clarification = None
        elif not self.clarification or not self.clarification.strip():
            raise ValueError("A clarification decision requires a question")
        return self


class Assessment(StrictModel):
    candidate_id: str
    decision: Literal["suitable", "unsuitable", "unknown"]
    reason: str = Field(min_length=1, max_length=400)


class Assessments(StrictModel):
    assessments: list[Assessment] = Field(max_length=12)


class Outfit(StrictModel):
    id: str
    items: list[Item]
    ranking_score: float
    explanation: str
    fit_notes: list[str] = Field(default_factory=list)


class RecommendationResponse(StrictModel):
    status: Literal["recommended", "no_match", "needs_clarification", "unavailable", "chat"]
    message: str
    intent: Intent
    outfits: list[Outfit] = Field(default_factory=list)
    conversation_id: str | None = None
    model_version: str | None = None
    warnings: list[str] = Field(default_factory=list)
