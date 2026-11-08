from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .config import Settings
from .dependencies import DatabaseEligibility, UnconfiguredEligibility
from .errors import DependencyUnavailable, Forbidden, Unauthorized
from .security import JWTVerifier
from .foundation import router as foundation_router
from .body_profile import router as body_router
from .wardrobe import router as wardrobe_router
from .catalog import router as catalog_router
from .outfits import router as outfits_router
from .recommendations import router as recommendations_router
from .saved_recommendations import router as saved_recommendations_router
from .tryon import router as tryon_router
from .account import router as account_router


def create_app(settings: Settings | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        configured = settings or Settings()
        async with httpx.AsyncClient(timeout=10, follow_redirects=False) as transport:
            app.state.settings = configured
            app.state.transport = transport
            app.state.verifier = JWTVerifier(configured, transport)
            app.state.eligibility = (DatabaseEligibility() if configured.database_foundation_enabled
                                     else UnconfiguredEligibility())
            yield

    app = FastAPI(title="Drape & Drop API", version="0.2.0", lifespan=lifespan)

    @app.exception_handler(Unauthorized)
    async def unauthorized(request: Request, error: Unauthorized):
        return JSONResponse({"detail": "Valid authentication required."}, status_code=401, headers={"WWW-Authenticate": "Bearer"})

    @app.exception_handler(Forbidden)
    async def forbidden(request: Request, error: Forbidden):
        return JSONResponse({"detail": "Access denied."}, status_code=403)

    @app.exception_handler(DependencyUnavailable)
    async def unavailable(request: Request, error: DependencyUnavailable):
        return JSONResponse({"detail": "Security dependency unavailable."}, status_code=503)

    # These routes remain fail-closed until the reviewed database integration is enabled.
    app.include_router(foundation_router)
    app.include_router(body_router)
    app.include_router(wardrobe_router)
    app.include_router(catalog_router)
    app.include_router(outfits_router)
    app.include_router(recommendations_router)
    app.include_router(saved_recommendations_router)
    app.include_router(tryon_router)
    app.include_router(account_router)
    return app


app = create_app()
