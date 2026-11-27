"""
THE CONTRACT. Phase 3 imports from here and never reaches into the tagger.
Freeze this once your eval passes.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

Slot      = Literal["top", "outer", "bottom", "full", "shoes"]
Pattern   = Literal["solid", "striped", "checked", "floral", "graphic", "patterned"]
Formality = Literal["casual", "smart_casual", "formal", "athletic"]
Season    = Literal["warm", "mild", "cold"]
Fit       = Literal["slim", "regular", "oversized"]
Source    = Literal["model", "user_corrected"]
Route     = Literal["auto", "review", "ask"]


class Color(BaseModel):
    name:  str
    hex:   str
    share: float = Field(ge=0.0, le=1.0)


class Attributes(BaseModel):
    pattern:   Pattern
    formality: Formality
    season:    Season
    fit:       Fit


class Alternative(BaseModel):
    category:   str
    slot:       Slot
    confidence: float


class Item(BaseModel):
    """One wardrobe item. This is what Phase 3 consumes."""
    id:         str
    user_id:    str
    created_at: str

    image_url:  str
    thumb_url:  str

    category:   str
    slot:       Slot
    attributes: Attributes
    colors:     list[Color]

    confidence: float
    margin:     float
    source:     Source

    class Config:
        from_attributes = True


class UploadResponse(BaseModel):
    """Returned by POST /items. Carries UI hints alongside the item."""
    item:            Item
    route:           Route
    alternatives:    list[Alternative] = []
    duplicate_of:    Optional[str] = None
    duplicate_score: float = 0.0
    warnings:        list[str] = []


class ItemUpdate(BaseModel):
    """PATCH body. Any field present overwrites; sets source=user_corrected."""
    category:  Optional[str] = None
    slot:      Optional[Slot] = None
    pattern:   Optional[Pattern] = None
    formality: Optional[Formality] = None
    season:    Optional[Season] = None
    fit:       Optional[Fit] = None


class ErrorResponse(BaseModel):
    code:    str
    message: str
