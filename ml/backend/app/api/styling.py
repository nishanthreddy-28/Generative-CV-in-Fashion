"""Standalone Phase 3 API: uvicorn app.api.styling:app --port 8001."""
import os
import json
import io
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from app.persistence import wardrobe as db
from app.core.config import IMAGES_DIR
from app.persistence import conversations as store
from app.profiles import service as profile
from app.tryon import jobs as tryon
from app.profiles import fit
from app.chat.stylist import create_stylist
from app.chat.stylist import LLMUnavailable
from app.recommendations.scorer import PretrainedScorer
from app.recommendations.scorer import image_path
from app.contracts.styling import ChatRequest
from app.contracts.styling import Intent
from app.contracts.styling import RecommendationResponse
from app.recommendations.service import recommend
from app.recommendations.service import MAX_WARDROBE
from app.recommendations.service import outfit_id

router = APIRouter(prefix="/phase3", tags=["phase3"])
scorer = PretrainedScorer()
stylist = create_stylist()


def current_user(request: Request):
    development_user = os.getenv("PHASE3_DEV_USER_ID")
    if development_user:
        if request.client is None or request.client.host not in {"127.0.0.1", "::1"}:
            raise HTTPException(403, "Development identity only permits direct loopback requests")
        return development_user
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
    if not url or not key:
        raise HTTPException(503, "Configure Supabase authentication, or a loopback-only PHASE3_DEV_USER_ID for local development")
    authorization = request.headers.get("Authorization", "")
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "A user access token is required")
    try:
        with httpx.Client(timeout=10) as client:
            response = client.get(url + "/auth/v1/user", headers={"apikey": key, "Authorization": authorization})
        if response.status_code in {401, 403}:
            raise HTTPException(401, "Invalid or expired access token")
        response.raise_for_status()
        user_id = response.json()["id"]
        if not isinstance(user_id, str) or not user_id:
            raise ValueError("Invalid identity")
        return user_id
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        raise HTTPException(503, "Authentication service unavailable") from exc


def wardrobe(user_id):
    conn = db.get_conn()
    try:
        rows = conn.execute("SELECT * FROM items WHERE user_id=? AND is_archived=0 ORDER BY id LIMIT ?", (user_id, MAX_WARDROBE + 1)).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


@router.post("/tryon", status_code=202)
async def photo_tryon(background: BackgroundTasks, file: UploadFile = File(...), item_id: str = Form(...), user_id: str = Depends(current_user), engine: str = Form(""), photo_type: str = Form("auto")):
    return await photo_outfit(background, file, [item_id], user_id, engine, photo_type)


@router.get("/tryon/{job_id}")
def tryon_status(job_id: str, user_id: str = Depends(current_user)):
    return tryon.read(job_id, user_id)


@router.post("/tryon/uploads", status_code=202)
async def uploaded_photo_outfit(background: BackgroundTasks, file: UploadFile = File(...),
                               garments: list[UploadFile] = File(...), categories: list[str] = Form(...),
                               user_id: str = Depends(current_user), engine: str = Form(""), photo_type: str = Form("auto")):
    from PIL import Image, ImageOps
    engine = tryon.choose_provider(engine)
    if photo_type not in {"auto", "model", "flat-lay"}:
        raise HTTPException(422, "Choose automatic garment preparation")
    if len(garments) != 1 or len(categories) != 1:
        raise HTTPException(422, "Upload one clothing photo and its type")
    if engine == "weshop" and len(garments) > 1:
        raise HTTPException(422, "WeShopAI demo supports one garment. Choose only a top or bottom.")
    if engine == "idm" and categories != ["tops"]:
        raise HTTPException(422, "IDM-VTON demo supports one upper-body garment. Choose only a shirt, T-shirt or top.")
    if any(c not in {"tops", "bottoms", "one-pieces"} for c in categories) or len(set(categories)) != len(categories) or (len(categories) == 2 and "one-pieces" in categories):
        raise HTTPException(422, "Choose one top and one bottom, or a single one-piece")
    images = []
    for upload, category in zip(garments, categories):
        raw = await upload.read(15 * 1024 * 1024 + 1)
        if len(raw) > 15 * 1024 * 1024:
            raise HTTPException(413, "Each clothing photo must be smaller than 15 MB")
        try:
            with Image.open(io.BytesIO(raw)) as source:
                if min(source.size) < 128 or source.width * source.height > 20_000_000:
                    raise ValueError()
                rgba = ImageOps.exif_transpose(source).convert("RGBA")
                image = Image.new("RGB", rgba.size, "white")
                image.paste(rgba, mask=rgba.getchannel("A"))
                image.thumbnail((1536,1536))
                images.append((image, category))
        except (OSError, ValueError, Image.DecompressionBombError):
            raise HTTPException(422, "Use clothing photos between 128 pixels and 20 megapixels") from None
    job_id = tryon.create(await file.read(15 * 1024 * 1024 + 1), user_id)
    directory = tryon.ROOT / job_id
    try:
        plan = {"person": str(directory / "person.png"), "output": str(directory / "result.png"),
                "provider": engine, "item_ids": [], "warnings": [], "garments": []}
        if engine == "idm":
            plan["warnings"].append("IDM-VTON is a noncommercial research demo with shared Hugging Face GPU quotas.")
        if engine == "weshop":
            plan["warnings"].append("WeShopAI may also change clothing you did not select. Check the complete result.")
        for index, (image, category) in enumerate(sorted(images, key=lambda pair: pair[1] != "bottoms")):
            path = directory / f"garment-{index}.png"
            image.save(path)
            plan["garments"].append({"path": str(path), "category": category, "photo_type": photo_type})
        (directory / "manifest.json").write_text(json.dumps(plan), encoding="utf-8")
    except Exception:
        with store.connection() as conn:
            conn.execute("UPDATE tryon_jobs SET status='failed',message='Could not prepare clothing photos' WHERE id=?", (job_id,))
        tryon.SLOT.release()
        raise
    background.add_task(tryon.run, job_id)
    return tryon.read(job_id, user_id)


@router.post("/tryon/outfit", status_code=202)
async def photo_outfit(background: BackgroundTasks, file: UploadFile = File(...), item_ids: list[str] = Form(...), user_id: str = Depends(current_user), engine: str = Form(""), photo_type: str = Form("auto")):
    engine = tryon.choose_provider(engine)
    if photo_type not in {"auto", "model", "flat-lay"}:
        raise HTTPException(422, "Choose automatic garment preparation")
    owned = {item["id"]: item for item in wardrobe(user_id)}
    if not set(item_ids) <= owned.keys():
        raise HTTPException(404, "Garment not found")
    selected, warnings = tryon.outfit_plan([owned[item_id] for item_id in item_ids], engine)
    if len(selected) > 2:
        raise HTTPException(422, "Select at most two clothing items")
    paths = [image_path(item) for item in selected]
    if not all(path.is_file() for path in paths):
        raise HTTPException(404, "Garment image not found")
    job_id = tryon.create(await file.read(15 * 1024 * 1024 + 1), user_id)
    directory = tryon.ROOT / job_id
    try:
        manifest = {"person": str(directory / "person.png"), "output": str(directory / "result.png"),
                    "provider": engine, "item_ids": item_ids, "warnings": warnings,
                    "garments": [{"path": str(path), "category": tryon.CATEGORIES[item["slot"]], "photo_type": photo_type, "wardrobe_cutout": True, "rotation": fit.read(user_id, item["id"]).preview_rotation} for item, path in zip(selected, paths)]}
        (directory / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    except Exception:
        with store.connection() as conn:
            conn.execute("UPDATE tryon_jobs SET status='failed',message='Could not prepare preview' WHERE id=?", (job_id,))
        tryon.SLOT.release()
        raise
    background.add_task(tryon.run, job_id)
    return tryon.read(job_id, user_id)


@router.delete("/tryon/{job_id}")
def delete_tryon(job_id: str, user_id: str = Depends(current_user)):
    tryon.delete(job_id, user_id)
    return {"deleted": True}


@router.get("/tryon/{job_id}/image")
def tryon_image(job_id: str, user_id: str = Depends(current_user)):
    job = tryon.read(job_id, user_id)
    if job["status"] != "completed":
        raise HTTPException(409, "Preview is not ready")
    return FileResponse(tryon.ROOT / job["id"] / "result.png", headers={"Cache-Control": "private, no-store"})


@router.get("/tryon/{job_id}/references/{index}")
def tryon_reference(job_id: str, index: int, user_id: str = Depends(current_user)):
    job = tryon.read(job_id, user_id)
    if index not in {1, 2} or not any(ref["index"] == index for ref in job.get("references", [])):
        raise HTTPException(404, "Prepared reference not found")
    return FileResponse(tryon.ROOT / job["id"] / f"prepared-{index}.png", headers={"Cache-Control": "private, no-store"})


@router.get("/tryon/{job_id}/export")
def tryon_export(job_id: str, user_id: str = Depends(current_user)):
    from app.tryon.export import export_bundle
    job = tryon.read(job_id, user_id)
    if job["status"] in {"queued", "processing"} and not job.get("references"):
        raise HTTPException(409, "Clothing preparation is still running")
    return Response(export_bundle(tryon.ROOT / job["id"]), media_type="application/zip", headers={
        "Cache-Control": "private, no-store", "Content-Disposition": 'attachment; filename="try-on-inputs.zip"'})


@router.get("/health")
def health():
    return {"status": "ok", "recommendation_model_loaded": scorer.ready,
            "language_model": stylist.model, "language_model_endpoint": stylist.endpoint_description,
            "language_model_provider": stylist.provider,
            "tryon_provider": tryon.provider(),
            "quality_validated": False}


@router.post("/recommendations", response_model=RecommendationResponse)
def structured(intent: Intent, user_id: str = Depends(current_user)):
    items, saved = wardrobe(user_id), profile.read(user_id)
    return recommend(items, intent, scorer, stylist, profile=saved, feedback=profile.feedback_scores(user_id), fit_notes=fit.notes(user_id, items, saved))


def owned_item(user_id, item_id):
    item = next((item for item in wardrobe(user_id) if item["id"] == item_id), None)
    if item is None:
        raise HTTPException(404, "Garment not found")
    return item


@router.get("/items/{item_id}/measurements", response_model=fit.GarmentMeasurements)
def get_measurements(item_id: str, user_id: str = Depends(current_user)):
    owned_item(user_id, item_id)
    return fit.read(user_id, item_id)


@router.put("/items/{item_id}/measurements", response_model=fit.GarmentMeasurements)
def put_measurements(item_id: str, body: fit.GarmentMeasurements, user_id: str = Depends(current_user)):
    owned_item(user_id, item_id)
    return fit.save(user_id, item_id, body)


@router.get("/profile", response_model=profile.Profile)
def get_profile(user_id: str = Depends(current_user)):
    return profile.read(user_id)


@router.get("/taxonomy")
def taxonomy(user_id: str = Depends(current_user)):
    from app.wardrobe.taxonomy import CAT_SLOT
    return {"categories": CAT_SLOT}


@router.delete('/items/{item_id}')
def remove_wardrobe_item(item_id: str, user_id: str = Depends(current_user)):
    conn = db.get_conn()
    try:
        result = conn.execute('UPDATE items SET is_archived=1 WHERE id=? AND user_id=? AND is_archived=0', (item_id,user_id))
        conn.commit()
        if result.rowcount != 1:
            raise HTTPException(404, 'Clothing item not found')
    finally:
        conn.close()
    return {'deleted': True, 'item_id': item_id}


@router.put("/profile", response_model=profile.Profile)
def put_profile(body: profile.Profile, user_id: str = Depends(current_user)):
    if 'body_analysis' not in body.model_fields_set:
        analysis = profile.read(user_id).body_analysis
        # Changing the reference height invalidates the previous scale.
        if analysis and body.height_cm != analysis.reference_height_cm:
            analysis = None
        body = body.model_copy(update={'body_analysis': analysis})
    return profile.save(user_id, body)


@router.put('/body-analysis', response_model=profile.Profile)
def put_body_analysis(body: profile.BodyAnalysis, user_id: str = Depends(current_user)):
    saved = profile.read(user_id)
    return profile.save(user_id, saved.model_copy(update={'body_analysis': body, 'height_cm': body.reference_height_cm}))


@router.post('/person-photo/validate')
def validate_person_photo(file: UploadFile = File(...), user_id: str = Depends(current_user)):
    from app.pose.validation import validate_person
    return validate_person(tryon.decode_person(file.file.read(15 * 1024 * 1024 + 1)))


@router.post('/body-analysis/estimate')
def estimate_body(file: UploadFile = File(...), reference_height_cm: float = Form(..., ge=80, le=250), user_id: str = Depends(current_user)):
    from app.pose.validation import analyze_person
    return analyze_person(tryon.decode_person(file.file.read(15 * 1024 * 1024 + 1)), reference_height_cm)


@router.delete('/body-analysis', response_model=profile.Profile)
def delete_body_analysis(user_id: str = Depends(current_user)):
    return profile.save(user_id, profile.read(user_id).model_copy(update={'body_analysis': None}))


@router.post("/feedback")
def outfit_feedback(body: profile.Feedback, user_id: str = Depends(current_user)):
    items = {item["id"]: item for item in wardrobe(user_id)}
    if len(set(body.item_ids)) != len(body.item_ids) or not set(body.item_ids) <= items.keys():
        raise HTTPException(422, "Choose distinct items from your active wardrobe")
    key = outfit_id([items[item_id] for item_id in body.item_ids])
    with store.connection() as conn:
        conn.execute("INSERT INTO outfit_feedback VALUES(?,?,?) ON CONFLICT(user_id,outfit_id) DO UPDATE SET liked=excluded.liked", (user_id, key, body.liked))
    return {"saved": True}


@router.post("/chat", response_model=RecommendationResponse)
def chat(body: ChatRequest, user_id: str = Depends(current_user)):
    version, state = None, {"intent": Intent().model_dump(), "last_ids": [], "seen": []}
    if body.conversation_id:
        stored = store.read(body.conversation_id, user_id)
        if stored is None:
            raise HTTPException(404, "Conversation not found")
        version, state = stored
    from app.chat.routing import conversational_reply
    reply = conversational_reply(body.message)
    if reply:
        return RecommendationResponse(status="chat", message=reply,
            intent=Intent.model_validate(state["intent"]), conversation_id=body.conversation_id)
    items = wardrobe(user_id)
    if len(items) > MAX_WARDROBE:
        return RecommendationResponse(status="needs_clarification", message="Please narrow the active wardrobe to 200 garments.", intent=Intent())
    try:
        catalog = [{"id": i["id"], "category": i["category"], "slot": i["slot"],
                    "colors": [c["name"] for c in json.loads(i["colors"])][:3],
                    "pattern": i["pattern"], "formality": i["formality"]} for i in items]
    except (ValueError, TypeError, KeyError):
        return RecommendationResponse(status="needs_clarification", message="Please correct incomplete wardrobe metadata first.", intent=Intent(), conversation_id=body.conversation_id)
    try:
        message = body.message
        if state.get("pending_message"):
            message = "Previous request awaiting clarification: " + state["pending_message"] + "\nCurrent reply: " + message
        interpretation = stylist.interpret(message, Intent.model_validate(state["intent"]), catalog, state["last_ids"])
    except LLMUnavailable as exc:
        return RecommendationResponse(status="unavailable", message=str(exc), intent=Intent.model_validate(state["intent"]), conversation_id=body.conversation_id)
    intent = interpretation.intent
    if interpretation.action == "chat":
        from app.chat.routing import FALLBACK
        return RecommendationResponse(status="chat", message=FALLBACK,
            intent=Intent.model_validate(state["intent"]), conversation_id=body.conversation_id)
    if body.count is not None:
        intent = intent.model_copy(update={"count": body.count})
    if interpretation.clarification:
        result = RecommendationResponse(status="needs_clarification", message=interpretation.clarification, intent=intent)
    else:
        saved = profile.read(user_id)
        result = recommend(items, intent, scorer, stylist, state["seen"], saved, profile.feedback_scores(user_id), fit.notes(user_id, items, saved), last_ids=state["last_ids"])
    if result.status in {"recommended", "no_match", "needs_clarification"}:
        new_state = {"intent": intent.model_dump(), "last_ids": state["last_ids"], "seen": state["seen"]}
        if result.status == "needs_clarification":
            new_state["pending_message"] = body.message
        if result.outfits:
            new_state["last_ids"] = [i.id for i in result.outfits[0].items]
            new_state["seen"] = list(dict.fromkeys(state["seen"] + [o.id for o in result.outfits]))[-100:]
        try:
            result.conversation_id = store.save(body.conversation_id, user_id, version, new_state)
        except RuntimeError as exc:
            raise HTTPException(409, str(exc)) from exc
    else:
        result.conversation_id = body.conversation_id
    return result


@router.get("/items/{item_id}/image")
def item_image(item_id: str, thumbnail: bool = False, preview: bool = False, user_id: str = Depends(current_user)):
    conn = db.get_conn()
    try:
        row = db.get_item(conn, item_id, user_id)
        if row is None:
            raise HTTPException(404, "Item not found")
        item = dict(row)
        if thumbnail:
            item["image_path"] = item["thumb_path"]
        path = image_path(item)
        if not path.is_file():
            raise HTTPException(404, "Image not found")
        if preview:
            from PIL import Image
            with Image.open(path) as image:
                rotated = image.rotate(-fit.read(user_id, item_id).preview_rotation, expand=True)
                buffer = io.BytesIO(); rotated.save(buffer, format="PNG")
            return Response(buffer.getvalue(), media_type="image/png", headers={"Cache-Control": "private, no-store"})
        return FileResponse(path, headers={"Cache-Control": "private, no-store"})
    finally:
        conn.close()


@asynccontextmanager
async def lifespan(app):
    db.init_db()
    store.init()
    tryon.init()
    yield


app = FastAPI(title="Drape&Drop Phase 3", version="0.3.0", lifespan=lifespan)
app.include_router(router)

STUDIO_DIR = Path(__file__).resolve().parents[2] / "web" / "studio"


@app.get("/", include_in_schema=False)
def studio_page():
    return FileResponse(STUDIO_DIR / "index.html", headers={"Cache-Control": "no-store"})


@app.get("/studio/session", include_in_schema=False)
def studio_session(request: Request):
    if not os.getenv("PHASE3_DEV_USER_ID"):
        raise HTTPException(404, "The studio requires PHASE3_DEV_USER_ID for local testing.")
    return JSONResponse({"user_id": current_user(request)}, headers={"Cache-Control": "no-store"})


app.mount("/studio/assets", StaticFiles(directory=STUDIO_DIR), name="studio_assets")
