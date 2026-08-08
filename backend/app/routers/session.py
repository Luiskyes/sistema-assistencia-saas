from fastapi import APIRouter

from app.dependencies import CurrentSession
from app.schemas import SessaoAtual

router = APIRouter(prefix="/sessao", tags=["Sessão"])

@router.get("/atual", response_model=SessaoAtual)
async def current_session(session: CurrentSession) -> SessaoAtual:
    return session
