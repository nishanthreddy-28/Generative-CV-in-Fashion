"""Single local entry point for uploads, recommendations and try-on."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api import wardrobe_app as wardrobe_backend
from app.core.config import IMAGES_DIR
from app.api import styling as styling_backend
from app.api import items
from app.api import health


@asynccontextmanager
async def lifespan(app):
    async with wardrobe_backend.lifespan(app), styling_backend.lifespan(app):
        yield


app = FastAPI(title="Drape & Drop Studio", lifespan=lifespan)
app.include_router(items.router)
app.include_router(health.router)
app.include_router(styling_backend.router)
app.add_api_route("/", styling_backend.studio_page, include_in_schema=False)


@app.get("/studio/session", include_in_schema=False)
def session(request: styling_backend.Request):
    styling_backend.studio_session(request)
    # Both phases share this origin in the combined studio.
    return styling_backend.JSONResponse({"user_id": styling_backend.current_user(request), "phase2_api": ""}, headers={"Cache-Control": "no-store"})


app.mount("/studio/assets", StaticFiles(directory=styling_backend.STUDIO_DIR), name="studio_assets")
app.mount("/media", StaticFiles(directory=IMAGES_DIR), name="media")
