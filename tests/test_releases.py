import io
import json
from types import SimpleNamespace
from uuid import UUID
from zipfile import ZipFile, ZipInfo

import pytest
from app.dependencies import get_current_session
from app.main import app
from app.routers import plataforma
from app.schemas import TokenClaims
from app.security import AuthenticatedRequest, get_authenticated_request
from app.services.release_validation import ReleaseStore, inspect_package
from fastapi.testclient import TestClient


def package(manifest=None, extra=None):
    buffer = io.BytesIO()
    with ZipFile(buffer, "w") as archive:
        archive.writestr("release.json", json.dumps(manifest if manifest is not None else {
            "environment": "homologacao", "version": "0.2.0",
            "base_version": "0.1.0", "notes": "Versão de teste",
        }))
        archive.writestr("frontend/package.json", "{}")
        archive.writestr("backend/app/main.py", "raise Exception('não executar')")
        archive.writestr("pyproject.toml", "")
        for name, data in (extra or {}).items():
            info = ZipInfo("placeholder")
            info.filename = name
            archive.writestr(info, data)
    return buffer.getvalue()


def test_valid_structure_never_means_approved():
    report = inspect_package(package())
    assert report["status"] == "AGUARDANDO_EXECUTOR"
    assert report["checks"]["build"] == "NAO_EXECUTADO"
    assert report["checks"]["compatibilidade"] == "NAO_EXECUTADO"


@pytest.mark.parametrize("name", ["../evil.py", "/evil.py", "C:/evil.py", "a\\b.py",
                                      ".env", "backend/.env.homologacao", "node_modules/a"])
def test_rejects_unsafe_packages(name):
    assert inspect_package(package(extra={name: "secret"}))["status"] == "BLOQUEADO"


@pytest.mark.parametrize("manifest", [[], "wrong", {}, {"environment": "production"}])
def test_rejects_invalid_manifest(manifest):
    assert inspect_package(package(manifest=manifest))["status"] == "BLOQUEADO"


def test_invalid_zip_and_missing_manifest():
    assert inspect_package(b"not zip")["status"] == "BLOQUEADO"
    buffer = io.BytesIO()
    with ZipFile(buffer, "w") as archive:
        archive.writestr("README.md", "test")
    assert inspect_package(buffer.getvalue())["status"] == "BLOQUEADO"


def test_store_preserves_hash_and_report_across_instances(tmp_path):
    path = str(tmp_path / "releases.sqlite")
    store = ReleaseStore(path)
    release = store.add("admin-test", package())
    assert release["status"] == "RECEBIDO"
    analyzed = store.analyze(release["id"])
    assert analyzed["sha256"] == release["sha256"]
    assert ReleaseStore(path).get(release["id"]) == analyzed
    assert len(store.list()) == 1


@pytest.fixture
def release_client(monkeypatch, tmp_path):
    settings = SimpleNamespace(
        environment="homologacao", updates_homolog_project_ref="teste",
        supabase_url="https://teste.supabase.co", updates_store_path=str(tmp_path / "test.db"),
        test_email="luis.rogeriocdmelo@gmail.com",
    )
    metadata = {"plataforma_admin": True}

    async def auth():
        return AuthenticatedRequest(token="test", claims=TokenClaims(
            sub=UUID("30000000-0000-0000-0000-000000000001"), role="authenticated",
            exp=2000000000, iss="https://teste.supabase.co/auth/v1", app_metadata=metadata,
            email=settings.test_email,
        ))

    monkeypatch.setattr(plataforma, "get_settings", lambda: settings)
    app.dependency_overrides[get_authenticated_request] = auth
    app.dependency_overrides[get_current_session] = lambda: object()
    try:
        with TestClient(app) as client:
            yield client, settings, metadata
    finally:
        app.dependency_overrides.clear()


def test_upload_analyze_and_apply_is_always_blocked(release_client):
    client, _, _ = release_client
    upload = client.post("/api/v1/plataforma/versoes", content=package())
    assert upload.status_code == 201
    identifier = upload.json()["id"]
    report = client.post(f"/api/v1/plataforma/versoes/{identifier}/analisar")
    assert report.json()["status"] == "AGUARDANDO_EXECUTOR"
    assert client.get(f"/api/v1/plataforma/versoes/{identifier}/relatorio").status_code == 200
    assert client.post(f"/api/v1/plataforma/versoes/{identifier}/aplicar").status_code == 409


@pytest.mark.parametrize("admin", [False, "true", None])
def test_dono_is_not_platform_admin(release_client, admin):
    client, _, metadata = release_client
    metadata["plataforma_admin"] = admin
    assert client.get("/api/v1/plataforma/versoes").status_code == 403
    assert client.post("/api/v1/plataforma/versoes", content=package()).status_code == 403


def test_production_and_wrong_project_are_blocked(release_client):
    client, settings, _ = release_client
    settings.environment = "production"
    assert client.post("/api/v1/plataforma/versoes", content=package()).status_code == 403
    settings.environment = "homologacao"
    settings.supabase_url = "https://outro.supabase.co"
    assert client.get("/api/v1/plataforma/versoes").status_code == 403


def test_missing_release_has_clear_error(release_client):
    client, _, _ = release_client
    response = client.post(
        "/api/v1/plataforma/versoes/00000000-0000-0000-0000-000000000000/analisar"
    )
    assert response.status_code == 404


@pytest.mark.parametrize("email", ["teste.homologacao@lsassist.dev", None, "outro@gmail.com"])
def test_other_email_blocked_even_with_admin_claim(release_client, email):
    client, settings, _ = release_client
    settings.test_email = email
    assert client.get("/api/v1/plataforma/disponibilidade").json()["autorizado"] is False
    assert client.get("/api/v1/plataforma/versoes").status_code == 403
    assert client.get("/api/v1/plataforma/executor").status_code == 403
    response = client.post("/api/v1/plataforma/executor/testar",
                           json={"expected_sha": "a" * 40})
    assert response.status_code == 403


def test_executor_routes_fail_closed_in_production(release_client):
    client, settings, _ = release_client
    settings.environment = "production"
    assert client.get("/api/v1/plataforma/executor").status_code == 403
    assert client.post("/api/v1/plataforma/executor/testar",
                       json={"expected_sha": "a" * 40}).status_code == 403
