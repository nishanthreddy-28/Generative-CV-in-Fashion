"""Supabase-owned persistence for the CPU cloud deployment.

Uses the caller's JWT and publishable key, never a service-role key. Cloud
operations do not read the local wardrobe SQLite databases.
"""
import hashlib
import io
import json
import os
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import PurePosixPath, Path
from urllib.parse import quote

import httpx
import numpy as np
from PIL import Image, ImageOps

from app.persistence import wardrobe as db
from app.core.config import IMAGES_DIR
from app.core.config import MAX_UPLOAD_BYTES
from app.wardrobe import gates
from app.wardrobe import pipeline
from app.profiles import fit
from app.tryon import jobs as tryon
from app.tryon.common import HostedTryOnError
from app.profiles.service import Profile
from app.contracts.styling import ChatRequest
from app.contracts.styling import Intent
from app.contracts.styling import RecommendationResponse
from app.recommendations.service import recommend
from app.recommendations.service import MAX_WARDROBE


class CloudError(RuntimeError):
    pass


class Supabase:
    def __init__(self, token, *, transport=None):
        url, key = os.getenv("SUPABASE_URL", "").rstrip("/"), os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
        if not url.startswith("https://") or not key or not token:
            raise CloudError("Supabase HTTPS URL, publishable key and user access token are required")
        self.client = httpx.Client(base_url=url, headers={"apikey": key, "Authorization": "Bearer " + token}, timeout=60, transport=transport)
        try:
            user = self.call("GET", "/auth/v1/user").json()
            self.user = str(uuid.UUID(user["id"]))
        except Exception:
            self.client.close()
            raise CloudError("Invalid, expired or unavailable Supabase session") from None

    def __enter__(self): return self
    def __exit__(self, *_): self.client.close()

    def call(self, method, path, **kwargs):
        response = self.client.request(method, path, **kwargs)
        if response.status_code == 409:
            raise CloudError("A duplicate upload or conflicting update already exists")
        if response.status_code >= 400:
            raise CloudError(f"Supabase request failed (HTTP {response.status_code})")
        return response

    def rows(self, table, **filters):
        return self.call("GET", f"/rest/v1/{table}", params={"select": "*", "user_id": "eq." + self.user, **filters}).json()

    def insert(self, table, row, upsert=False):
        return self.call("POST", f"/rest/v1/{table}", json={**row, "user_id": self.user}, headers={"Prefer": "return=representation" + (",resolution=merge-duplicates" if upsert else "")}).json()

    def path(self, path):
        if not isinstance(path, str) or "\\" in path or path.startswith("/"):
            raise CloudError("Invalid private object path")
        parts = path.split("/")
        if len(parts) < 2 or parts[0] != self.user or any(part in {"", ".", ".."} for part in parts):
            raise CloudError("Private object belongs to another user or has an invalid path")
        return quote(str(PurePosixPath(path)), safe="/")

    def download(self, path):
        location = self.path(path)
        with self.client.stream("GET", "/storage/v1/object/authenticated/dd-private/" + location) as response:
            if response.status_code != 200: raise CloudError("Private image unavailable")
            raw = bytearray()
            for chunk in response.iter_bytes():
                raw.extend(chunk)
                if len(raw) > MAX_UPLOAD_BYTES: raise CloudError("Image exceeds 15 MB")
        return bytes(raw)

    def upload(self, path, raw, mime="image/png"):
        self.call("POST", "/storage/v1/object/dd-private/" + self.path(path), content=raw, headers={"Content-Type": mime})

    def signed(self, path):
        result = self.call("POST", "/storage/v1/object/sign/dd-private/" + self.path(path), json={"expiresIn": 600}).json()
        signed = result["signedURL"]
        return str(self.client.base_url).rstrip("/") + "/storage/v1" + signed

    def inventory(self):
        return self.rows("dd_items", is_archived="eq.false", limit=str(MAX_WARDROBE + 1), order="id")


def image_bytes(image):
    buffer = io.BytesIO(); image.save(buffer, format="PNG"); return buffer.getvalue()


class CloudEngine:
    def __init__(self, tagger, scorer, stylist, infer, *, photo_engine='weshop'):
        self.tagger, self.scorer, self.stylist, self.infer = tagger, scorer, stylist, infer
        self.photo_engine = photo_engine

    def body_analysis(self, sb, person_path, height_cm):
        from app.pose.validation import analyze_person
        # Supabase.download enforces the authenticated owner's private prefix.
        return analyze_person(tryon.decode_person(sb.download(person_path)), float(height_cm))

    def confirm_body_analysis(self, sb, data):
        from app.pose.models import BodyAnalysis
        analysis = BodyAnalysis.model_validate(data)
        rows = sb.rows('dd_profiles')
        saved = Profile.model_validate(rows[0]['data']) if rows else Profile()
        updated = saved.model_copy(update={'body_analysis': analysis, 'height_cm': analysis.reference_height_cm})
        sb.insert('dd_profiles', {'data': updated.model_dump()}, upsert=True)
        return updated.model_dump()

    def tag(self, sb, upload_path):
        raw = sb.download(upload_path)
        digest = hashlib.sha256(raw).hexdigest()
        existing = sb.inventory()
        if len(existing) > MAX_WARDROBE: raise CloudError("Narrow the wardrobe to 200 active garments")
        if any(row["upload_sha256"] == digest for row in existing):
            return {"status": "exact_duplicate", "duplicate_of": next(row["id"] for row in existing if row["upload_sha256"] == digest)}
        embeddings = [(row["id"], np.asarray(row["data"]["embedding"], dtype=np.float32)) for row in existing]
        result = pipeline.process_upload(raw, sb.user, self.tagger, embeddings)
        a = result.attributes
        data = {"id": result.item_id, "user_id": sb.user, "created_at": datetime.now(timezone.utc).isoformat(),
                "category": result.category, "slot": result.slot, "image_path": result.image_path.replace("\\", "/"), "thumb_path": result.thumb_path.replace("\\", "/"),
                **{key: a[key]["value"] for key in ["pattern", "formality", "season", "fit"]},
                "colors": json.dumps(result.colors), "embedding": result.embedding.tolist(), "confidence": result.confidence, "margin": result.margin, "source": "model"}
        try:
            for path in [data["image_path"], data["thumb_path"]]:
                sb.upload(path, (IMAGES_DIR / path).read_bytes(), "image/webp")
            sb.insert("dd_items", {"id": result.item_id, "upload_sha256": digest, "data": data})
        finally:
            for path in [data["image_path"], data["thumb_path"]]: (IMAGES_DIR / path).unlink(missing_ok=True)
        item = db.row_to_item(data)
        item["image_url"], item["thumb_url"] = sb.signed(data["image_path"]), sb.signed(data["thumb_path"])
        return {"status": "saved", "item": item, "duplicate_of": result.duplicate_of, "duplicate_score": result.duplicate_score, "warnings": result.warnings + (["Possible duplicate: review before keeping both items."] if result.duplicate_of else [])}

    def chat(self, sb, request):
        body = ChatRequest.model_validate(request)
        records = sb.inventory()
        if len(records) > MAX_WARDROBE: raise CloudError("Narrow the wardrobe to 200 active garments")
        rows = [{**row["data"], "id": row["id"], "user_id": sb.user} for row in records]
        profile_rows = sb.rows("dd_profiles")
        saved = Profile.model_validate(profile_rows[0]["data"]) if profile_rows else Profile()
        feedback = {row["outfit_id"]: .06 if row["liked"] else -.06 for row in sb.rows("dd_feedback")}
        state, version = {"intent": Intent().model_dump(), "last_ids": [], "seen": []}, 0
        if body.conversation_id:
            matches = sb.rows("dd_conversations", id="eq." + body.conversation_id)
            if not matches: raise CloudError("Conversation not found")
            state, version = matches[0]["state"], matches[0]["version"]
        from app.chat.routing import conversational_reply
        reply = conversational_reply(body.message)
        if reply:
            return RecommendationResponse(status="chat", message=reply,
                intent=Intent.model_validate(state["intent"]), conversation_id=body.conversation_id).model_dump()
        catalog = [{"id": row["id"], "category": row["category"], "slot": row["slot"], "colors": [c["name"] for c in json.loads(row["colors"])], "pattern": row["pattern"], "formality": row["formality"]} for row in rows]
        message = ("Previous request awaiting clarification: " + state["pending_message"] + "\nCurrent reply: " if state.get("pending_message") else "") + body.message
        interpretation = self.stylist.interpret(message, Intent.model_validate(state["intent"]), catalog, state["last_ids"])
        if interpretation.action == "chat":
            from app.chat.routing import FALLBACK
            return RecommendationResponse(status="chat", message=FALLBACK,
                intent=Intent.model_validate(state["intent"]), conversation_id=body.conversation_id).model_dump()
        intent = interpretation.intent.model_copy(update={"count": body.count}) if body.count is not None else interpretation.intent
        measurements = {row["id"]: fit.GarmentMeasurements.model_validate(row["measurements"]) for row in records}
        # Per-request private directory prevents cross-user/local file collisions.
        with tempfile.TemporaryDirectory(dir=IMAGES_DIR, prefix="cloud-") as directory:
            for item in rows:
                path = Path(directory) / (item["id"] + ".webp")
                path.write_bytes(sb.download(f"{sb.user}/{item['id']}.webp"))
                item["image_path"] = str(path.relative_to(IMAGES_DIR))
            result = (RecommendationResponse(status="needs_clarification", message=interpretation.clarification, intent=intent)
                      if interpretation.clarification else recommend(rows, intent, self.scorer, self.stylist, state["seen"], saved, feedback, fit.compare(rows, saved, measurements), last_ids=state["last_ids"]))
        if result.status in {"recommended", "no_match", "needs_clarification"}:
            next_state = {"intent": intent.model_dump(), "last_ids": [item.id for item in result.outfits[0].items] if result.outfits else state["last_ids"],
                          "seen": list(dict.fromkeys(state["seen"] + [outfit.id for outfit in result.outfits]))[-100:]}
            if result.status == "needs_clarification": next_state["pending_message"] = body.message
            conversation = body.conversation_id or uuid.uuid4().hex
            if body.conversation_id:
                response = sb.call("PATCH", "/rest/v1/dd_conversations", params={"id": "eq." + conversation, "user_id": "eq." + sb.user, "version": f"eq.{version}"}, json={"state": next_state, "version": version + 1}, headers={"Prefer": "return=representation"})
                if not response.json(): raise CloudError("Conversation changed; retry your message")
            else:
                sb.insert("dd_conversations", {"id": conversation, "state": next_state, "version": 0})
            result.conversation_id = conversation
        else:
            result.conversation_id = body.conversation_id
        for outfit in result.outfits:
            for item in outfit.items:
                item.image_url = sb.signed(f"{sb.user}/{item.id}.webp")
                item.thumb_url = item.image_url
        return result.model_dump()

    def photo(self, sb, person_path, item_ids):
        records = {row["id"]: row for row in sb.inventory()}
        if not set(item_ids) <= records.keys(): raise CloudError("Garment not found")
        items = [{**records[key]["data"], "id": key} for key in item_ids]
        selected, warnings = tryon.outfit_plan(items, engine=self.photo_engine)
        raw = sb.download(person_path)
        try:
            with Image.open(io.BytesIO(raw)) as image:
                if min(image.size) < 128 or image.width * image.height > 20_000_000: raise ValueError()
                person = ImageOps.exif_transpose(image).convert("RGB"); person.thumbnail((1024, 1024))
        except Exception:
            raise CloudError("Use a person photo between 128 pixels and 20 megapixels") from None
        garments = []
        for item in selected:
            with Image.open(io.BytesIO(sb.download(f"{sb.user}/{item['id']}.webp"))) as image:
                rotation = fit.GarmentMeasurements.model_validate(records[item["id"]]["measurements"]).preview_rotation
                rgba = image.convert("RGBA").rotate(-rotation, expand=True); rgb = Image.new("RGB", rgba.size, "white"); rgb.paste(rgba, mask=rgba.getchannel("A"))
                garments.append((rgb, tryon.CATEGORIES[item["slot"]]))
        job_id = uuid.uuid4().hex
        data = {"status": "processing", "person_path": person_path, "item_ids": item_ids, "warnings": warnings,
                "requested_engine": self.photo_engine}
        sb.insert("dd_preview_jobs", {"id": job_id, "data": data})
        try:
            result = self.infer(person, garments)
            data.update(engine=result.info.get('tryon_provider', self.photo_engine),
                        attempts=result.info.get('tryon_attempts', []))
            data['warnings'].extend(result.info.get('tryon_warnings', []))
            path = f"{sb.user}/results/{job_id}.png"
            sb.upload(path, image_bytes(result))
            data.update(status="completed", result_path=path)
        except HostedTryOnError as exc:
            data.update(status="failed", message=str(exc))
            raise CloudError(str(exc)) from None
        except Exception:
            data.update(status="failed")
            raise CloudError("Photo generation failed; retry after checking GPU availability") from None
        finally:
            sb.call("PATCH", "/rest/v1/dd_preview_jobs", params={"id": "eq." + job_id, "user_id": "eq." + sb.user}, json={"data": data})
        return {"id": job_id, **data, "image_url": sb.signed(path)}
