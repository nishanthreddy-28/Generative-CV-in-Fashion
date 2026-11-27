"""Explicit preferences used before shortlisting and during visual assessment."""
import json
from typing import Annotated, Literal

from pydantic import Field

from app.persistence import conversations as store
from app.contracts.styling import StrictModel
from app.contracts.styling import Intent
from app.pose.models import BodyAnalysis

Preference = Annotated[str, Field(min_length=1, max_length=80)]


class Profile(StrictModel):
    body_analysis: BodyAnalysis | None = None
    styles: list[Preference] = Field(default_factory=list, max_length=8)
    liked_colors: list[Preference] = Field(default_factory=list, max_length=12)
    avoided_colors: list[Preference] = Field(default_factory=list, max_length=12)
    fit: Literal["slim", "regular", "oversized"] | None = None
    notes: str = Field(default="", max_length=500)
    comfort: str = Field(default="", max_length=300)
    height_cm: float | None = Field(default=None, ge=80, le=250)
    chest_cm: float | None = Field(default=None, ge=40, le=250)
    waist_cm: float | None = Field(default=None, ge=35, le=250)
    hips_cm: float | None = Field(default=None, ge=40, le=250)


class Feedback(StrictModel):
    item_ids: list[str] = Field(min_length=2, max_length=4)
    liked: bool


def feedback_scores(user_id):
    with store.connection() as conn:
        rows = conn.execute("SELECT outfit_id,liked FROM outfit_feedback WHERE user_id=?", (user_id,)).fetchall()
    return {row["outfit_id"]: .06 if row["liked"] else -.06 for row in rows}


def read(user_id):
    with store.connection() as conn:
        row = conn.execute("SELECT data FROM profiles WHERE user_id=?", (user_id,)).fetchone()
    return Profile.model_validate_json(row["data"]) if row else Profile()


def save(user_id, profile):
    with store.connection() as conn:
        conn.execute("INSERT INTO profiles VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data",
                     (user_id, profile.model_dump_json()))
    return profile


def contextual_intent(intent, profile):
    preferences = list(intent.preferences)
    if profile.body_analysis:
        from app.pose.models import context
        preferences.append(context(profile.body_analysis))
    if profile.styles:
        preferences.append("Saved style preferences (current request takes priority): " + ", ".join(profile.styles))
    if profile.fit:
        preferences.append("Saved fit preference: " + profile.fit)
    if profile.liked_colors:
        preferences.append("Preferred colours: " + ", ".join(profile.liked_colors))
    if profile.avoided_colors:
        preferences.append("Usually avoids colours: " + ", ".join(profile.avoided_colors))
    if profile.notes:
        preferences.append("Saved preferences (current request takes priority): " + profile.notes)
    if profile.comfort:
        preferences.append("Comfort requirements: " + profile.comfort)
    measurements = {name: value for name, value in profile.model_dump().items() if name.endswith("_cm") and value is not None}
    if measurements:
        preferences.append("User-supplied body measurements in cm: " + json.dumps(measurements)
                           + ". Use only as context for their requested silhouette. Garment measurements are unknown. "
                           "Do not certify physical fit or infer body-shape labels.")
    # Keep conversation state independent from profile changes between messages.
    return Intent.model_validate({**intent.model_dump(), "preferences": bounded_context(preferences)})


def bounded_context(preferences):
    """Preserve every explicit constraint and saved context within 12 entries."""
    return preferences if len(preferences) <= 12 else preferences[:11] + ['\n'.join(preferences[11:])]


def affinity(items, profile):
    liked = {color.casefold() for color in profile.liked_colors}
    avoided = {color.casefold() for color in profile.avoided_colors}
    values = []
    for item in items:
        colors = {color["name"].casefold() for color in json.loads(item["colors"])}
        values.append((bool(colors & liked) - bool(colors & avoided)) * .04
                      + .02 * bool(profile.fit and item["fit"] == profile.fit))
    return sum(values) / max(1, len(values))
