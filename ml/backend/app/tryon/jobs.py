"""Private hosted try-on jobs with CPU-only garment preparation."""
import io
import json
import os
import shutil
import subprocess
import sys
import threading
import uuid
from pathlib import Path

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import STORAGE_DIR
from app.persistence import conversations as store

ROOT = STORAGE_DIR / "tryon-jobs"
BACKEND = Path(__file__).resolve().parents[2]
SLOT = threading.BoundedSemaphore(1)
CATEGORIES = {"top": "tops", "outer": "tops", "bottom": "bottoms", "full": "one-pieces"}


def provider():
    return os.getenv("PHASE3_TRYON_PROVIDER", "weshop").lower()




def choose_provider(engine=""):
    selected = engine or provider()
    if selected not in {"weshop", "idm"}:
        raise HTTPException(422, "Choose WeShopAI (weshop) or IDM-VTON (idm). Other try-on providers have been removed.")
    return selected


def init():
    ROOT.mkdir(parents=True, exist_ok=True)
    with store.connection() as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS tryon_jobs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, status TEXT NOT NULL, message TEXT NOT NULL)")
        conn.execute("UPDATE tryon_jobs SET status='failed', message='Server restarted. Please submit the preview again.' WHERE status IN ('queued','processing')")


def read(job_id, user_id):
    with store.connection() as conn:
        row = conn.execute("SELECT id,status,message FROM tryon_jobs WHERE id=? AND user_id=?", (job_id, user_id)).fetchone()
    if row is None:
        raise HTTPException(404, "Preview not found")
    result = dict(row)
    manifest = ROOT / result["id"] / "manifest.json"
    if manifest.is_file():
        data = json.loads(manifest.read_text(encoding="utf-8"))
        result.update(item_ids=data["item_ids"], warnings=data["warnings"], engine=data.get("actual_provider", data.get("provider", provider())),
                      requested_engine=data.get("provider", provider()), attempts=data.get("attempts", []))
    preparation = ROOT / result["id"] / "preparation.json"
    if preparation.is_file():
        prepared = json.loads(preparation.read_text(encoding="utf-8"))
        result["references"] = prepared["references"]
        result["warnings"] = result.get("warnings", []) + [warning for ref in prepared["references"] for warning in ref["warnings"]]
    return result


def outfit_plan(items, engine=None):
    if not 1 <= len(items) <= 4 or len({item["id"] for item in items}) != len(items):
        raise HTTPException(422, "Select one to four distinct owned garments")
    engine = choose_provider(engine or "")
    slots = [item["slot"] for item in items]
    if len(slots) != len(set(slots)) or ("full" in slots and ("top" in slots or "bottom" in slots)):
        raise HTTPException(422, "Choose one item per slot, using a one-piece or separate top/bottom")
    warnings = []
    if (engine or provider()) == "weshop":
        warnings.append("WeShopAI may also change clothing you did not select. Check the complete result.")
    supported = [item for item in items if item["slot"] in CATEGORIES]
    if (engine or provider()) == "idm" and (len(supported) != 1 or supported[0]["slot"] not in {"top", "outer"}):
        raise HTTPException(422, "IDM-VTON demo supports one upper-body garment. Choose only a shirt, T-shirt or top.")
    if (engine or provider()) == "idm":
        warnings.append("IDM-VTON is a noncommercial research demo with shared Hugging Face GPU quotas.")
    if "shoes" in slots:
        warnings.append("Shoes are selected but are not rendered by the photo model.")
    if "outer" in slots and ("top" in slots or "full" in slots):
        supported = [item for item in supported if item["slot"] != "outer"]
        warnings.append("The outer layer is omitted; reliable layered photo generation is not supported.")
    if not supported:
        raise HTTPException(422, "Select a top, bottom or one-piece for the photo preview")
    if len(supported) > 1 and (engine or provider()) == "weshop":
        raise HTTPException(422, "WeShopAI demo supports one garment. Choose only a top or bottom.")
    supported.sort(key=lambda item: {"bottom": 0, "full": 1, "top": 2, "outer": 3}[item["slot"]])
    return supported, warnings


def delete(job_id, user_id):
    job = read(job_id, user_id)
    if job["status"] in {"queued", "processing"}:
        raise HTTPException(409, "Wait until the preview finishes before deleting it")
    shutil.rmtree(ROOT / job["id"], ignore_errors=False)
    with store.connection() as conn:
        conn.execute("DELETE FROM tryon_jobs WHERE id=? AND user_id=?", (job_id, user_id))


def decode_person(raw):
    if len(raw) > 15 * 1024 * 1024:
        raise HTTPException(413, "Photo must be smaller than 15 MB")
    try:
        with Image.open(io.BytesIO(raw)) as source:
            if source.width * source.height > 20_000_000 or min(source.size) < 128:
                raise ValueError("Invalid dimensions")
            image = ImageOps.exif_transpose(source).convert("RGB")
            image.thumbnail((1024, 1024))
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise HTTPException(422, "Use a clear person photo between 128 pixels and 20 megapixels") from exc
    return image


def create(raw, user_id):
    image = decode_person(raw)
    if not SLOT.acquire(blocking=False):
        raise HTTPException(409, "A preview is processing. Try again when it finishes.")
    job_id = uuid.uuid4().hex
    try:
        directory = ROOT / job_id
        directory.mkdir()
        image.save(directory / "person.png")
        with store.connection() as conn:
            conn.execute("INSERT INTO tryon_jobs VALUES(?,?,?,?)", (job_id, user_id, "queued", "Waiting for photo generation"))
    except Exception:
        SLOT.release()
        raise
    return job_id


def run(job_id, garment_path=None, category=None):
    def update(status, message):
        with store.connection() as conn:
            conn.execute("UPDATE tryon_jobs SET status=?,message=? WHERE id=?", (status, message, job_id))
    try:
        update("processing", "Generating your photo preview")
        directory = ROOT / job_id
        plan = (json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
                if garment_path is None else {"person": str(directory / "person.png"),
                "output": str(directory / "result.png"), "garments": [{"path": str(garment_path), "category": category}]})
        engine = choose_provider(plan.get("provider", provider()))
        if engine == "weshop":
            # Both CPU stages use the active runtime; no archived GPU environment.
            original = plan
            try:
                environment = dict(os.environ, OMP_NUM_THREADS="2")
                with (directory / "inference.log").open("w", encoding="utf-8") as log:
                    for script, manifest in [("prepare_tryon_background.py", directory / "manifest.json"),
                                             ("prepare_tryon_garments.py", directory / "prepared-manifest.json")]:
                        result = subprocess.run([sys.executable, str(BACKEND / "scripts" / script), str(manifest)],
                            cwd=BACKEND, stdout=log, stderr=subprocess.STDOUT, timeout=180, env=environment,
                            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
                        if result.returncode: raise RuntimeError("Garment preparation failed")
                plan = json.loads((directory / "prepared-manifest.json").read_text(encoding="utf-8"))
            except (OSError, subprocess.TimeoutExpired, RuntimeError):
                plan = original
                plan.setdefault('warnings', []).append('Automatic garment isolation failed; the hosted service will receive the original reference.')
                (directory / 'manifest.json').write_text(json.dumps(plan), encoding='utf-8')
        from app.tryon.common import HostedTryOnError
        from app.tryon import hosted as hosted_tryon
        from app.tryon import idm as idm_tryon
        try:
            update("processing", "Generating with the hosted demo. Queues and limits apply.")
            if engine == "weshop": hosted_tryon.run_manifest(plan, progress=lambda message: update('processing', message))
            else: idm_tryon.run_manifest(plan)
            update("completed", "Your preview is ready")
        except HostedTryOnError as exc:
            update("failed", str(exc))
    except (OSError, subprocess.TimeoutExpired):
        update("failed", "The try-on worker is unavailable or exceeded its time limit")
    except Exception:
        import traceback
        with (ROOT / job_id / 'inference.log').open('a', encoding='utf-8') as log:
            traceback.print_exc(file=log)
        update('failed', 'Photo generation failed. Check this preview\'s inference log.')
    finally:
        SLOT.release()


