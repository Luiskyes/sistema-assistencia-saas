import hashlib

import pytest
from app.services.release_validation import ReleaseStore, inspect_package
from test_releases import package, release_client  # noqa: F401


def test_plan_binds_every_file_to_package_without_executing_sql():
    payload = package(extra={"supabase/migrations/999_test.sql": "DROP TABLE clientes;"})
    report = inspect_package(payload)
    plan = report["code_plan"]
    assert plan["package_sha256"] == hashlib.sha256(payload).hexdigest()
    assert plan["can_apply"] is False
    assert plan["production_enabled"] is False
    assert plan["migrations"][0]["review"] == "REVISAO_OBRIGATORIA"
    assert plan["migrations"][0]["sha256"] == hashlib.sha256(b"DROP TABLE clientes;").hexdigest()
    assert "frontend/index.html" in plan["missing_build_files"]
    assert report["checks"]["testes"] == "NAO_EXECUTADO"


def test_plan_persists_and_tampering_invalidates_it(tmp_path):
    path = str(tmp_path / "updates.db")
    store = ReleaseStore(path)
    release = store.add("test", package())
    report = store.analyze(release["id"])
    assert ReleaseStore(path).get(release["id"]) == report
    assert store.analyze(release["id"])["code_plan"] == report["code_plan"]
    with store.connect() as db:
        db.execute("UPDATE releases SET payload=? WHERE id=?", (b"tampered", release["id"]))
    result = store.analyze(release["id"])
    assert result["status"] == "BLOQUEADO"
    assert "code_plan" not in result


@pytest.mark.parametrize("path", [".ENV", "backend/.Env.homologacao", "NODE_MODULES/a"])
def test_case_insensitive_secret_and_dependency_paths_blocked(path):
    assert inspect_package(package(extra={path: "test"}))["status"] == "BLOQUEADO"


@pytest.mark.parametrize("kind,version", [("unknown", "0.2.0"), ("code", "0.1.0")])
def test_unknown_kind_and_nonincrementing_version_blocked(kind, version):
    report = inspect_package(package(manifest={
        "kind": kind, "version": version, "base_version": "0.1.0",
        "environment": "homologacao", "notes": "Test",
    }))
    assert report["status"] == "BLOQUEADO"
    assert report["code_plan"] is None


def test_api_report_contains_plan_but_does_not_authorize_apply(release_client):  # noqa: F811
    client, settings, _ = release_client
    release = client.post("/api/v1/plataforma/versoes", content=package()).json()
    route = f"/api/v1/plataforma/versoes/{release['id']}"
    response = client.post(route + "/analisar")
    assert response.status_code == 200
    assert response.json()["code_plan"]["package_sha256"] == release["sha256"]
    assert client.get(route + "/relatorio").json() == response.json()
    assert client.post(route + "/aplicar").status_code == 409
    settings.environment = "production"
    assert client.get(route + "/relatorio").status_code == 403
