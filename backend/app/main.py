from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .config import Settings
from .dependencies import UnconfiguredEligibility
from .errors import DependencyUnavailable, Forbidden, Unauthorized
from .security import JWTVerifier


def create_app(settings: Settings | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        configured = settings or Settings()
        async with httpx.AsyncClient(timeout=10, follow_redirects=False) as transport:
            app.state.settings = configured
            app.state.transport = transport
            app.state.verifier = JWTVerifier(configured, transport)
            app.state.eligibility = UnconfiguredEligibility()
            yield

    app = FastAPI(title="Drape & Drop API", version="0.1.0", lifespan=lifespan)

    @app.exception_handler(Unauthorized)
    async def unauthorized(request: Request, error: Unauthorized):
        return JSONResponse({"detail": "Valid authentication required."}, status_code=401, headers={"WWW-Authenticate": "Bearer"})

    @app.exception_handler(Forbidden)
    async def forbidden(request: Request, error: Forbidden):
        return JSONResponse({"detail": "Access denied."}, status_code=403)

    @app.exception_handler(DependencyUnavailable)
    async def unavailable(request: Request, error: DependencyUnavailable):
        return JSONResponse({"detail": "Security dependency unavailable."}, status_code=503)

    # No business routes are exposed before lifecycle/RLS enforcement is configured.
    return app


app = create_app()
