from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from app.schemas import AssistenciaAtual, SessaoAtual, UsuarioAutenticado
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
                "assistencias!inner(id_assistencia,nome_assistencia,ativo)"
            ),
            "id_auth": f"eq.{auth.claims.sub}",
            "ativo": "eq.true",
            "limit": "1",
        },
    )

    if not usuarios:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Sua conta foi autenticada, mas ainda não possui um perfil ativo vinculado "
                "a uma assistência. Solicite a ativação ao administrador."
            ),
        )

    row = usuarios[0]
    assistencia = row.pop("assistencias", {})

    session = SessaoAtual(
        usuario=UsuarioAutenticado.model_validate(row),
        assistencia=AssistenciaAtual(
            id_assistencia=assistencia["id_assistencia"],
            nome_assistencia=assistencia["nome_assistencia"],
            ativo=bool(assistencia["ativo"]),
        ),
    )

    if not session.assistencia.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Assistência suspensa",
        )

    return session


CurrentSession = Annotated[SessaoAtual, Depends(get_current_session)]
