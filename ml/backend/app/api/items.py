"""POST /items, GET /items, PATCH /items/{id}, DELETE /items/{id}"""

from __future__ import annotations
import hashlib
import sqlite3

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool

from app.persistence import wardrobe as db
from app.wardrobe import gates
from app.wardrobe import pipeline
from app.contracts.wardrobe import ItemUpdate
from app.contracts.wardrobe import Item
from app.contracts.wardrobe import UploadResponse

router = APIRouter(prefix="/items", tags=["items"])


@router.post("", response_model=UploadResponse)
async def create_item(request: Request,
                      file: UploadFile = File(...),
                      user_id: str = Form(...)):
    from app.core.config import MAX_UPLOAD_BYTES
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Garment image must be smaller than 15 MB")
    tagger = request.app.state.tagger
    conn = request.app.state.db
    digest = hashlib.sha256(raw).hexdigest()

    def duplicate():
        return conn.execute("SELECT id FROM items WHERE user_id=? AND upload_sha256=? AND is_archived=0", (user_id, digest)).fetchone()

    def reject(row):
        raise HTTPException(409, detail={"code": "exact_duplicate", "message": "This exact photo is already in your wardrobe.", "duplicate_of": row["id"]})

    if repeated := duplicate():
        reject(repeated)

    existing = db.list_embeddings(conn, user_id)

    try:
        # the model call blocks - keep the event loop free
        result = await run_in_threadpool(
            pipeline.process_upload, raw, user_id, tagger, existing)
    except gates.GateError as e:
        raise HTTPException(status_code=422,
                            detail={"code": e.code, "message": e.message})

    try:
        row = db.insert_item(conn, result, user_id, digest)
    except sqlite3.IntegrityError:
        conn.rollback()
        if repeated := duplicate():
            reject(repeated)
        raise
    stored = db.get_item(conn, row["id"], user_id)
    warnings = list(result.warnings)
    if result.duplicate_of:
        warnings.append("Possible duplicate: a visually similar garment is already in your wardrobe. Check before keeping both items.")

    return UploadResponse(
        item=Item(**db.row_to_item(stored)),
        route=result.route,
        alternatives=result.alternatives,
        duplicate_of=result.duplicate_of,
        duplicate_score=result.duplicate_score,
        warnings=warnings,
    )


@router.get("", response_model=list[Item])
def list_wardrobe(request: Request, user_id: str, slot: str | None = None):
    conn = request.app.state.db
    return [Item(**db.row_to_item(r)) for r in db.list_items(conn, user_id, slot)]


@router.get("/{item_id}", response_model=Item)
def get_one(request: Request, item_id: str, user_id: str):
    row = db.get_item(request.app.state.db, item_id, user_id)
    if row is None:
        raise HTTPException(404, detail={"code": "not_found",
                                         "message": "Item not found."})
    return Item(**db.row_to_item(row))


@router.patch("/{item_id}", response_model=Item)
def correct_item(request: Request, item_id: str, user_id: str,
                 body: ItemUpdate):
    """
    User correction is ground truth. Does NOT re-run the model - the
    embedding is a visual fact, independent of the label.
    """
    conn = request.app.state.db

    fields = body.model_dump(exclude_none=True)
    # keep slot consistent when only the category changed
    if "category" in fields and "slot" not in fields:
        from app.wardrobe.taxonomy import CAT_SLOT
        if fields["category"] in CAT_SLOT:
            fields["slot"] = CAT_SLOT[fields["category"]]

    if not db.update_item(conn, item_id, user_id, fields):
        raise HTTPException(404, detail={"code": "not_found",
                                         "message": "Item not found."})

    return Item(**db.row_to_item(db.get_item(conn, item_id, user_id)))


@router.delete("/{item_id}")
def delete_item(request: Request, item_id: str, user_id: str):
    if not db.archive_item(request.app.state.db, item_id, user_id):
        raise HTTPException(404, detail={"code": "not_found",
                                         "message": "Item not found."})
    return {"ok": True}
