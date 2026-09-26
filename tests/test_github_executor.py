from types import SimpleNamespace

import httpx
import pytest
from app.services import github_executor as executor
from fastapi import HTTPException
from pydantic import SecretStr


@pytest.fixture
def settings():
    return SimpleNamespace(updates_github_token=SecretStr("private-test-token"),
                           updates_github_ref="homologacao")


@pytest.fixture
def github(monkeypatch):
    calls = []
    replies = {}

    def handler(request):
        calls.append(request)
        assert request.url.host == "api.github.com"
        assert request.headers["Authorization"] == "Bearer private-test-token"
        assert request.headers["X-GitHub-Api-Version"] == "2026-03-10"
        reply = replies.get(request.method, (200, {}))
        if isinstance(reply, Exception):
            raise reply
        status, data = reply
        return httpx.Response(status, json=data)

    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        executor.httpx, "AsyncClient",
        lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs),
    )
    return calls, replies


async def test_missing_configuration_does_not_connect(settings, github):
    settings.updates_github_token = None
    assert (await executor.connection(settings))["conectado"] is False
    assert not github[0]


@pytest.mark.parametrize("status", [401, 403, 404, 422, 429, 500, 302])
async def test_github_errors_do_not_leak_response(settings, github, status):
    github[1]["GET"] = (status, {"message": "private-test-token"})
    with pytest.raises(HTTPException) as error:
        await executor.connection(settings)
    assert error.value.status_code == 502
    assert "private-test-token" not in error.value.detail


async def test_timeout_during_dispatch_warns_not_to_retry(settings, github):
    github[1]["POST"] = httpx.ReadTimeout("secret")
    with pytest.raises(HTTPException) as error:
        await executor.request(settings, "POST", "/actions/workflows/test/dispatches")
    assert "antes de tentar" in error.value.detail


@pytest.mark.parametrize("mode", ["changed", "busy", "ok"])
async def test_dispatch_checks_commit_and_active_run(settings, monkeypatch, mode):
    calls = []

    async def connection(_):
        return {"conectado": True, "commit": ("b" if mode == "changed" else "a") * 40,
                "runs": [{"status": "queued"}] if mode == "busy" else []}

    async def request(*args, **kwargs):
        calls.append(kwargs["json"])
        return {"workflow_run_id": 42}

    monkeypatch.setattr(executor, "connection", connection)
    monkeypatch.setattr(executor, "request", request)
    if mode == "ok":
        result = await executor.dispatch(settings, "a" * 40)
        assert result["run_id"] == 42
        assert calls == [{"ref": "homologacao", "inputs": {"expected_sha": "a" * 40}}]
        assert "não valida ZIP" in result["notice"]
    else:
        with pytest.raises(HTTPException) as error:
            await executor.dispatch(settings, "a" * 40)
        assert error.value.status_code == 409
        assert calls == []


async def test_connection_returns_sanitized_run_link(settings, monkeypatch):
    async def request(_, method, path, **kwargs):
        if path.startswith("/commits/"):
            return {"sha": "a" * 40}
        if path.endswith("/runs"):
            return {"workflow_runs": [{"id": 7, "status": "completed", "conclusion": "failure",
                                       "head_sha": "a" * 40, "html_url": "https://untrusted"}]}
        return {"state": "active"}

    monkeypatch.setattr(executor, "request", request)
    result = await executor.connection(settings)
    assert result["runs"][0]["url"].startswith("https://github.com/Luiskyes/")
    assert result["runs"][0]["conclusion"] == "failure"
    assert result["escopo"] == "repositorio"
