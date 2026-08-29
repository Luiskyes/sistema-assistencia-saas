import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import (
    clientes,
    equipamentos,
    estoque,
    health,
    ordens,
    plataforma,
    public_config,
    session,
    usuarios,
)
from app.security import SupabaseTokenVerifier
from app.supabase import SupabaseDataAPI

logger = logging.getLogger(__name__)


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

    @application.exception_handler(httpx.TimeoutException)
    async def upstream_timeout(_request: Request, exc: httpx.TimeoutException) -> JSONResponse:
        logger.warning("Tempo limite ao acessar serviço externo: %s", exc)
        return JSONResponse(
            status_code=504,
            content={"detail": "O banco demorou para responder. Tente novamente em instantes."},
        )

    @application.exception_handler(httpx.RequestError)
    async def upstream_unavailable(_request: Request, exc: httpx.RequestError) -> JSONResponse:
        logger.warning("Falha de conexão com serviço externo: %s", exc)
        return JSONResponse(
            status_code=503,
            content={
                "detail": "Não foi possível acessar o banco de dados. "
                "Tente novamente em instantes."
            },
        )

    @application.exception_handler(Exception)
    async def unexpected_error(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Erro inesperado na API", exc_info=exc)
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Ocorreu um erro inesperado. Tente novamente; "
                "se continuar, contate o administrador."
            },
        )
    application.include_router(health.router)
    application.include_router(public_config.router, prefix=settings.api_prefix)
    application.include_router(session.router, prefix=settings.api_prefix)
    application.include_router(clientes.router, prefix=settings.api_prefix)
    application.include_router(equipamentos.router, prefix=settings.api_prefix)
    application.include_router(estoque.router, prefix=settings.api_prefix)
    application.include_router(usuarios.router, prefix=settings.api_prefix)
    application.include_router(ordens.router, prefix=settings.api_prefix)
    application.include_router(plataforma.router, prefix=settings.api_prefix)
    return application


app = create_app()
