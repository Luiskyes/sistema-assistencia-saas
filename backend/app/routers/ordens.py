from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from app.dependencies import CurrentSession
from app.schemas import FuncaoUsuario
from app.schemas_ordens import (
    AlteracaoStatusOS,
    AtualizacaoCompraExterna,
    CancelamentoManutencao,
    HistoricoOSResponse,
    OrdemCreate,
    OrdemItemCreate,
    OrdemItemResponse,
    OrdemResponse,
    OrdemUpdate,
    StatusOS,
    TipoItemOS,
)
from app.security import AuthenticatedRequest, get_authenticated_request
from app.services.pre_nota_pdf import PreNotaDados, gerar_pre_nota_pdf
from app.supabase import SupabaseDataAPI

router = APIRouter(prefix="/ordens", tags=["Ordens de Serviço"])
AuthRequest = Annotated[AuthenticatedRequest, Depends(get_authenticated_request)]

ORDEM_SELECT = (
    "id_os,id_assistencia,num_os,id_cliente,id_equip,id_usuario_abertura,"
    "id_tecnico_responsavel,data_aber,data_atual,data_conc,data_entre,"
    "defeito_relatorio,diag_os,valor_total,status_os,obser_os,prioridade_os,"
    "destino_pecas_cancelamento,data_cancelamento"
)
ORDEM_ITEM_SELECT = (
    "id_item_os,id_assistencia,id_os,tipo,id_item_estoque,descricao,"
    "quantidade,valor_unitario,fornecedor,custo_unitario,status_compra,"
    "data_compra,data_recebimento,subtotal,data_criacao"
)

TRANSICOES: dict[StatusOS, set[StatusOS]] = {
    StatusOS.RECEBIDO: {StatusOS.EM_ANALISE, StatusOS.CANCELADO},
    StatusOS.EM_ANALISE: {
        StatusOS.AGUARDANDO_APROVACAO,
        StatusOS.CANCELADO,
    },
    StatusOS.AGUARDANDO_APROVACAO: {StatusOS.EM_MANUTENCAO, StatusOS.CANCELADO},
    StatusOS.EM_MANUTENCAO: {StatusOS.CONCLUIDO, StatusOS.CANCELADO},
    StatusOS.CONCLUIDO: {StatusOS.ENTREGUE},
    StatusOS.ENTREGUE: set(),
    StatusOS.CANCELADO: set(),
}


def _status_permitido_por_funcao(
    funcao: FuncaoUsuario,
    atual: StatusOS,
    novo: StatusOS,
) -> bool:
    if funcao == FuncaoUsuario.DONO:
        return novo in TRANSICOES[atual]

    if funcao == FuncaoUsuario.TECNICO:
        permitidos = {
            (StatusOS.RECEBIDO, StatusOS.EM_ANALISE),
            (StatusOS.EM_ANALISE, StatusOS.AGUARDANDO_APROVACAO),
            (StatusOS.EM_ANALISE, StatusOS.EM_MANUTENCAO),
            (StatusOS.EM_MANUTENCAO, StatusOS.CONCLUIDO),
        }
        return (atual, novo) in permitidos

    if funcao == FuncaoUsuario.RECEPCIONISTA:
        permitidos = {
            (StatusOS.RECEBIDO, StatusOS.CANCELADO),
            (StatusOS.AGUARDANDO_APROVACAO, StatusOS.EM_MANUTENCAO),
            (StatusOS.AGUARDANDO_APROVACAO, StatusOS.CANCELADO),
            (StatusOS.CONCLUIDO, StatusOS.ENTREGUE),
        }
        return (atual, novo) in permitidos

    return False


async def _buscar_ordem(
    data_api: SupabaseDataAPI,
    token: str,
    id_assistencia: UUID,
    id_os: UUID,
) -> OrdemResponse:
    rows = await data_api.select(
        "ordens_servico",
        token,
        params={
            "select": ORDEM_SELECT,
            "id_assistencia": f"eq.{id_assistencia}",
            "id_os": f"eq.{id_os}",
            "limit": "1",
        },
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Ordem de serviço não encontrada")
    return OrdemResponse.model_validate(rows[0])


async def _validar_cliente_equipamento(
    data_api: SupabaseDataAPI,
    token: str,
    id_assistencia: UUID,
    id_cliente: UUID,
    id_equip: UUID,
) -> None:
    clientes = await data_api.select(
        "clientes",
        token,
        params={
            "select": "id_cliente",
            "id_assistencia": f"eq.{id_assistencia}",
            "id_cliente": f"eq.{id_cliente}",
            "limit": "1",
        },
    )
    if not clientes:
        raise HTTPException(status_code=404, detail="Cliente não encontrado nesta assistência")

    equipamentos = await data_api.select(
        "equipamentos",
        token,
        params={
            "select": "id_equip,id_cliente",
            "id_assistencia": f"eq.{id_assistencia}",
            "id_equip": f"eq.{id_equip}",
            "id_cliente": f"eq.{id_cliente}",
            "limit": "1",
        },
    )
    if not equipamentos:
        raise HTTPException(
            status_code=400,
            detail="O equipamento selecionado não pertence ao cliente informado",
        )


async def _validar_tecnico(
    data_api: SupabaseDataAPI,
    token: str,
    id_assistencia: UUID,
    id_tecnico: UUID | None,
) -> None:
    if id_tecnico is None:
        return
    rows = await data_api.select(
        "usuarios",
        token,
        params={
            "select": "id_usuario,funcao_usuario,ativo",
            "id_assistencia": f"eq.{id_assistencia}",
            "id_usuario": f"eq.{id_tecnico}",
            "ativo": "eq.true",
            "limit": "1",
        },
    )
    if not rows or rows[0].get("funcao_usuario") not in {"TECNICO", "DONO"}:
        raise HTTPException(status_code=400, detail="Técnico responsável inválido")


@router.get("", response_model=list[OrdemResponse], summary="Lista ordens de serviço")
async def listar_ordens(
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
    limite: Annotated[int, Query(ge=1, le=200)] = 100,
    pagina: Annotated[int, Query(ge=1)] = 1,
) -> list[OrdemResponse]:
    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    rows = await data_api.select(
        "ordens_servico",
        auth.token,
        params={
            "select": ORDEM_SELECT,
            "id_assistencia": f"eq.{session.usuario.id_assistencia}",
            "order": "data_aber.desc",
            "limit": str(limite),
            "offset": str((pagina - 1) * limite),
        },
    )
    return [OrdemResponse.model_validate(row) for row in rows]


@router.post(
    "",
    response_model=OrdemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Abre ordem de serviço",
)
async def criar_ordem(
    payload: OrdemCreate,
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
) -> OrdemResponse:
    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    id_assistencia = session.usuario.id_assistencia

    await _validar_cliente_equipamento(
        data_api,
        auth.token,
        id_assistencia,
        payload.id_cliente,
        payload.id_equip,
    )
    await _validar_tecnico(
        data_api,
        auth.token,
        id_assistencia,
        payload.id_tecnico_responsavel,
    )

    numero = await data_api.rpc("proxima_numero_os", auth.token, payload={})
    if not isinstance(numero, str) or not numero:
        raise HTTPException(status_code=502, detail="Não foi possível gerar o número da OS")

    row = await data_api.insert(
        "ordens_servico",
        auth.token,
        payload={
            "id_assistencia": str(id_assistencia),
            "num_os": numero,
            "id_cliente": str(payload.id_cliente),
            "id_equip": str(payload.id_equip),
            "id_usuario_abertura": str(session.usuario.id_usuario),
            "id_tecnico_responsavel": (
                str(payload.id_tecnico_responsavel) if payload.id_tecnico_responsavel else None
            ),
            "defeito_relatorio": payload.defeito_relatorio,
            "obser_os": payload.obser_os,
            "prioridade_os": payload.prioridade_os.value,
            "status_os": StatusOS.RECEBIDO.value,
        },
    )
    return OrdemResponse.model_validate(row)


@router.patch("/{id_os}", response_model=OrdemResponse, summary="Atualiza dados da OS")
async def atualizar_ordem(
    id_os: UUID,
    payload: OrdemUpdate,
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
) -> OrdemResponse:
    funcao = session.usuario.funcao_usuario
    fields = payload.model_fields_set

    if funcao == FuncaoUsuario.RECEPCIONISTA:
        permitidos = {"defeito_relatorio", "obser_os", "prioridade_os", "id_tecnico_responsavel"}
        if not fields.issubset(permitidos):
            raise HTTPException(
                status_code=403, detail="Recepção não pode alterar diagnóstico técnico"
            )
    elif funcao == FuncaoUsuario.TECNICO:
        permitidos = {"diag_os", "obser_os", "valor_total"}
        if not fields.issubset(permitidos):
            raise HTTPException(
                status_code=403,
                detail="Técnico pode alterar apenas diagnóstico, orçamento e observações",
            )

    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    id_assistencia = session.usuario.id_assistencia
    ordem = await _buscar_ordem(data_api, auth.token, id_assistencia, id_os)

    if (
        funcao == FuncaoUsuario.TECNICO
        and ordem.id_tecnico_responsavel is not None
        and ordem.id_tecnico_responsavel != session.usuario.id_usuario
    ):
        raise HTTPException(
            status_code=403,
            detail="Esta OS está atribuída a outro técnico",
        )

    if "id_tecnico_responsavel" in fields:
        await _validar_tecnico(
            data_api,
            auth.token,
            id_assistencia,
            payload.id_tecnico_responsavel,
        )

    body = payload.model_dump(exclude_unset=True, mode="json")
    if (
        funcao in {FuncaoUsuario.DONO, FuncaoUsuario.TECNICO}
        and fields.intersection({"diag_os", "valor_total"})
        and ordem.id_tecnico_responsavel is None
    ):
        body["id_tecnico_responsavel"] = str(session.usuario.id_usuario)
    row = await data_api.update(
        "ordens_servico",
        auth.token,
        filters={
            "id_assistencia": f"eq.{id_assistencia}",
            "id_os": f"eq.{id_os}",
        },
        payload=body,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Ordem de serviço não encontrada")
    return OrdemResponse.model_validate(row)


def _pode_editar_orcamento(funcao: FuncaoUsuario, ordem: OrdemResponse) -> bool:
    return (
        funcao in {FuncaoUsuario.DONO, FuncaoUsuario.TECNICO}
        and ordem.status_os in {StatusOS.RECEBIDO, StatusOS.EM_ANALISE}
    )


@router.get(
    "/{id_os}/itens",
    response_model=list[OrdemItemResponse],
    summary="Lista peças e serviços do orçamento",
)
async def listar_itens_ordem(
    id_os: UUID,
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
) -> list[OrdemItemResponse]:
    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    await _buscar_ordem(
        data_api, auth.token, session.usuario.id_assistencia, id_os
    )
    rows = await data_api.select(
        "itens_os",
        auth.token,
        params={
            "select": ORDEM_ITEM_SELECT,
            "id_assistencia": f"eq.{session.usuario.id_assistencia}",
            "id_os": f"eq.{id_os}",
            "order": "data_criacao.asc",
        },
    )
    if session.usuario.funcao_usuario != FuncaoUsuario.DONO:
        for row in rows:
            row["custo_unitario"] = None
    return [OrdemItemResponse.model_validate(row) for row in rows]


@router.post(
    "/{id_os}/itens",
    response_model=OrdemItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Adiciona peça ou serviço ao orçamento",
)
async def adicionar_item_ordem(
    id_os: UUID,
    payload: OrdemItemCreate,
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
) -> OrdemItemResponse:
    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    id_assistencia = session.usuario.id_assistencia
    ordem = await _buscar_ordem(data_api, auth.token, id_assistencia, id_os)
    if session.usuario.funcao_usuario not in {FuncaoUsuario.DONO, FuncaoUsuario.TECNICO}:
        raise HTTPException(status_code=403, detail="Sua função não pode alterar o orçamento")
    if not _pode_editar_orcamento(session.usuario.funcao_usuario, ordem):
        raise HTTPException(status_code=409, detail="O orçamento não pode mais ser alterado")
    if (
        session.usuario.funcao_usuario == FuncaoUsuario.TECNICO
        and ordem.id_tecnico_responsavel not in {None, session.usuario.id_usuario}
    ):
        raise HTTPException(status_code=403, detail="Esta OS está atribuída a outro técnico")

    descricao = payload.descricao
    valor_unitario = payload.valor_unitario
    if payload.tipo == TipoItemOS.PECA and payload.id_item_estoque is not None:
        estoque = await data_api.select(
            "estoque_itens",
            auth.token,
            params={
                "select": "id_item,descricao,quantidade_atual,preco_venda,ativo",
                "id_assistencia": f"eq.{id_assistencia}",
                "id_item": f"eq.{payload.id_item_estoque}",
                "ativo": "eq.true",
                "limit": "1",
            },
        )
        if not estoque:
            raise HTTPException(status_code=404, detail="Peça não encontrada no estoque")
        item = estoque[0]
        if Decimal(str(item["quantidade_atual"])) < payload.quantidade:
            raise HTTPException(status_code=409, detail="Quantidade indisponível no estoque")
        descricao = str(item["descricao"])
        if valor_unitario is None:
            valor_unitario = Decimal(str(item.get("preco_venda") or 0))

    row = await data_api.insert(
        "itens_os",
        auth.token,
        payload={
            "id_assistencia": str(id_assistencia),
            "id_os": str(id_os),
            "tipo": payload.tipo.value,
            "id_item_estoque": (
                str(payload.id_item_estoque) if payload.id_item_estoque else None
            ),
            "descricao": descricao,
            "quantidade": str(payload.quantidade),
            "valor_unitario": str(valor_unitario or Decimal("0")),
            "fornecedor": payload.fornecedor if payload.id_item_estoque is None else None,
            "custo_unitario": (
                str(payload.custo_unitario)
                if payload.id_item_estoque is None and payload.custo_unitario is not None
                else None
            ),
            "status_compra": (
                "SOLICITADA"
                if payload.tipo == TipoItemOS.PECA and payload.id_item_estoque is None
                else None
            ),
        },
    )
    if session.usuario.funcao_usuario != FuncaoUsuario.DONO:
        row["custo_unitario"] = None
    return OrdemItemResponse.model_validate(row)


@router.delete(
    "/{id_os}/itens/{id_item_os}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove item do orçamento",
)
async def remover_item_ordem(
    id_os: UUID,
    id_item_os: UUID,
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
) -> Response:
    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    id_assistencia = session.usuario.id_assistencia
    ordem = await _buscar_ordem(data_api, auth.token, id_assistencia, id_os)
    if session.usuario.funcao_usuario not in {FuncaoUsuario.DONO, FuncaoUsuario.TECNICO}:
        raise HTTPException(status_code=403, detail="Sua função não pode alterar o orçamento")
    if not _pode_editar_orcamento(session.usuario.funcao_usuario, ordem):
        raise HTTPException(status_code=409, detail="O orçamento não pode mais ser alterado")
    deleted = await data_api.delete(
        "itens_os",
        auth.token,
        filters={
            "id_assistencia": f"eq.{id_assistencia}",
            "id_os": f"eq.{id_os}",
            "id_item_os": f"eq.{id_item_os}",
        },
    )
    if deleted is None:
        raise HTTPException(status_code=404, detail="Item do orçamento não encontrado")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch(
    "/{id_os}/itens/{id_item_os}/compra",
    response_model=OrdemItemResponse,
    summary="Atualiza o acompanhamento de uma peça comprada para a OS",
)
async def atualizar_compra_externa(
    id_os: UUID,
    id_item_os: UUID,
    payload: AtualizacaoCompraExterna,
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
) -> OrdemItemResponse:
    if session.usuario.funcao_usuario not in {FuncaoUsuario.DONO, FuncaoUsuario.RECEPCIONISTA}:
        raise HTTPException(
            status_code=403,
            detail="Sua função não pode atualizar compras externas",
        )
    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    result = await data_api.rpc(
        "atualizar_compra_externa_os",
        auth.token,
        payload={
            "p_id_os": str(id_os),
            "p_id_item_os": str(id_item_os),
            "p_status": payload.status_compra.value,
        },
    )
    if not isinstance(result, list) or not result:
        raise HTTPException(status_code=502, detail="Banco não retornou a compra atualizada")
    row = result[0]
    if session.usuario.funcao_usuario != FuncaoUsuario.DONO:
        row["custo_unitario"] = None
    return OrdemItemResponse.model_validate(row)


@router.post(
    "/{id_os}/cancelamento-manutencao",
    response_model=OrdemResponse,
    summary="Cancela a manutenção registrando o destino das peças",
)
async def cancelar_manutencao(
    id_os: UUID,
    payload: CancelamentoManutencao,
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
) -> OrdemResponse:
    if session.usuario.funcao_usuario not in {FuncaoUsuario.DONO, FuncaoUsuario.RECEPCIONISTA}:
        raise HTTPException(status_code=403, detail="Sua função não pode cancelar uma manutenção")
    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    result = await data_api.rpc(
        "cancelar_manutencao_com_destino",
        auth.token,
        payload={"p_id_os": str(id_os), "p_destino": payload.destino_pecas.value},
    )
    if not isinstance(result, list) or not result:
        raise HTTPException(status_code=502, detail="Banco não retornou a OS cancelada")
    return OrdemResponse.model_validate(result[0])


@router.post("/{id_os}/status", response_model=OrdemResponse, summary="Altera status da OS")
async def alterar_status(
    id_os: UUID,
    payload: AlteracaoStatusOS,
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
) -> OrdemResponse:
    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    id_assistencia = session.usuario.id_assistencia
    ordem = await _buscar_ordem(data_api, auth.token, id_assistencia, id_os)

    if (
        session.usuario.funcao_usuario == FuncaoUsuario.TECNICO
        and ordem.id_tecnico_responsavel is not None
        and ordem.id_tecnico_responsavel != session.usuario.id_usuario
    ):
        raise HTTPException(
            status_code=403,
            detail="Esta OS está atribuída a outro técnico",
        )

    if payload.status_os not in TRANSICOES[ordem.status_os]:
        raise HTTPException(
            status_code=409,
            detail=f"Transição inválida: {ordem.status_os.value} → {payload.status_os.value}",
        )

    if ordem.status_os == StatusOS.EM_MANUTENCAO and payload.status_os == StatusOS.CANCELADO:
        raise HTTPException(
            status_code=409,
            detail="Informe o destino das peças antes de cancelar a manutenção",
        )

    if payload.status_os == StatusOS.AGUARDANDO_APROVACAO:
        if not (ordem.diag_os or "").strip():
            raise HTTPException(
                status_code=409,
                detail="Informe o diagnóstico antes de enviar o orçamento para aprovação",
            )
        if ordem.valor_total <= Decimal("0"):
            raise HTTPException(
                status_code=409,
                detail="Informe um orçamento maior que zero antes de solicitar aprovação",
            )

    if payload.status_os == StatusOS.CONCLUIDO:
        if not (ordem.diag_os or "").strip():
            raise HTTPException(
                status_code=409,
                detail="A OS não pode ser concluída sem diagnóstico técnico",
            )
        if ordem.id_tecnico_responsavel is None:
            raise HTTPException(
                status_code=409,
                detail="Defina o técnico responsável antes de concluir a OS",
            )

    if not _status_permitido_por_funcao(
        session.usuario.funcao_usuario,
        ordem.status_os,
        payload.status_os,
    ):
        raise HTTPException(status_code=403, detail="Sua função não pode realizar esta transição")

    update_body: dict[str, str] = {"status_os": payload.status_os.value}
    if (
        payload.status_os == StatusOS.EM_ANALISE
        and ordem.id_tecnico_responsavel is None
        and session.usuario.funcao_usuario in {FuncaoUsuario.DONO, FuncaoUsuario.TECNICO}
    ):
        update_body["id_tecnico_responsavel"] = str(session.usuario.id_usuario)

    if payload.status_os == StatusOS.EM_MANUTENCAO:
        result = await data_api.rpc(
            "iniciar_manutencao_com_estoque",
            auth.token,
            payload={"p_id_os": str(id_os)},
        )
        if not isinstance(result, list) or not result:
            raise HTTPException(status_code=502, detail="Banco não retornou a OS atualizada")
        return OrdemResponse.model_validate(result[0])

    row = await data_api.update(
        "ordens_servico",
        auth.token,
        filters={
            "id_assistencia": f"eq.{id_assistencia}",
            "id_os": f"eq.{id_os}",
        },
        # O trigger do banco preenche data_conc/data_entre de forma atômica.
        payload=update_body,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Ordem de serviço não encontrada")
    return OrdemResponse.model_validate(row)


@router.get(
    "/{id_os}/pre-nota.pdf",
    summary="Gera a pré-nota/orçamento em PDF",
    response_class=Response,
)
async def gerar_pre_nota(
    id_os: UUID,
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
    download: bool = False,
) -> Response:
    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    id_assistencia = session.usuario.id_assistencia
    ordem = await _buscar_ordem(data_api, auth.token, id_assistencia, id_os)

    if ordem.status_os not in {
        StatusOS.EM_ANALISE,
        StatusOS.AGUARDANDO_APROVACAO,
    }:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pré-nota só fica disponível durante a análise e a aprovação",
        )

    if not ordem.diag_os or not ordem.diag_os.strip():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pré-nota só pode ser gerada após o diagnóstico técnico",
        )
    if (ordem.valor_total or Decimal("0")) <= 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pré-nota só pode ser gerada após informar um orçamento maior que zero",
        )

    clientes = await data_api.select(
        "clientes",
        auth.token,
        params={
            "select": "id_cliente,nome_cliente,cpf_cliente,telefone,endereco_cliente",
            "id_assistencia": f"eq.{id_assistencia}",
            "id_cliente": f"eq.{ordem.id_cliente}",
            "limit": "1",
        },
    )
    equipamentos = await data_api.select(
        "equipamentos",
        auth.token,
        params={
            "select": ("id_equip,marca_equip,modelo_equip,cor_equip,num_serie,descr_equip"),
            "id_assistencia": f"eq.{id_assistencia}",
            "id_equip": f"eq.{ordem.id_equip}",
            "limit": "1",
        },
    )
    assistencias = await data_api.select(
        "assistencias",
        auth.token,
        params={
            "select": "id_assistencia,nome_assistencia",
            "id_assistencia": f"eq.{id_assistencia}",
            "limit": "1",
        },
    )

    if not clientes or not equipamentos:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cliente ou equipamento da OS não pôde ser carregado para a pré-nota",
        )

    tecnico_nome: str | None = None
    if ordem.id_tecnico_responsavel:
        tecnicos = await data_api.select(
            "usuarios",
            auth.token,
            params={
                "select": "id_usuario,nome_usuario",
                "id_assistencia": f"eq.{id_assistencia}",
                "id_usuario": f"eq.{ordem.id_tecnico_responsavel}",
                "limit": "1",
            },
        )
        if tecnicos:
            tecnico_nome = tecnicos[0].get("nome_usuario")

    cliente = clientes[0]
    equipamento = equipamentos[0]
    assistencia_nome = (
        assistencias[0].get("nome_assistencia") if assistencias else "Assistência técnica"
    )

    pdf = gerar_pre_nota_pdf(
        PreNotaDados(
            assistencia_nome=assistencia_nome or "Assistência técnica",
            numero_os=ordem.num_os,
            data_abertura=ordem.data_aber,
            status=ordem.status_os.value,
            cliente_nome=cliente.get("nome_cliente") or "Cliente",
            cliente_cpf=cliente.get("cpf_cliente"),
            cliente_telefone=cliente.get("telefone"),
            cliente_endereco=cliente.get("endereco_cliente"),
            equipamento_marca=equipamento.get("marca_equip"),
            equipamento_modelo=equipamento.get("modelo_equip"),
            equipamento_cor=equipamento.get("cor_equip"),
            equipamento_serie=equipamento.get("num_serie"),
            equipamento_descricao=equipamento.get("descr_equip"),
            defeito_relatado=ordem.defeito_relatorio,
            diagnostico=ordem.diag_os,
            tecnico_nome=tecnico_nome,
            valor_total=ordem.valor_total,
            observacoes=ordem.obser_os,
        )
    )

    disposition = "attachment" if download else "inline"
    safe_number = ordem.num_os.replace("/", "-").replace("\\", "-")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (f'{disposition}; filename="pre-nota-{safe_number}.pdf"'),
            "Cache-Control": "no-store",
        },
    )


@router.post(
    "/{id_os}/pre-nota/impressao",
    summary="Emite a pré-nota e encaminha a OS para aprovação",
    response_class=Response,
)
async def emitir_pre_nota_para_aprovacao(
    id_os: UUID,
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
) -> Response:
    """Gera a pré-nota e aplica a transição automática da OS.

    A emissão da pré-nota representa operacionalmente o envio do
    orçamento para aprovação do cliente. Por isso essa transição não
    exige confirmação manual na interface.
    """
    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    id_assistencia = session.usuario.id_assistencia

    ordem = await _buscar_ordem(
        data_api,
        auth.token,
        id_assistencia,
        id_os,
    )

    # A emissão da pré-nota é uma ação de processo. Se a OS ainda estiver
    # RECEBIDO, mas já possuir diagnóstico e orçamento válidos, o próprio
    # backend conduz a OS pelas etapas automáticas necessárias.
    #
    # RECEBIDO -> EM_ANALISE -> AGUARDANDO_APROVACAO
    #
    # Não há confirmação manual nessas transições porque o clique em
    # emitir a pré-nota já representa a decisão operacional do técnico.
    if ordem.status_os not in {
        StatusOS.EM_ANALISE,
        StatusOS.AGUARDANDO_APROVACAO,
    }:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pré-nota não pode ser emitida no status atual da OS",
        )

    # Validação leve antes de avançar o processo.
    # Evita gerar o PDF duas vezes: diagnóstico e orçamento já estão na OS carregada.
    diagnostico = (ordem.diag_os or "").strip()
    valor_total = ordem.valor_total or Decimal("0")

    if not diagnostico:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Informe o diagnóstico técnico antes de emitir a pré-nota",
        )

    if valor_total <= 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Informe um orçamento maior que zero antes de emitir a pré-nota",
        )

    if ordem.status_os == StatusOS.EM_ANALISE:
        await alterar_status(
            id_os=id_os,
            payload=AlteracaoStatusOS(
                status_os=StatusOS.AGUARDANDO_APROVACAO,
            ),
            request=request,
            session=session,
            auth=auth,
        )

    # Gera novamente para o recibo já exibir o status atualizado.
    return await gerar_pre_nota(
        id_os=id_os,
        request=request,
        session=session,
        auth=auth,
        download=False,
    )


@router.get(
    "/{id_os}/historico",
    response_model=list[HistoricoOSResponse],
    summary="Lista histórico da OS",
)
async def listar_historico(
    id_os: UUID,
    request: Request,
    session: CurrentSession,
    auth: AuthRequest,
) -> list[HistoricoOSResponse]:
    data_api: SupabaseDataAPI = request.app.state.supabase_data_api
    await _buscar_ordem(
        data_api,
        auth.token,
        session.usuario.id_assistencia,
        id_os,
    )
    rows = await data_api.select(
        "historicos_os",
        auth.token,
        params={
            "select": (
                "id_hist,id_assistencia,id_usuario,id_os,data_evento,"
                "status_anterior,status_novo,obs_hist"
            ),
            "id_assistencia": f"eq.{session.usuario.id_assistencia}",
            "id_os": f"eq.{id_os}",
            "order": "data_evento.desc",
            "limit": "100",
        },
    )
    return [HistoricoOSResponse.model_validate(row) for row in rows]
