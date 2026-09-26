from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.dependencies import CurrentSession
from app.schemas import FuncaoUsuario
from app.schemas_estoque import (
    EstoqueAjuste,
    EstoqueItemCreate,
    EstoqueItemResponse,
    EstoqueItemUpdate,
    MovimentoEstoqueResponse,
)
from app.security import AuthenticatedRequest, get_authenticated_request
from app.supabase import SupabaseDataAPI

router = APIRouter(prefix="/estoque", tags=["Estoque"])
AuthRequest = Annotated[AuthenticatedRequest, Depends(get_authenticated_request)]

ESTOQUE_SELECT = (
    "id_item,id_assistencia,codigo,descricao,categoria,marca_compativel,"
    "modelo_compativel,quantidade_atual,quantidade_minima,custo_unitario,"
    "preco_venda,localizacao,ativo,data_criacao,data_atualizacao"
)


def _pode_gerenciar(funcao: FuncaoUsuario) -> bool:
    return funcao in (FuncaoUsuario.DONO, FuncaoUsuario.RECEPCIONISTA)


def _ocultar_custo(item: EstoqueItemResponse, funcao: FuncaoUsuario) -> EstoqueItemResponse:
    if funcao == FuncaoUsuario.DONO:
        return item
    return item.model_copy(update={"custo_unitario": None})


@router.get("", response_model=list[EstoqueItemResponse], summary="Lista itens do estoque")
async def listar_estoque(
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
    somente_ativos: bool = True,
    limite: Annotated[int, Query(ge=1, le=200)] = 100,
    pagina: Annotated[int, Query(ge=1)] = 1,
) -> list[EstoqueItemResponse]:
    params = {
        "select": ESTOQUE_SELECT,
        "id_assistencia": f"eq.{session.usuario.id_assistencia}",
        "order": "descricao.asc",
        "limit": str(limite),
        "offset": str((pagina - 1) * limite),
    }
    if somente_ativos:
        params["ativo"] = "eq.true"

    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    rows = await data_api.select("estoque_itens", auth.token, params=params)
    return [
        _ocultar_custo(EstoqueItemResponse.model_validate(row), session.usuario.funcao_usuario)
        for row in rows
    ]


@router.post(
    "",
    response_model=EstoqueItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastra item no estoque",
)
async def criar_item_estoque(
    payload: EstoqueItemCreate,
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
) -> EstoqueItemResponse:
    if not _pode_gerenciar(session.usuario.funcao_usuario):
        raise HTTPException(
            status_code=403, detail="Técnicos possuem acesso somente para consulta do estoque"
        )

    if session.usuario.funcao_usuario != FuncaoUsuario.DONO and payload.custo_unitario is not None:
        raise HTTPException(
            status_code=403, detail="Somente o dono pode informar custo de aquisição"
        )

    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    row = await data_api.insert(
        "estoque_itens",
        auth.token,
        payload={
            **payload.model_dump(mode="json"),
            "id_assistencia": str(session.usuario.id_assistencia),
        },
    )
    item = EstoqueItemResponse.model_validate(row)
    return _ocultar_custo(item, session.usuario.funcao_usuario)


@router.patch("/{id_item}", response_model=EstoqueItemResponse, summary="Atualiza item do estoque")
async def atualizar_item_estoque(
    id_item: UUID,
    payload: EstoqueItemUpdate,
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
) -> EstoqueItemResponse:
    if not _pode_gerenciar(session.usuario.funcao_usuario):
        raise HTTPException(
            status_code=403, detail="Técnicos possuem acesso somente para consulta do estoque"
        )

    if (
        session.usuario.funcao_usuario != FuncaoUsuario.DONO
        and "custo_unitario" in payload.model_fields_set
    ):
        raise HTTPException(
            status_code=403, detail="Somente o dono pode alterar custo de aquisição"
        )

    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    row = await data_api.update(
        "estoque_itens",
        auth.token,
        filters={
            "id_item": f"eq.{id_item}",
            "id_assistencia": f"eq.{session.usuario.id_assistencia}",
        },
        payload=payload.model_dump(exclude_unset=True, mode="json"),
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Item de estoque não encontrado")
    item = EstoqueItemResponse.model_validate(row)
    return _ocultar_custo(item, session.usuario.funcao_usuario)


@router.post(
    "/{id_item}/ajuste", response_model=EstoqueItemResponse, summary="Ajusta saldo do estoque"
)
async def ajustar_saldo_estoque(
    id_item: UUID,
    payload: EstoqueAjuste,
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
) -> EstoqueItemResponse:
    if not _pode_gerenciar(session.usuario.funcao_usuario):
        raise HTTPException(status_code=403, detail="Técnicos não podem ajustar saldo de estoque")

    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    result = await data_api.rpc(
        "ajustar_estoque_item",
        auth.token,
        payload={
            "p_id_item": str(id_item),
            "p_quantidade_nova": payload.quantidade_nova,
            "p_motivo": payload.motivo,
        },
    )
    if not result:
        raise HTTPException(status_code=404, detail="Item de estoque não encontrado")
    row = result[0] if isinstance(result, list) else result
    item = EstoqueItemResponse.model_validate(row)
    return _ocultar_custo(item, session.usuario.funcao_usuario)


@router.get(
    "/{id_item}/movimentos",
    response_model=list[MovimentoEstoqueResponse],
    summary="Lista movimentações de um item",
)
async def listar_movimentos(
    id_item: UUID,
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
    limite: Annotated[int, Query(ge=1, le=100)] = 30,
) -> list[MovimentoEstoqueResponse]:
    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    rows = await data_api.select(
        "movimentos_estoque",
        auth.token,
        params={
            "select": (
                "id_movimento,id_assistencia,id_item,id_usuario,tipo,quantidade,"
                "quantidade_anterior,quantidade_nova,motivo,data_movimento"
            ),
            "id_assistencia": f"eq.{session.usuario.id_assistencia}",
            "id_item": f"eq.{id_item}",
            "order": "data_movimento.desc",
            "limit": str(limite),
        },
    )
    return [MovimentoEstoqueResponse.model_validate(row) for row in rows]
