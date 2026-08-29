"""Conector CI de repositório. Não aprova nem executa ZIPs da quarentena."""

import re
from urllib.parse import quote

import httpx
from fastapi import HTTPException

from app.config import Settings

REPOSITORY = "Luiskyes/sistema-assistencia-saas"
WORKFLOW = "homologacao-testes.yml"
API = f"https://api.github.com/repos/{REPOSITORY}"


def configured(settings: Settings) -> bool:
    return bool(settings.updates_github_token and settings.updates_github_ref)


async def request(settings: Settings, method: str, path: str, **kwargs) -> dict:
    if not configured(settings):
        raise HTTPException(409, "Configure o token e a referência do executor na homologação.")
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
            response = await client.request(method, API + path, headers={
                "Authorization": f"Bearer {settings.updates_github_token.get_secret_value()}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2026-03-10",
            }, **kwargs)
    except httpx.RequestError as exc:
        message = (
            "Sem confirmação do GitHub. Confira Actions antes de tentar disparar novamente."
            if method == "POST"
            else "Não foi possível conectar ao GitHub. Tente consultar novamente."
        )
        raise HTTPException(502, message) from exc
    if response.status_code not in (200, 201, 204):
        messages = {
            401: "Token do GitHub inválido ou expirado.",
            403: "GitHub negou acesso: verifique permissões Actions e limites de uso.",
            404: "Repositório, workflow ou referência não encontrado ou sem acesso.",
            422: "GitHub recusou o disparo. Confira a referência e o workflow publicado.",
            429: "Limite de consultas ao GitHub atingido. Aguarde antes de tentar novamente.",
        }
        raise HTTPException(502, messages.get(response.status_code, "GitHub indisponível."))
    if response.status_code == 204:
        return {}
    try:
        data = response.json()
        if not isinstance(data, dict):
            raise ValueError
        return data
    except ValueError as exc:
        raise HTTPException(502, "Resposta inesperada do GitHub; consulte Actions.") from exc


async def connection(settings: Settings) -> dict:
    if not configured(settings):
        return {"conectado": False, "escopo": "repositorio", "runs": []}
    workflow = await request(settings, "GET", f"/actions/workflows/{WORKFLOW}")
    if workflow.get("state") != "active":
        raise HTTPException(409, "O workflow de testes está desativado no GitHub.")
    commit = await request(
        settings, "GET", "/commits/" + quote(settings.updates_github_ref, safe=""),
    )
    sha = commit.get("sha", "")
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise HTTPException(502, "O GitHub não confirmou o commit a testar.")
    runs = await request(settings, "GET", f"/actions/workflows/{WORKFLOW}/runs",
                         params={"per_page": 5, "event": "workflow_dispatch",
                                 "branch": settings.updates_github_ref})
    return {
        "conectado": True, "escopo": "repositorio", "commit": sha,
        "referencia": settings.updates_github_ref,
        "runs": [{"id": run["id"], "status": run["status"],
                  "conclusion": run.get("conclusion"), "commit": run["head_sha"],
                  "url": f"https://github.com/{REPOSITORY}/actions/runs/{int(run['id'])}"}
                 for run in runs.get("workflow_runs", [])],
    }


async def dispatch(settings: Settings, expected_sha: str) -> dict:
    state = await connection(settings)
    if not state["conectado"]:
        raise HTTPException(409, "Executor ainda não conectado.")
    if state["commit"] != expected_sha:
        raise HTTPException(409, "O código mudou. Atualize a consulta antes de executar os testes.")
    if any(run["status"] != "completed" for run in state["runs"]):
        raise HTTPException(409, "Já existe uma execução pendente. Aguarde sua conclusão.")
    result = await request(settings, "POST", f"/actions/workflows/{WORKFLOW}/dispatches",
                           json={"ref": settings.updates_github_ref,
                                 "inputs": {"expected_sha": expected_sha}})
    return {
        "status": "SOLICITADO", "commit": expected_sha,
        "run_id": result.get("workflow_run_id"),
        "notice": "Testes do repositório solicitados. Isso não valida ZIP nem libera publicação.",
    }
