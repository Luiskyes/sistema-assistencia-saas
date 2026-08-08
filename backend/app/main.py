from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import clientes, equipamentos, health, public_config, session
from app.security import SupabaseTokenVerifier
from app.supabase import SupabaseDataAPI


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    http_client = httpx.AsyncClient(timeout=httpx.Timeout(10.0))
    app.state.http_client = http_client
    app.state.token_verifier = SupabaseTokenVerifier(settings, http_client)
    app.state.supabase_data_api = SupabaseDataAPI(settings, http_client)
    yield
    await http_client.aclose()


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url=None,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.frontend_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
    application.include_router(health.router)
    application.include_router(public_config.router, prefix=settings.api_prefix)
    application.include_router(session.router, prefix=settings.api_prefix)
    application.include_router(clientes.router, prefix=settings.api_prefix)
    application.include_router(equipamentos.router, prefix=settings.api_prefix)
    return application


app = create_app()
