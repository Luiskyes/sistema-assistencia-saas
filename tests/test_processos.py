import os
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

os.environ.setdefault("SUPABASE_URL", "https://projeto-teste.supabase.co")
os.environ.setdefault("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_teste")

from app.dependencies import get_current_session  # noqa: E402
from app.main import app  # noqa: E402
from app.schemas import (  # noqa: E402
    AssistenciaAtual,
    FuncaoUsuario,
    SessaoAtual,
    TokenClaims,
    UsuarioAutenticado,
)
from app.security import AuthenticatedRequest, get_authenticated_request  # noqa: E402
from app.services.pre_nota_pdf import PreNotaDados, gerar_pre_nota_pdf  # noqa: E402
from fastapi import HTTPException  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

ASSISTENCIA_ID = UUID("10000000-0000-0000-0000-000000000001")
USUARIO_ID = UUID("20000000-0000-0000-0000-000000000001")
AUTH_ID = UUID("30000000-0000-0000-0000-000000000001")
CLIENTE_ID = UUID("40000000-0000-0000-0000-000000000001")
EQUIPAMENTO_ID = UUID("50000000-0000-0000-0000-000000000001")
ITEM_ID = UUID("60000000-0000-0000-0000-000000000001")
ORDEM_ID = UUID("70000000-0000-0000-0000-000000000001")
ITEM_OS_ID = UUID("80000000-0000-0000-0000-000000000001")
OUTRO_TECNICO_ID = UUID("20000000-0000-0000-0000-000000000099")
AGORA = datetime(2026, 8, 17, 12, 0, tzinfo=UTC)


def session_for(funcao: FuncaoUsuario):
    async def fake_session() -> SessaoAtual:
        return SessaoAtual(
            usuario=UsuarioAutenticado(
                id_usuario=USUARIO_ID,
                id_auth=AUTH_ID,
                id_assistencia=ASSISTENCIA_ID,
                cpf_usuario=None,
                nome_usuario="Usuário Teste",
                funcao_usuario=funcao,
                email_usuario="usuario@example.com",
                ativo=True,
                data_criacao=AGORA,
            ),
            assistencia=AssistenciaAtual(
                id_assistencia=ASSISTENCIA_ID,
                nome_assistencia="Assistência Teste",
                ativo=True,
            ),
        )

    return fake_session


async def fake_auth() -> AuthenticatedRequest:
    return AuthenticatedRequest(
        token="token-de-teste",
        claims=TokenClaims(
            sub=AUTH_ID,
            role="authenticated",
            email="usuario@example.com",
            exp=2_000_000_000,
            iss="https://projeto-teste.supabase.co/auth/v1",
        ),
    )


class FakeProcessDataAPI:
    def __init__(
        self,
        *,
        status_os: str = "RECEBIDO",
        diagnostico: str | None = "Placa em curto",
        valor_total: str = "250.35",
        tecnico_id: UUID | None = None,
    ) -> None:
        self.status_os = status_os
        self.diagnostico = diagnostico
        self.valor_total = valor_total
        self.tecnico_id = tecnico_id
        self.insert_payload: dict[str, object] | None = None
        self.update_payload: dict[str, object] | None = None
        self.update_payloads: list[dict[str, object]] = []
        self.rpc_payload: dict[str, object] | None = None
        self.deleted_filters: dict[str, str] | None = None

    @staticmethod
    def estoque_item(**overrides: object) -> dict[str, object]:
        return {
            "id_item": str(ITEM_ID),
            "id_assistencia": str(ASSISTENCIA_ID),
            "codigo": "TELA-01",
            "descricao": "Tela compatível",
            "categoria": "Telas",
            "marca_compativel": "Samsung",
            "modelo_compativel": "S24",
            "quantidade_atual": 5,
            "quantidade_minima": 2,
            "custo_unitario": "100.10",
            "preco_venda": "180.20",
            "localizacao": "A1",
            "ativo": True,
            "data_criacao": AGORA.isoformat(),
            "data_atualizacao": AGORA.isoformat(),
            **overrides,
        }

    def ordem(self, **overrides: object) -> dict[str, object]:
        return {
            "id_os": str(ORDEM_ID),
            "id_assistencia": str(ASSISTENCIA_ID),
            "num_os": "OS-000001",
            "id_cliente": str(CLIENTE_ID),
            "id_equip": str(EQUIPAMENTO_ID),
            "id_usuario_abertura": str(USUARIO_ID),
            "id_tecnico_responsavel": str(self.tecnico_id) if self.tecnico_id else None,
            "data_aber": AGORA.isoformat(),
            "data_atual": AGORA.isoformat(),
            "data_conc": None,
            "data_entre": None,
            "defeito_relatorio": "Não liga",
            "diag_os": self.diagnostico,
            "valor_total": self.valor_total,
            "status_os": self.status_os,
            "obser_os": None,
            "prioridade_os": "NORMAL",
            **overrides,
        }

    @staticmethod
    def item_os(**overrides: object) -> dict[str, object]:
        return {
            "id_item_os": str(ITEM_OS_ID),
            "id_assistencia": str(ASSISTENCIA_ID),
            "id_os": str(ORDEM_ID),
            "tipo": "SERVICO",
            "id_item_estoque": None,
            "descricao": "Mão de obra",
            "quantidade": "1",
            "valor_unitario": "80.00",
            "subtotal": "80.00",
            "data_criacao": AGORA.isoformat(),
            **overrides,
        }

    async def select(
        self, table: str, token: str, *, params: dict[str, str]
    ) -> list[dict[str, object]]:
        assert token == "token-de-teste"
        assert params.get("id_assistencia", f"eq.{ASSISTENCIA_ID}") == f"eq.{ASSISTENCIA_ID}"
        if table == "estoque_itens":
            return [self.estoque_item()]
        if table == "clientes":
            return [{"id_cliente": str(CLIENTE_ID)}]
        if table == "equipamentos":
            return [{"id_equip": str(EQUIPAMENTO_ID), "id_cliente": str(CLIENTE_ID)}]
        if table == "usuarios":
            return [{"id_usuario": str(USUARIO_ID), "funcao_usuario": "TECNICO", "ativo": True}]
        if table == "ordens_servico":
            return [self.ordem()]
        if table == "itens_os":
            return [self.item_os()]
        return []

    async def insert(
        self, table: str, token: str, *, payload: dict[str, object]
    ) -> dict[str, object]:
        assert token == "token-de-teste"
        self.insert_payload = payload
        if table == "ordens_servico":
            return self.ordem(**payload)
        if table == "itens_os":
            quantidade = Decimal(str(payload["quantidade"]))
            valor = Decimal(str(payload["valor_unitario"]))
            return self.item_os(**payload, subtotal=str(quantidade * valor))
        return self.estoque_item(**payload)

    async def delete(
        self, table: str, token: str, *, filters: dict[str, str]
    ) -> dict[str, object] | None:
        assert token == "token-de-teste"
        assert table == "itens_os"
        self.deleted_filters = filters
        return self.item_os()

    async def update(
        self,
        table: str,
        token: str,
        *,
        filters: dict[str, str],
        payload: dict[str, object],
    ) -> dict[str, object]:
        assert token == "token-de-teste"
        assert filters["id_assistencia"] == f"eq.{ASSISTENCIA_ID}"
        self.update_payload = payload
        self.update_payloads.append(payload)
        if table == "ordens_servico":
            self.status_os = str(payload.get("status_os", self.status_os))
            if "diag_os" in payload:
                self.diagnostico = str(payload["diag_os"])
            if "valor_total" in payload:
                self.valor_total = str(payload["valor_total"])
            if "id_tecnico_responsavel" in payload:
                value = payload["id_tecnico_responsavel"]
                self.tecnico_id = UUID(str(value)) if value else None
            return self.ordem(**payload)
        return self.estoque_item(**payload)

    async def rpc(self, function: str, token: str, *, payload: dict[str, object]) -> object:
        assert token == "token-de-teste"
        self.rpc_payload = payload
        if function == "proxima_numero_os":
            return "OS-000001"
        if function == "ajustar_estoque_item":
            return [self.estoque_item(quantidade_atual=payload["p_quantidade_nova"])]
        if function == "iniciar_manutencao_com_estoque":
            self.status_os = "EM_MANUTENCAO"
            return [self.ordem()]
        if function == "atualizar_compra_externa_os":
            return [self.item_os(status_compra=payload["p_status"])]
        if function == "cancelar_manutencao_com_destino":
            self.status_os = "CANCELADO"
            return [
                self.ordem(
                    destino_pecas_cancelamento=payload["p_destino"],
                    data_cancelamento=AGORA.isoformat(),
                )
            ]
        raise AssertionError(f"RPC inesperada: {function}")


class ScenarioFlowDataAPI(FakeProcessDataAPI):
    """Simula as garantias atômicas da RPC usada no Supabase."""

    def __init__(self, *, itens: list[dict[str, object]], saldo: int = 5) -> None:
        super().__init__(
            status_os="AGUARDANDO_APROVACAO",
            diagnostico="Defeito confirmado em bancada",
            valor_total="450.00",
            tecnico_id=USUARIO_ID,
        )
        self.itens = itens
        self.saldo = saldo
        self.movimentos: list[dict[str, object]] = []

    async def select(
        self, table: str, token: str, *, params: dict[str, str]
    ) -> list[dict[str, object]]:
        if table == "itens_os":
            return self.itens
        return await super().select(table, token, params=params)

    async def rpc(self, function: str, token: str, *, payload: dict[str, object]) -> object:
        if function == "cancelar_manutencao_com_destino":
            self.rpc_payload = payload
            if self.status_os != "EM_MANUTENCAO":
                raise HTTPException(status_code=400, detail="A OS não está em manutenção")
            if payload["p_destino"] == "DEVOLVER_ESTOQUE":
                devolucao = sum(
                    int(movimento["quantidade"])
                    for movimento in self.movimentos
                    if movimento["tipo"] == "SAIDA"
                )
                saldo_anterior = self.saldo
                self.saldo += devolucao
                if devolucao:
                    self.movimentos.append(
                        {
                            "tipo": "ENTRADA",
                            "quantidade": devolucao,
                            "quantidade_anterior": saldo_anterior,
                            "quantidade_nova": self.saldo,
                            "id_os": str(ORDEM_ID),
                        }
                    )
            self.status_os = "CANCELADO"
            return [
                self.ordem(
                    destino_pecas_cancelamento=payload["p_destino"],
                    data_cancelamento=AGORA.isoformat(),
                )
            ]
        if function != "iniciar_manutencao_com_estoque":
            return await super().rpc(function, token, payload=payload)

        self.rpc_payload = payload
        pendentes = [
            item
            for item in self.itens
            if item["tipo"] == "PECA"
            and item.get("id_item_estoque") is None
            and item.get("status_compra") != "RECEBIDA"
        ]
        if pendentes:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Confirme o recebimento de todas as peças compradas "
                    "antes de iniciar a manutenção"
                ),
            )
        quantidade_estoque = sum(
            int(Decimal(str(item["quantidade"])))
            for item in self.itens
            if item["tipo"] == "PECA" and item.get("id_item_estoque") is not None
        )
        if quantidade_estoque > self.saldo:
            raise HTTPException(
                status_code=400,
                detail="Saldo insuficiente para a peça Tela compatível",
            )

        saldo_anterior = self.saldo
        self.saldo -= quantidade_estoque
        if quantidade_estoque:
            self.movimentos.append(
                {
                    "tipo": "SAIDA",
                    "quantidade": quantidade_estoque,
                    "quantidade_anterior": saldo_anterior,
                    "quantidade_nova": self.saldo,
                    "id_os": str(ORDEM_ID),
                }
            )
        self.status_os = "EM_MANUTENCAO"
        return [self.ordem()]


def configure(funcao: FuncaoUsuario) -> None:
    app.dependency_overrides[get_current_session] = session_for(funcao)
    app.dependency_overrides[get_authenticated_request] = fake_auth


def test_tecnico_consulta_estoque_sem_visualizar_custo() -> None:
    configure(FuncaoUsuario.TECNICO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = FakeProcessDataAPI()
            response = client.get("/api/v1/estoque")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()[0]["custo_unitario"] is None
    assert response.json()[0]["preco_venda"] == 180.2


def test_tecnico_nao_pode_cadastrar_item_no_estoque() -> None:
    fake_api = FakeProcessDataAPI()
    configure(FuncaoUsuario.TECNICO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.post(
                "/api/v1/estoque",
                json={"codigo": "PECA-1", "descricao": "Peça de teste"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403
    assert fake_api.insert_payload is None


def test_ajuste_de_estoque_usa_rpc_atomica() -> None:
    fake_api = FakeProcessDataAPI()
    configure(FuncaoUsuario.RECEPCIONISTA)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.post(
                f"/api/v1/estoque/{ITEM_ID}/ajuste",
                json={"quantidade_nova": 8, "motivo": "Contagem física"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["quantidade_atual"] == 8
    assert response.json()["custo_unitario"] is None
    assert fake_api.rpc_payload == {
        "p_id_item": str(ITEM_ID),
        "p_quantidade_nova": 8,
        "p_motivo": "Contagem física",
    }


def test_dono_visualiza_custo_e_pode_cadastrar_item_no_estoque() -> None:
    fake_api = FakeProcessDataAPI()
    configure(FuncaoUsuario.DONO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            listagem = client.get("/api/v1/estoque")
            cadastro = client.post(
                "/api/v1/estoque",
                json={
                    "codigo": "BAT-01",
                    "descricao": "Bateria compatível",
                    "quantidade_atual": 3,
                    "quantidade_minima": 1,
                    "custo_unitario": 80.5,
                    "preco_venda": 140,
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert listagem.status_code == 200
    assert listagem.json()[0]["custo_unitario"] == 100.1
    assert cadastro.status_code == 201
    assert fake_api.insert_payload is not None
    assert fake_api.insert_payload["id_assistencia"] == str(ASSISTENCIA_ID)


def test_tecnico_nao_pode_ajustar_estoque() -> None:
    fake_api = FakeProcessDataAPI()
    configure(FuncaoUsuario.TECNICO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.post(
                f"/api/v1/estoque/{ITEM_ID}/ajuste",
                json={"quantidade_nova": 4, "motivo": "Contagem física"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403
    assert fake_api.rpc_payload is None


def test_estoque_rejeita_saldo_negativo_antes_de_chamar_banco() -> None:
    fake_api = FakeProcessDataAPI()
    configure(FuncaoUsuario.DONO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.post(
                f"/api/v1/estoque/{ITEM_ID}/ajuste",
                json={"quantidade_nova": -1, "motivo": "Contagem física"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    assert fake_api.rpc_payload is None


def test_abertura_de_ordem_forca_numero_assistencia_e_usuario() -> None:
    fake_api = FakeProcessDataAPI()
    configure(FuncaoUsuario.RECEPCIONISTA)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.post(
                "/api/v1/ordens",
                json={
                    "id_cliente": str(CLIENTE_ID),
                    "id_equip": str(EQUIPAMENTO_ID),
                    "defeito_relatorio": "  Não   liga  ",
                    "prioridade_os": "ALTA",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["num_os"] == "OS-000001"
    assert response.json()["valor_total"] == 250.35
    assert fake_api.insert_payload is not None
    assert fake_api.insert_payload["id_assistencia"] == str(ASSISTENCIA_ID)
    assert fake_api.insert_payload["id_usuario_abertura"] == str(USUARIO_ID)
    assert fake_api.insert_payload["status_os"] == "RECEBIDO"


def test_transicao_invalida_de_ordem_e_bloqueada_sem_update() -> None:
    fake_api = FakeProcessDataAPI(status_os="RECEBIDO")
    configure(FuncaoUsuario.DONO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.post(
                f"/api/v1/ordens/{ORDEM_ID}/status",
                json={"status_os": "ENTREGUE"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert fake_api.update_payload is None


def test_tecnico_nao_pode_marcar_ordem_como_entregue() -> None:
    fake_api = FakeProcessDataAPI(status_os="CONCLUIDO")
    configure(FuncaoUsuario.TECNICO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.post(
                f"/api/v1/ordens/{ORDEM_ID}/status",
                json={"status_os": "ENTREGUE"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403
    assert fake_api.update_payload is None


def test_fluxo_completo_da_os_exige_aprovacao_e_chega_a_entregue() -> None:
    fake_api = FakeProcessDataAPI(tecnico_id=USUARIO_ID)
    configure(FuncaoUsuario.DONO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            respostas = [
                client.post(
                    f"/api/v1/ordens/{ORDEM_ID}/status",
                    json={"status_os": proximo},
                )
                for proximo in (
                    "EM_ANALISE",
                    "AGUARDANDO_APROVACAO",
                    "EM_MANUTENCAO",
                    "CONCLUIDO",
                    "ENTREGUE",
                )
            ]
    finally:
        app.dependency_overrides.clear()

    assert [response.status_code for response in respostas] == [200, 200, 200, 200, 200]
    assert [response.json()["status_os"] for response in respostas] == [
        "EM_ANALISE",
        "AGUARDANDO_APROVACAO",
        "EM_MANUTENCAO",
        "CONCLUIDO",
        "ENTREGUE",
    ]
    assert fake_api.rpc_payload == {"p_id_os": str(ORDEM_ID)}


def test_tecnico_adiciona_servico_ao_orcamento() -> None:
    fake_api = FakeProcessDataAPI(status_os="EM_ANALISE", tecnico_id=USUARIO_ID)
    configure(FuncaoUsuario.TECNICO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.post(
                f"/api/v1/ordens/{ORDEM_ID}/itens",
                json={
                    "tipo": "SERVICO",
                    "descricao": "Troca do conector",
                    "quantidade": 1,
                    "valor_unitario": 90.5,
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["subtotal"] == 90.5
    assert fake_api.insert_payload["id_assistencia"] == str(ASSISTENCIA_ID)


def test_peca_do_orcamento_usa_descricao_e_preco_do_estoque() -> None:
    fake_api = FakeProcessDataAPI(status_os="EM_ANALISE", tecnico_id=USUARIO_ID)
    configure(FuncaoUsuario.DONO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.post(
                f"/api/v1/ordens/{ORDEM_ID}/itens",
                json={"tipo": "PECA", "id_item_estoque": str(ITEM_ID), "quantidade": 2},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert str(fake_api.insert_payload["descricao"]).startswith("Tela compat")
    assert fake_api.insert_payload["valor_unitario"] == "180.20"
    assert response.json()["subtotal"] == 360.4


def test_peca_comprada_para_os_nao_exige_item_de_estoque() -> None:
    fake_api = FakeProcessDataAPI(status_os="EM_ANALISE", tecnico_id=USUARIO_ID)
    configure(FuncaoUsuario.DONO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.post(
                f"/api/v1/ordens/{ORDEM_ID}/itens",
                json={
                    "tipo": "PECA",
                    "descricao": "Tela comprada para o cliente",
                    "fornecedor": "Fornecedor Teste",
                    "quantidade": 1,
                    "custo_unitario": 220,
                    "valor_unitario": 300,
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert fake_api.insert_payload["id_item_estoque"] is None
    assert fake_api.insert_payload["fornecedor"] == "Fornecedor Teste"
    assert Decimal(str(fake_api.insert_payload["custo_unitario"])) == Decimal("220.00")
    assert response.json()["subtotal"] == 300


def test_recepcao_nao_altera_itens_do_orcamento() -> None:
    fake_api = FakeProcessDataAPI(status_os="EM_ANALISE")
    configure(FuncaoUsuario.RECEPCIONISTA)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.post(
                f"/api/v1/ordens/{ORDEM_ID}/itens",
                json={
                    "tipo": "SERVICO",
                    "descricao": "Teste",
                    "quantidade": 1,
                    "valor_unitario": 10,
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403
    assert fake_api.insert_payload is None


def test_orcamento_fica_bloqueado_depois_de_enviado_para_aprovacao() -> None:
    fake_api = FakeProcessDataAPI(status_os="AGUARDANDO_APROVACAO")
    configure(FuncaoUsuario.DONO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.delete(f"/api/v1/ordens/{ORDEM_ID}/itens/{ITEM_OS_ID}")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert fake_api.deleted_filters is None


def test_pre_nota_so_pode_ser_emitida_na_etapa_de_analise() -> None:
    fake_api = FakeProcessDataAPI(status_os="RECEBIDO", tecnico_id=USUARIO_ID)
    configure(FuncaoUsuario.DONO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.post(f"/api/v1/ordens/{ORDEM_ID}/pre-nota/impressao")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "status atual" in response.json()["detail"]
    assert fake_api.update_payload is None


def test_emitir_pre_nota_encaminha_analise_para_aprovacao() -> None:
    fake_api = FakeProcessDataAPI(status_os="EM_ANALISE", tecnico_id=USUARIO_ID)
    configure(FuncaoUsuario.DONO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.post(f"/api/v1/ordens/{ORDEM_ID}/pre-nota/impressao")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert fake_api.status_os == "AGUARDANDO_APROVACAO"


def test_os_nao_pode_pular_aprovacao_para_manutencao() -> None:
    fake_api = FakeProcessDataAPI(status_os="EM_ANALISE", tecnico_id=USUARIO_ID)
    configure(FuncaoUsuario.DONO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.post(
                f"/api/v1/ordens/{ORDEM_ID}/status",
                json={"status_os": "EM_MANUTENCAO"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert fake_api.update_payload is None


def test_os_exige_diagnostico_e_valor_antes_da_aprovacao() -> None:
    fake_api = FakeProcessDataAPI(
        status_os="EM_ANALISE", diagnostico=None, valor_total="0"
    )
    configure(FuncaoUsuario.DONO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            sem_diagnostico = client.post(
                f"/api/v1/ordens/{ORDEM_ID}/status",
                json={"status_os": "AGUARDANDO_APROVACAO"},
            )
            fake_api.diagnostico = "Conector danificado"
            sem_valor = client.post(
                f"/api/v1/ordens/{ORDEM_ID}/status",
                json={"status_os": "AGUARDANDO_APROVACAO"},
            )
    finally:
        app.dependency_overrides.clear()

    assert sem_diagnostico.status_code == 409
    assert "diagnóstico" in sem_diagnostico.json()["detail"].lower()
    assert sem_valor.status_code == 409
    assert "orçamento" in sem_valor.json()["detail"].lower()
    assert fake_api.update_payload is None


def test_os_exige_tecnico_responsavel_antes_da_conclusao() -> None:
    fake_api = FakeProcessDataAPI(status_os="EM_MANUTENCAO", tecnico_id=None)
    configure(FuncaoUsuario.DONO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.post(
                f"/api/v1/ordens/{ORDEM_ID}/status",
                json={"status_os": "CONCLUIDO"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "técnico responsável" in response.json()["detail"].lower()
    assert fake_api.update_payload is None


def test_iniciar_analise_autoatribui_usuario_autenticado() -> None:
    fake_api = FakeProcessDataAPI(status_os="RECEBIDO", tecnico_id=None)
    configure(FuncaoUsuario.TECNICO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.post(
                f"/api/v1/ordens/{ORDEM_ID}/status",
                json={"status_os": "EM_ANALISE"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["id_tecnico_responsavel"] == str(USUARIO_ID)
    assert fake_api.update_payload == {
        "status_os": "EM_ANALISE",
        "id_tecnico_responsavel": str(USUARIO_ID),
    }


def test_salvar_diagnostico_autoatribui_usuario_autenticado() -> None:
    fake_api = FakeProcessDataAPI(status_os="RECEBIDO", tecnico_id=None)
    configure(FuncaoUsuario.DONO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.patch(
                f"/api/v1/ordens/{ORDEM_ID}",
                json={"diag_os": "Falha no circuito de alimentação", "valor_total": 180},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["id_tecnico_responsavel"] == str(USUARIO_ID)
    assert fake_api.update_payload is not None
    assert fake_api.update_payload["id_tecnico_responsavel"] == str(USUARIO_ID)


def test_tecnico_nao_pode_operar_os_atribuida_a_outro() -> None:
    fake_api = FakeProcessDataAPI(status_os="EM_ANALISE", tecnico_id=OUTRO_TECNICO_ID)
    configure(FuncaoUsuario.TECNICO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.patch(
                f"/api/v1/ordens/{ORDEM_ID}",
                json={"diag_os": "Tentativa de alteração"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403
    assert "outro técnico" in response.json()["detail"].lower()
    assert fake_api.update_payload is None


def test_pre_nota_gera_pdf_valido_com_valor_decimal() -> None:
    pdf = gerar_pre_nota_pdf(
        PreNotaDados(
            assistencia_nome="Assistência Teste",
            numero_os="OS-000001",
            data_abertura=AGORA,
            status="EM_ANALISE",
            cliente_nome="Maria Silva",
            cliente_cpf="12345678901",
            cliente_telefone="(65) 99999-9999",
            cliente_endereco="Rua Central, 10",
            equipamento_marca="Samsung",
            equipamento_modelo="S24",
            equipamento_cor="Preto",
            equipamento_serie="SN-001",
            equipamento_descricao="Celular",
            defeito_relatado="Não liga",
            diagnostico="Placa em curto",
            tecnico_nome="Técnico Teste",
            valor_total=Decimal("250.35"),
            observacoes=None,
        )
    )

    assert pdf.startswith(b"%PDF-")
    assert len(pdf) > 1_000


def _item_cenario(
    *,
    tipo: str,
    descricao: str,
    quantidade: int = 1,
    estoque: bool = False,
    fornecedor: str | None = None,
) -> dict[str, object]:
    return FakeProcessDataAPI.item_os(
        tipo=tipo,
        descricao=descricao,
        quantidade=str(quantidade),
        id_item_estoque=str(ITEM_ID) if estoque else None,
        fornecedor=fornecedor,
        custo_unitario="120.00" if fornecedor else None,
        status_compra="RECEBIDA" if fornecedor else None,
    )


def _avancar_status(client: TestClient, status_os: str):
    return client.post(
        f"/api/v1/ordens/{ORDEM_ID}/status",
        json={"status_os": status_os},
    )


def test_cenario_somente_servico_nao_movimenta_estoque_e_chega_a_entrega() -> None:
    fake_api = ScenarioFlowDataAPI(
        itens=[_item_cenario(tipo="SERVICO", descricao="Limpeza interna")],
        saldo=5,
    )
    configure(FuncaoUsuario.DONO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            aprovacao = _avancar_status(client, "EM_MANUTENCAO")
            conclusao = _avancar_status(client, "CONCLUIDO")
            entrega = _avancar_status(client, "ENTREGUE")
    finally:
        app.dependency_overrides.clear()

    assert [aprovacao.status_code, conclusao.status_code, entrega.status_code] == [200, 200, 200]
    assert entrega.json()["status_os"] == "ENTREGUE"
    assert fake_api.saldo == 5
    assert fake_api.movimentos == []


def test_cenario_peca_de_fornecedor_nao_movimenta_estoque() -> None:
    fake_api = ScenarioFlowDataAPI(
        itens=[
            _item_cenario(
                tipo="PECA",
                descricao="Tela adquirida para a OS",
                fornecedor="Fornecedor Teste",
            )
        ],
        saldo=5,
    )
    configure(FuncaoUsuario.DONO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = _avancar_status(client, "EM_MANUTENCAO")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status_os"] == "EM_MANUTENCAO"
    assert fake_api.saldo == 5
    assert fake_api.movimentos == []


def test_cenario_peca_do_estoque_baixa_saldo_e_registra_movimento() -> None:
    fake_api = ScenarioFlowDataAPI(
        itens=[_item_cenario(tipo="PECA", descricao="Tela compatível", quantidade=2, estoque=True)],
        saldo=5,
    )
    configure(FuncaoUsuario.DONO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = _avancar_status(client, "EM_MANUTENCAO")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert fake_api.saldo == 3
    assert fake_api.movimentos == [
        {
            "tipo": "SAIDA",
            "quantidade": 2,
            "quantidade_anterior": 5,
            "quantidade_nova": 3,
            "id_os": str(ORDEM_ID),
        }
    ]


def test_cenario_misto_baixa_apenas_peca_vinculada_ao_estoque() -> None:
    fake_api = ScenarioFlowDataAPI(
        itens=[
            _item_cenario(tipo="SERVICO", descricao="Troca e configuração"),
            _item_cenario(tipo="PECA", descricao="Conector do estoque", estoque=True),
            _item_cenario(
                tipo="PECA",
                descricao="Cabo comprado para a OS",
                fornecedor="Distribuidor",
            ),
        ],
        saldo=4,
    )
    configure(FuncaoUsuario.DONO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = _avancar_status(client, "EM_MANUTENCAO")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert fake_api.saldo == 3
    assert len(fake_api.movimentos) == 1
    assert fake_api.movimentos[0]["quantidade"] == 1


def test_saldo_insuficiente_bloqueia_aprovacao_sem_alteracao_parcial() -> None:
    fake_api = ScenarioFlowDataAPI(
        itens=[_item_cenario(tipo="PECA", descricao="Tela compatível", quantidade=3, estoque=True)],
        saldo=2,
    )
    configure(FuncaoUsuario.DONO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = _avancar_status(client, "EM_MANUTENCAO")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "saldo insuficiente" in response.json()["detail"].lower()
    assert fake_api.status_os == "AGUARDANDO_APROVACAO"
    assert fake_api.saldo == 2
    assert fake_api.movimentos == []


def test_recusa_do_cliente_cancela_sem_movimentar_estoque() -> None:
    fake_api = ScenarioFlowDataAPI(
        itens=[_item_cenario(tipo="PECA", descricao="Tela compatível", estoque=True)],
        saldo=5,
    )
    configure(FuncaoUsuario.DONO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = _avancar_status(client, "CANCELADO")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status_os"] == "CANCELADO"
    assert fake_api.saldo == 5
    assert fake_api.movimentos == []


def test_compra_externa_pode_ser_atualizada_por_dono() -> None:
    fake_api = FakeProcessDataAPI(status_os="AGUARDANDO_APROVACAO")
    configure(FuncaoUsuario.DONO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.patch(
                f"/api/v1/ordens/{ORDEM_ID}/itens/{ITEM_OS_ID}/compra",
                json={"status_compra": "COMPRADA"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status_compra"] == "COMPRADA"
    assert fake_api.rpc_payload == {
        "p_id_os": str(ORDEM_ID),
        "p_id_item_os": str(ITEM_OS_ID),
        "p_status": "COMPRADA",
    }


def test_tecnico_nao_atualiza_compra_externa() -> None:
    fake_api = FakeProcessDataAPI(status_os="AGUARDANDO_APROVACAO")
    configure(FuncaoUsuario.TECNICO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.patch(
                f"/api/v1/ordens/{ORDEM_ID}/itens/{ITEM_OS_ID}/compra",
                json={"status_compra": "RECEBIDA"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403
    assert fake_api.rpc_payload is None


def test_peca_externa_pendente_bloqueia_inicio_da_manutencao() -> None:
    item = _item_cenario(
        tipo="PECA",
        descricao="Tela aguardando fornecedor",
        fornecedor="Distribuidor",
    )
    item["status_compra"] = "COMPRADA"
    fake_api = ScenarioFlowDataAPI(itens=[item], saldo=5)
    configure(FuncaoUsuario.DONO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = _avancar_status(client, "EM_MANUTENCAO")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "recebimento" in response.json()["detail"].lower()
    assert fake_api.status_os == "AGUARDANDO_APROVACAO"


def test_cancelamento_em_manutencao_exige_destino_das_pecas() -> None:
    fake_api = FakeProcessDataAPI(status_os="EM_MANUTENCAO", tecnico_id=USUARIO_ID)
    configure(FuncaoUsuario.DONO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = _avancar_status(client, "CANCELADO")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "destino das peças" in response.json()["detail"].lower()


def test_cancelamento_com_devolucao_estorna_saldo() -> None:
    fake_api = ScenarioFlowDataAPI(
        itens=[_item_cenario(tipo="PECA", descricao="Tela", quantidade=2, estoque=True)],
        saldo=5,
    )
    configure(FuncaoUsuario.DONO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            aprovacao = _avancar_status(client, "EM_MANUTENCAO")
            cancelamento = client.post(
                f"/api/v1/ordens/{ORDEM_ID}/cancelamento-manutencao",
                json={"destino_pecas": "DEVOLVER_ESTOQUE"},
            )
    finally:
        app.dependency_overrides.clear()

    assert aprovacao.status_code == 200
    assert cancelamento.status_code == 200
    assert cancelamento.json()["status_os"] == "CANCELADO"
    assert cancelamento.json()["destino_pecas_cancelamento"] == "DEVOLVER_ESTOQUE"
    assert fake_api.saldo == 5
    assert [movimento["tipo"] for movimento in fake_api.movimentos] == ["SAIDA", "ENTRADA"]


def test_cancelamento_com_peca_consumida_nao_estorna_saldo() -> None:
    fake_api = ScenarioFlowDataAPI(
        itens=[_item_cenario(tipo="PECA", descricao="Conector", estoque=True)],
        saldo=5,
    )
    configure(FuncaoUsuario.DONO)
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            _avancar_status(client, "EM_MANUTENCAO")
            response = client.post(
                f"/api/v1/ordens/{ORDEM_ID}/cancelamento-manutencao",
                json={"destino_pecas": "CONSUMIDAS"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert fake_api.saldo == 4
    assert [movimento["tipo"] for movimento in fake_api.movimentos] == ["SAIDA"]
