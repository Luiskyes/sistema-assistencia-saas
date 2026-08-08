from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from app.schemas import SessaoAtual, UsuarioAutenticado
from app.security import AuthenticatedRequest, get_authenticated_request
from app.supabase import SupabaseDataAPI


async def get_current_session(
    request: Request,
    auth: Annotated[AuthenticatedRequest, Depends(get_authenticated_request)],
) -> SessaoAtual:
    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    usuarios = await data_api.select(
        "usuarios",
        auth.token,
        params={
            "select": (
                "id_usuario,id_auth,id_assistencia,cpf_usuario,nome_usuario,"
                "funcao_usuario,email_usuario,ativo,data_criacao,"
                "assistencias!inner(ativo)"
            ),
            "id_auth": f"eq.{auth.claims.sub}",
            "ativo": "eq.true",
            "limit": "1",
        },
    )
    if not usuarios:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário sem perfil ativo no sistema",
        )

    row = usuarios[0]
    assistencia = row.pop("assistencias", {})
    session = SessaoAtual(
        usuario=UsuarioAutenticado.model_validate(row),
        assistencia_ativa=bool(assistencia.get("ativo", False)),
    )
    if not session.assistencia_ativa:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Assistência suspensa",
        )
    return session


CurrentSession = Annotated[SessaoAtual, Depends(get_current_session)]
