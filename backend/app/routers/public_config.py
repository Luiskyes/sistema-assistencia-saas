from fastapi import APIRouter, Response
from pydantic import BaseModel

from app.config import get_settings

router = APIRouter(prefix="/config", tags=["Configuração pública"])


class PublicConfig(BaseModel):
    supabase_url: str
    supabase_publishable_key: str


@router.get("/public", response_model=PublicConfig, summary="Configuração pública do frontend")
async def public_config(response: Response) -> PublicConfig:
    settings = get_settings()
    response.headers["Cache-Control"] = (
        "public, max-age=300" if settings.environment == "production" else "no-store"
    )
    return PublicConfig(
        supabase_url=settings.supabase_url,
        supabase_publishable_key=settings.supabase_publishable_key,
    )
