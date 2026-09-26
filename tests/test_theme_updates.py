import io
import json
from concurrent.futures import ThreadPoolExecutor
from zipfile import ZipFile

import pytest
from app.services.release_validation import inspect_package
from app.services.theme_updates import ThemeStore
from test_releases import release_client  # noqa: F401


def theme_package(version="0.1.1", base="0.1.0", extra=None, color=None):
    themes = {}
    for mode in ("light", "dark"):
        themes[mode] = {"--ls-sem-" + key: ("#006414" if mode == "light" else "#ffffff")
                        for key in ("success", "info", "edit", "warning", "danger", "special")}
        themes[mode].update({"--ls-sem-" + key: "#006414"
                             for key in ("success-bg", "success-hover", "info-bg")})
    if color is not None:
        themes["dark"]["--ls-sem-danger"] = color
    data = io.BytesIO()
    with ZipFile(data, "w") as z:
        z.writestr("release.json", json.dumps({
            "kind": "theme", "schema_version": 1, "environment": "homologacao",
            "version": version, "base_version": base, "notes": "Tema de teste de Luis",
        }))
        z.writestr("theme.json", json.dumps(themes))
        for name, value in (extra or {}).items():
            z.writestr(name, value)
    return data.getvalue()


def test_declarative_theme_validation():
    result = inspect_package(theme_package())
    assert result["status"] == "TEMA_VALIDADO"
    assert len(result["contrast"]) == 18


@pytest.mark.parametrize("color", ["url(https://evil)", "red", "#123", "#2c406e", 123])
def test_css_and_bad_contrast_are_rejected(color):
    assert inspect_package(theme_package(color=color))["status"] == "BLOQUEADO"


@pytest.mark.parametrize("extra", [{"script.js": "alert(1)"}, {"../x": "x"},
                                  {".env": "secret"}, {"THEME.JSON": "{}"}])
def test_extra_files_rejected(extra):
    assert inspect_package(theme_package(extra=extra))["status"] == "BLOQUEADO"


def test_version_must_advance():
    assert inspect_package(theme_package(version="0.1.0"))["status"] == "BLOQUEADO"


def test_duplicate_json_and_nested_json_fail_closed():
    for payload in ('{"kind":"theme","kind":"code"}', '[' * 1100 + ']' * 1100):
        buffer = io.BytesIO()
        with ZipFile(buffer, "w") as archive:
            archive.writestr("release.json", payload)
        assert inspect_package(buffer.getvalue())["status"] == "BLOQUEADO"


def test_atomic_apply_restore_persistence_and_history(tmp_path):
    store = ThemeStore(str(tmp_path / "theme.db"))
    report = store.add("Luis", theme_package())
    preview = store.preview(report["id"])
    assert preview["expected_revision"] == 0
    state = store.change("Luis", 0, "APLICAR 0.1.1", report["id"], report["sha256"])
    assert state["revision"] == 1
    assert ThemeStore(str(tmp_path / "theme.db")).state() == state
    with pytest.raises(ValueError):
        store.change("Luis", 0, "APLICAR 0.1.1", report["id"], report["sha256"])
    restored = store.change("Luis", 1, "RESTAURAR")
    assert restored["version"] == "0.1.0" and restored["themes"] == {}
    assert restored["revision"] == 2
    assert [event["action"] for event in store.history()] == ["RESTAURAR", "APLICAR"]
    with pytest.raises(ValueError):
        store.change("Luis", 2, "RESTAURAR")


@pytest.mark.parametrize("confirmation,sha", [("yes", None), ("APLICAR 0.1.1", "a" * 64)])
def test_wrong_confirmation_and_hash_no_mutation(tmp_path, confirmation, sha):
    store = ThemeStore(str(tmp_path / "theme.db"))
    report = store.add("Luis", theme_package())
    with pytest.raises(ValueError):
        store.change("Luis", 0, confirmation, report["id"], sha or report["sha256"])
    assert store.state()["revision"] == 0
    assert store.history() == []


def test_tamper_and_base_version_are_rejected(tmp_path):
    store = ThemeStore(str(tmp_path / "theme.db"))
    report = store.add("Luis", theme_package("0.2.0", "0.1.9"))
    with pytest.raises(ValueError):
        store.preview(report["id"])
    with pytest.raises(ValueError):
        store.change("Luis", 0, "APLICAR 0.2.0", report["id"], report["sha256"])
    with store.connect() as db:
        db.execute("UPDATE releases SET payload=?", (b"corrupt",))
    with pytest.raises(ValueError):
        store.change("Luis", 0, "APLICAR 0.2.0", report["id"], report["sha256"])


def test_concurrent_confirmation_only_one_wins(tmp_path):
    store = ThemeStore(str(tmp_path / "theme.db"))
    report = store.add("Luis", theme_package())
    store.state()

    def apply(_):
        try:
            store.change("Luis", 0, "APLICAR 0.1.1", report["id"], report["sha256"])
            return True
        except ValueError:
            return False

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sum(pool.map(apply, range(2))) == 1
    assert len(store.history()) == 1


def test_api_flow_and_production_guard(release_client):  # noqa: F811
    client, settings, metadata = release_client
    root = "/api/v1/plataforma"
    report = client.post(root + "/versoes", content=theme_package()).json()
    url = root + "/versoes/" + report["id"]
    assert client.get(url + "/previa").json()["expected_revision"] == 0
    body = {"revision": 0, "confirmation": "APLICAR 0.1.1", "sha256": report["sha256"]}
    metadata["plataforma_admin"] = False
    assert client.post(url + "/aplicar", json=body).status_code == 403
    assert client.post(root + "/tema/restaurar", json=body).status_code == 403
    metadata["plataforma_admin"] = True
    assert client.post(url + "/aplicar", json=body).json()["revision"] == 1
    assert client.post(url + "/aplicar", json=body).status_code == 409
    assert client.get(root + "/tema/publico").headers["cache-control"] == "no-store"
    assert client.get(root + "/tema/publico").json()["version"] == "0.1.1"
    assert client.post(root + "/tema/restaurar", json={
        "revision": 1, "confirmation": "RESTAURAR"}).json()["version"] == "0.1.0"
    settings.environment = "production"
    assert client.get(root + "/tema/publico").json()["themes"] == {}
    assert client.post(url + "/aplicar", json=body).status_code == 403
    assert client.post(root + "/tema/restaurar", json=body).status_code == 403
