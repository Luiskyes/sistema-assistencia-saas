import os
from datetime import UTC, datetime
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
from fastapi.testclient import TestClient  # noqa: E402

ASSISTENCIA_ID = UUID("10000000-0000-0000-0000-000000000001")
USUARIO_ID = UUID("20000000-0000-0000-0000-000000000001")
AUTH_ID = UUID("30000000-0000-0000-0000-000000000001")
CLIENTE_ID = UUID("40000000-0000-0000-0000-000000000001")
EQUIPAMENTO_ID = UUID("50000000-0000-0000-0000-000000000001")
AGORA = datetime(2026, 8, 7, 12, 0, tzinfo=UTC)


async def fake_session() -> SessaoAtual:
    return SessaoAtual(
        usuario=UsuarioAutenticado(
            id_usuario=USUARIO_ID,
            id_auth=AUTH_ID,
            id_assistencia=ASSISTENCIA_ID,
            cpf_usuario=None,
            nome_usuario="Dono Teste",
            funcao_usuario=FuncaoUsuario.DONO,
            email_usuario="dono@example.com",
            ativo=True,
            data_criacao=AGORA,
        ),
        assistencia=AssistenciaAtual(
            id_assistencia=ASSISTENCIA_ID,
            nome_assistencia="Assistência Teste",
            ativo=True,
        ),
    )


async def fake_auth() -> AuthenticatedRequest:
    return AuthenticatedRequest(
        token="token-de-teste",
        claims=TokenClaims(
            sub=AUTH_ID,
            role="authenticated",
            email="dono@example.com",
            exp=2_000_000_000,
            iss="https://projeto-teste.supabase.co/auth/v1",
        ),
    )


class FakeDataAPI:
    def __init__(self) -> None:
        self.last_params: dict[str, str] | None = None
        self.insert_payload: dict[str, object] | None = None
        self.update_filters: dict[str, str] | None = None
        self.update_payload: dict[str, object] | None = None

    @staticmethod
    def equipamento(**overrides: object) -> dict[str, object]:
        return {
            "id_equip": str(EQUIPAMENTO_ID),
            "id_assistencia": str(ASSISTENCIA_ID),
            "id_cliente": str(CLIENTE_ID),
            "marca_equip": "Samsung",
            "modelo_equip": "Galaxy S24",
            "cor_equip": "Preto",
            "num_serie": "SN-001",
            "descr_equip": "Celular",
            "data_criacao": AGORA.isoformat(),
            **overrides,
        }

    async def select(
        self, table: str, token: str, *, params: dict[str, str]
    ) -> list[dict[str, object]]:
        assert table == "equipamentos"
        assert token == "token-de-teste"
        self.last_params = params
        return [self.equipamento()]

    async def insert(
        self, table: str, token: str, *, payload: dict[str, object]
    ) -> dict[str, object]:
        assert table == "equipamentos"
        assert token == "token-de-teste"
        self.insert_payload = payload
        return self.equipamento(**payload)

    async def update(
        self,
        table: str,
        token: str,
        *,
        filters: dict[str, str],
        payload: dict[str, object],
    ) -> dict[str, object]:
        assert table == "equipamentos"
        assert token == "token-de-teste"
        self.update_filters = filters
        self.update_payload = payload
        return self.equipamento(**payload)


def configure_dependencies() -> None:
    app.dependency_overrides[get_current_session] = fake_session
    app.dependency_overrides[get_authenticated_request] = fake_auth


def test_cadastro_normaliza_texto_e_forca_assistencia_da_sessao() -> None:
    fake_api = FakeDataAPI()
    configure_dependencies()
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.post(
                "/api/v1/equipamentos",
                json={
                    "id_cliente": str(CLIENTE_ID),
                    "marca_equip": "  Samsung  ",
                    "modelo_equip": " Galaxy   S24 ",
                    "descr_equip": "  Tela quebrada  ",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["modelo_equip"] == "Galaxy S24"
    assert fake_api.insert_payload is not None
    assert fake_api.insert_payload["id_assistencia"] == str(ASSISTENCIA_ID)
    assert fake_api.insert_payload["id_cliente"] == str(CLIENTE_ID)


def test_cadastro_rejeita_id_assistencia_enviado_pelo_cliente() -> None:
    configure_dependencies()
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = FakeDataAPI()
            response = client.post(
                "/api/v1/equipamentos",
                json={
                    "id_cliente": str(CLIENTE_ID),
                    "id_assistencia": "99999999-9999-9999-9999-999999999999",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422


def test_listagem_aplica_assistencia_cliente_e_paginacao() -> None:
    fake_api = FakeDataAPI()
    configure_dependencies()
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.get(
                f"/api/v1/equipamentos?id_cliente={CLIENTE_ID}&limite=10&pagina=2"
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert fake_api.last_params is not None
    assert fake_api.last_params["id_assistencia"] == f"eq.{ASSISTENCIA_ID}"
    assert fake_api.last_params["id_cliente"] == f"eq.{CLIENTE_ID}"
    assert fake_api.last_params["limit"] == "10"
    assert fake_api.last_params["offset"] == "10"


def test_alteracao_aplica_filtro_da_assistencia() -> None:
    fake_api = FakeDataAPI()
    configure_dependencies()
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.patch(
                f"/api/v1/equipamentos/{EQUIPAMENTO_ID}",
                json={"cor_equip": "  Azul  "},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert fake_api.update_filters == {
        "id_equip": f"eq.{EQUIPAMENTO_ID}",
        "id_assistencia": f"eq.{ASSISTENCIA_ID}",
    }
    assert fake_api.update_payload == {"cor_equip": "Azul"}


def test_alteracao_vazia_e_rejeitada() -> None:
    configure_dependencies()
    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = FakeDataAPI()
            response = client.patch(f"/api/v1/equipamentos/{EQUIPAMENTO_ID}", json={})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
