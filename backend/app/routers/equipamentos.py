from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.dependencies import CurrentSession
from app.schemas_equipamentos import (
    EquipamentoCreate,
    EquipamentoResponse,
    EquipamentoUpdate,
)
from app.security import AuthenticatedRequest, get_authenticated_request
from app.supabase import SupabaseDataAPI

router = APIRouter(prefix="/equipamentos", tags=["Equipamentos"])

AuthRequest = Annotated[AuthenticatedRequest, Depends(get_authenticated_request)]

EQUIPAMENTO_SELECT = (
    "id_equip,id_assistencia,id_cliente,marca_equip,modelo_equip,"
    "cor_equip,num_serie,descr_equip,data_criacao"
)


@router.get("", response_model=list[EquipamentoResponse], summary="Lista equipamentos")
async def list_equipamentos(
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
    id_cliente: UUID | None = None,
    limite: Annotated[int, Query(ge=1, le=100)] = 50,
    pagina: Annotated[int, Query(ge=1)] = 1,
) -> list[EquipamentoResponse]:
    params = {
        "select": EQUIPAMENTO_SELECT,
        "id_assistencia": f"eq.{session.usuario.id_assistencia}",
        "order": "data_criacao.desc",
        "limit": str(limite),
        "offset": str((pagina - 1) * limite),
    }
    if id_cliente:
        params["id_cliente"] = f"eq.{id_cliente}"

    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    rows = await data_api.select("equipamentos", auth.token, params=params)
    return [EquipamentoResponse.model_validate(row) for row in rows]


@router.get("/{id_equip}", response_model=EquipamentoResponse, summary="Consulta um equipamento")
async def get_equipamento(
    id_equip: UUID,
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
) -> EquipamentoResponse:
    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    rows = await data_api.select(
        "equipamentos",
        auth.token,
        params={
            "select": EQUIPAMENTO_SELECT,
            "id_equip": f"eq.{id_equip}",
            "id_assistencia": f"eq.{session.usuario.id_assistencia}",
            "limit": "1",
        },
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado")
    return EquipamentoResponse.model_validate(rows[0])


@router.post(
    "",
    response_model=EquipamentoResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastra um equipamento",
)
async def create_equipamento(
    payload: EquipamentoCreate,
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
) -> EquipamentoResponse:
    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    row = await data_api.insert(
        "equipamentos",
        auth.token,
        payload={
            **payload.model_dump(mode="json"),
            "id_assistencia": str(session.usuario.id_assistencia),
        },
    )
    return EquipamentoResponse.model_validate(row)


@router.patch("/{id_equip}", response_model=EquipamentoResponse, summary="Altera um equipamento")
async def update_equipamento(
    id_equip: UUID,
    payload: EquipamentoUpdate,
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
) -> EquipamentoResponse:
    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    row = await data_api.update(
        "equipamentos",
        auth.token,
        filters={
            "id_equip": f"eq.{id_equip}",
            "id_assistencia": f"eq.{session.usuario.id_assistencia}",
        },
        payload=payload.model_dump(exclude_unset=True, mode="json"),
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado")
    return EquipamentoResponse.model_validate(row)
