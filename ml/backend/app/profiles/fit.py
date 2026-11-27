"""Compare user-entered circumferences. This is evidence, not a fit predictor."""
from pydantic import Field
from typing import Literal
from app.persistence import conversations as store
from app.contracts.styling import StrictModel


class GarmentMeasurements(StrictModel):
    preview_rotation: Literal[0, 90, 180, 270] = 0
    chest_cm: float | None = Field(default=None, ge=20, le=300)
    waist_cm: float | None = Field(default=None, ge=20, le=300)
    hips_cm: float | None = Field(default=None, ge=20, le=300)
    length_cm: float | None = Field(default=None, ge=5, le=250)


def read(user_id, item_id):
    with store.connection() as conn:
        row = conn.execute("SELECT data FROM garment_measurements WHERE user_id=? AND item_id=?", (user_id, item_id)).fetchone()
    return GarmentMeasurements.model_validate_json(row["data"]) if row else GarmentMeasurements()


def save(user_id, item_id, measurements):
    with store.connection() as conn:
        conn.execute("INSERT INTO garment_measurements VALUES(?,?,?) ON CONFLICT(user_id,item_id) DO UPDATE SET data=excluded.data", (user_id, item_id, measurements.model_dump_json()))
    return measurements


def notes(user_id, items, profile):
    return compare(items, profile, {item["id"]: read(user_id, item["id"]) for item in items})


def compare(items, profile, measurements_by_id):
    result = {}
    for item in items:
        if item["slot"] == "shoes":
            continue
        measurements = measurements_by_id.get(item["id"], GarmentMeasurements())
        fields = {"top": ["chest_cm"], "outer": ["chest_cm"], "bottom": ["waist_cm", "hips_cm"], "full": ["chest_cm", "waist_cm", "hips_cm"]}[item["slot"]]
        values = []
        for field in fields:
            body, garment = getattr(profile, field), getattr(measurements, field)
            if body is not None and garment is not None:
                difference = round(garment - body, 1)
                values.append(f"{field[:-3]}: garment {garment:g} cm, body {body:g} cm, difference {difference:+g} cm. "
                              + ("Smaller than the body; avoid recommending as a comfortable fit without confirmed stretch." if difference < 0 else "Ease is available; stretch, cut and movement still affect comfort."))
        if values:
            result[item["id"]] = values
    return result
