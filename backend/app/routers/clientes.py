from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.dependencies import CurrentSession
from app.schemas_clientes import ClienteCreate, ClienteResponse, ClienteUpdate
from app.security import AuthenticatedRequest, get_authenticated_request
from app.supabase import SupabaseDataAPI

router = APIRouter(prefix="/clientes", tags=["Clientes"])

AuthRequest = Annotated[AuthenticatedRequest, Depends(get_authenticated_request)]

CLIENTE_SELECT = (
    "id_cliente,id_assistencia,cpf_cliente,nome_cliente,telefone,endereco_cliente,data_criacao"
)


@router.get("", response_model=list[ClienteResponse], summary="Lista clientes")
async def list_clientes(
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
    busca: Annotated[str | None, Query(min_length=2, max_length=100)] = None,
    limite: Annotated[int, Query(ge=1, le=100)] = 50,
    pagina: Annotated[int, Query(ge=1)] = 1,
) -> list[ClienteResponse]:
    params = {
        "select": CLIENTE_SELECT,
        "order": "nome_cliente.asc",
        "limit": str(limite),
        "offset": str((pagina - 1) * limite),
    }
    if busca:
        termo = busca.strip().replace("*", "")
        params["nome_cliente"] = f"ilike.*{termo}*"

    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    rows = await data_api.select("clientes", auth.token, params=params)
    return [ClienteResponse.model_validate(row) for row in rows]


@router.get("/{id_cliente}", response_model=ClienteResponse, summary="Consulta um cliente")
async def get_cliente(
    id_cliente: UUID,
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
) -> ClienteResponse:
    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    rows = await data_api.select(
        "clientes",
        auth.token,
        params={"select": CLIENTE_SELECT, "id_cliente": f"eq.{id_cliente}", "limit": "1"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return ClienteResponse.model_validate(rows[0])


@router.post(
    "",
    response_model=ClienteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastra um cliente",
)
async def create_cliente(
    payload: ClienteCreate,
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
) -> ClienteResponse:
    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    row = await data_api.insert(
        "clientes",
        auth.token,
        payload={
            **payload.model_dump(),
            "id_assistencia": str(session.usuario.id_assistencia),
        },
    )
    return ClienteResponse.model_validate(row)


@router.patch("/{id_cliente}", response_model=ClienteResponse, summary="Altera um cliente")
async def update_cliente(
    id_cliente: UUID,
    payload: ClienteUpdate,
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
) -> ClienteResponse:
    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    row = await data_api.update(
        "clientes",
        auth.token,
        filters={"id_cliente": f"eq.{id_cliente}"},
        payload=payload.model_dump(exclude_unset=True),
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return ClienteResponse.model_validate(row)
