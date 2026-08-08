import os
from datetime import UTC, datetime
from uuid import UUID

os.environ.setdefault("SUPABASE_URL", "https://projeto-teste.supabase.co")
os.environ.setdefault("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_teste")

from fastapi.testclient import TestClient  # noqa: E402

from app.dependencies import get_current_session  # noqa: E402
from app.main import app  # noqa: E402
from app.schemas import (  # noqa: E402
    FuncaoUsuario,
    SessaoAtual,
    TokenClaims,
    UsuarioAutenticado,
)
from app.security import AuthenticatedRequest, get_authenticated_request  # noqa: E402

ASSISTENCIA_ID = UUID("10000000-0000-0000-0000-000000000001")
USUARIO_ID = UUID("20000000-0000-0000-0000-000000000001")
AUTH_ID = UUID("30000000-0000-0000-0000-000000000001")
CLIENTE_ID = UUID("40000000-0000-0000-0000-000000000001")
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
        assistencia_ativa=True,
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
        self.insert_payload: dict[str, object] | None = None

    async def insert(
        self,
        table: str,
        token: str,
        *,
        payload: dict[str, object],
    ) -> dict[str, object]:
        assert table == "clientes"
        assert token == "token-de-teste"
        self.insert_payload = payload
        return {
            "id_cliente": str(CLIENTE_ID),
            "data_criacao": AGORA.isoformat(),
            **payload,
        }


def test_cadastro_normaliza_cpf_e_forca_assistencia_da_sessao() -> None:
    fake_api = FakeDataAPI()
    app.dependency_overrides[get_current_session] = fake_session
    app.dependency_overrides[get_authenticated_request] = fake_auth

    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = fake_api
            response = client.post(
                "/api/v1/clientes",
                json={
                    "nome_cliente": "  Maria   da Silva  ",
                    "cpf_cliente": "123.456.789-01",
                    "telefone": "(65) 99999-9999",
                    "endereco_cliente": "Rua Central, 10",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["nome_cliente"] == "Maria da Silva"
    assert response.json()["cpf_cliente"] == "12345678901"
    assert fake_api.insert_payload is not None
    assert fake_api.insert_payload["id_assistencia"] == str(ASSISTENCIA_ID)


def test_cadastro_rejeita_id_assistencia_enviado_pelo_cliente() -> None:
    app.dependency_overrides[get_current_session] = fake_session
    app.dependency_overrides[get_authenticated_request] = fake_auth

    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = FakeDataAPI()
            response = client.post(
                "/api/v1/clientes",
                json={
                    "nome_cliente": "Cliente Malicioso",
                    "id_assistencia": "99999999-9999-9999-9999-999999999999",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422


def test_cadastro_rejeita_cpf_incompleto() -> None:
    app.dependency_overrides[get_current_session] = fake_session
    app.dependency_overrides[get_authenticated_request] = fake_auth

    try:
        with TestClient(app) as client:
            client.app.state.supabase_data_api = FakeDataAPI()
            response = client.post(
                "/api/v1/clientes",
                json={"nome_cliente": "João Teste", "cpf_cliente": "123"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
