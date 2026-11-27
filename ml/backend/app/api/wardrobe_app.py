"""
FastAPI entrypoint. The model loads ONCE at startup, not per request.

Run:  uvicorn app.api.wardrobe_app:app --reload --port 8000
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.persistence import wardrobe as db
from app.core.config import IMAGES_DIR
from app.wardrobe.tagger import Tagger
from app.api import health
from app.api import items


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    app.state.db = db.get_conn()
    print("Loading FashionSigLIP...")
    app.state.tagger = Tagger()
    print(f"Model ready on {app.state.tagger.device}")
    yield
    app.state.db.close()


app = FastAPI(title="Drape&Drop API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:8001", "http://localhost:8001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(items.router)
app.mount("/media", StaticFiles(directory=IMAGES_DIR), name="media")
