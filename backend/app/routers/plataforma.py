from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from app.config import get_settings
from app.dependencies import CurrentSession
from app.security import AuthenticatedRequest, get_authenticated_request
from app.services import github_executor
from app.services.release_validation import MAX_UPLOAD, ReleaseStore

router = APIRouter(prefix="/plataforma", tags=["Plataforma — homologação"])
Auth = Annotated[AuthenticatedRequest, Depends(get_authenticated_request)]
PLATFORM_OWNER_EMAIL = "luis.rogeriocdmelo@gmail.com"


def is_platform_owner(auth: AuthenticatedRequest) -> bool:
    return (
        str(auth.claims.email or "").casefold() == PLATFORM_OWNER_EMAIL
        and auth.claims.app_metadata.get("plataforma_admin") is True
    )


def environment_allowed() -> bool:
    settings = get_settings()
    return (
        settings.environment == "homologacao"
        and bool(settings.updates_homolog_project_ref)
        and settings.supabase_url
        == f"https://{settings.updates_homolog_project_ref}.supabase.co"
    )


async def require_admin(auth: Auth, session: CurrentSession) -> AuthenticatedRequest:
    if not environment_allowed():
        raise HTTPException(403, "Atualizações disponíveis somente na homologação autorizada.")
    if not is_platform_owner(auth):
        raise HTTPException(403, "Área exclusiva do proprietário autorizado da plataforma.")
    return auth


Admin = Annotated[AuthenticatedRequest, Depends(require_admin)]


@router.get("/disponibilidade")
async def availability(auth: Auth, session: CurrentSession) -> dict:
    return {
        "homologacao": get_settings().environment == "homologacao",
        "autorizado": environment_allowed()
        and is_platform_owner(auth),
        "executor_configurado": False,
    }


def store() -> ReleaseStore:
    return ReleaseStore(get_settings().updates_store_path)


class ExecutorRequest(BaseModel):
    expected_sha: str = Field(pattern=r"^[0-9a-f]{40}$")


@router.get("/executor")
async def executor_status(admin: Admin) -> dict:
    return await github_executor.connection(get_settings())


@router.post("/executor/testar", status_code=202)
async def executor_test(body: ExecutorRequest, admin: Admin) -> dict:
    return await github_executor.dispatch(get_settings(), body.expected_sha)


@router.get("/versoes")
async def list_releases(admin: Admin) -> list[dict]:
    return await run_in_threadpool(store().list)


@router.post("/versoes", status_code=201)
async def upload(request: Request, admin: Admin) -> dict:
    payload = bytearray()
    async for chunk in request.stream():
        if len(payload) + len(chunk) > MAX_UPLOAD:
            raise HTTPException(413, "O pacote deve ter no máximo 10 MB.")
        payload.extend(chunk)
    try:
        return await run_in_threadpool(store().add, str(admin.claims.sub), bytes(payload))
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/versoes/{identifier}/analisar")
async def analyze(identifier: UUID, admin: Admin) -> dict:
    try:
        return await run_in_threadpool(store().analyze, str(identifier))
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.get("/versoes/{identifier}/relatorio")
async def report(identifier: UUID, admin: Admin) -> dict:
    try:
        return await run_in_threadpool(store().get, str(identifier))
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.post("/versoes/{identifier}/aplicar")
async def apply_release(identifier: UUID, admin: Admin) -> dict:
    # Nunca tratar análise estática como aprovação de build/testes/deploy.
    raise HTTPException(
        409,
        "Aplicação bloqueada: executor isolado, testes e recuperação ainda não configurados.",
    )
