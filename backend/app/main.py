import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

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
from .dashboard import router as dashboard_router
from .onboarding import router as onboarding_router
from .personalization import router as personalization_router


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

    class ConfiguredCORS(CORSMiddleware):
        def is_allowed_origin(self, origin: str) -> bool:
            return origin in app.state.settings.api_cors_origins

    app.add_middleware(ConfiguredCORS, allow_origins=[], allow_credentials=False,
                       allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
                       allow_headers=["Authorization", "Content-Type"])

    @app.middleware("http")
    async def log_service_failures(request: Request, call_next):
        response = await call_next(request)
        if response.status_code >= 500 or (request.url.path=="/ml/garments/analyse-upload" and response.status_code>=400):
            logging.getLogger(__name__).warning("Request failed: %s %s HTTP %s", request.method, request.scope.get("route").path if request.scope.get("route") else "unmatched", response.status_code)
        return response

    @app.exception_handler(Unauthorized)
    async def unauthorized(request: Request, error: Unauthorized):
        return JSONResponse({"detail": "Valid authentication required."}, status_code=401, headers={"WWW-Authenticate": "Bearer"})

    @app.exception_handler(Forbidden)
    async def forbidden(request: Request, error: Forbidden):
        return JSONResponse({"detail": "Access denied."}, status_code=403)

    @app.exception_handler(DependencyUnavailable)
    async def unavailable(request: Request, error: DependencyUnavailable):
        return JSONResponse({"detail": "Security dependency unavailable."}, status_code=503)

    @app.get("/healthz", include_in_schema=False)
    async def health():
        return {"status": "ok"}

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
    app.include_router(dashboard_router)
    from .ml import router as ml_router
    app.include_router(ml_router)
    from .ml_wardrobe import router as ml_wardrobe_router
    app.include_router(ml_wardrobe_router)
    from .prepared_garments import router as prepared_router
    app.include_router(prepared_router)
    from .ml_sessions import router as ml_sessions_router
    app.include_router(ml_sessions_router)
    from .ml_tryon import router as ml_tryon_router
    app.include_router(ml_tryon_router)
    app.include_router(onboarding_router)
    app.include_router(personalization_router)
    return app


app = create_app()
