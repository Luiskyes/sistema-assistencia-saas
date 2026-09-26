from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from app.dependencies import CurrentSession
from app.schemas_ordens import UsuarioOperacionalResponse
from app.security import AuthenticatedRequest, get_authenticated_request
from app.supabase import SupabaseDataAPI

router = APIRouter(prefix="/usuarios", tags=["Usuários"])
AuthRequest = Annotated[AuthenticatedRequest, Depends(get_authenticated_request)]


@router.get(
    "", response_model=list[UsuarioOperacionalResponse], summary="Lista equipe da assistência"
)
async def listar_usuarios(
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
    somente_ativos: bool = True,
    limite: Annotated[int, Query(ge=1, le=200)] = 100,
) -> list[UsuarioOperacionalResponse]:
    params = {
        "select": "id_usuario,nome_usuario,funcao_usuario,ativo",
        "id_assistencia": f"eq.{session.usuario.id_assistencia}",
        "order": "nome_usuario.asc",
        "limit": str(limite),
    }
    if somente_ativos:
        params["ativo"] = "eq.true"

    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    rows = await data_api.select("usuarios", auth.token, params=params)
    return [UsuarioOperacionalResponse.model_validate(row) for row in rows]
