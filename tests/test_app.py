import os

os.environ.setdefault("SUPABASE_URL", "https://projeto-teste.supabase.co")
os.environ.setdefault("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_teste")

from app.main import app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_current_session_requires_token() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/sessao/atual")

    assert response.status_code == 401
    assert response.json()["detail"] == "Token ausente, inválido ou expirado"


def test_public_config_exposes_only_browser_safe_values() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/config/public")

    assert response.status_code == 200
    assert response.json() == {
        "supabase_url": "https://projeto-teste.supabase.co",
        "supabase_publishable_key": "sb_publishable_teste",
    }
    assert "equipment_encryption_key" not in response.text
