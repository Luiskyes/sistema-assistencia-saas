import logging
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.config import Settings

logger = logging.getLogger(__name__)


class SupabaseDataAPI:
    """Acessa o PostgREST com o JWT do usuário, preservando as policies RLS."""

    def __init__(self, settings: Settings, http_client: httpx.AsyncClient) -> None:
        self.settings = settings
        self.http_client = http_client

    async def select(
        self,
        table: str,
        token: str,
        *,
        params: dict[str, str],
    ) -> list[dict[str, Any]]:
        response = await self.http_client.get(
            f"{self.settings.supabase_url}/rest/v1/{table}",
            params=params,
            headers=self._headers(token),
        )
        if response.status_code == status.HTTP_401_UNAUTHORIZED:
            logger.warning("PostgREST rejeitou token ao consultar tabela %s", table)
            raise HTTPException(status_code=401, detail="Sessão expirada ou inválida")
        if response.status_code == status.HTTP_403_FORBIDDEN:
            raise HTTPException(status_code=403, detail="Acesso não autorizado")
        if response.is_error:
            raise HTTPException(status_code=502, detail="Falha ao consultar o banco de dados")
        return response.json()

    async def insert(
        self,
        table: str,
        token: str,
        *,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        response = await self.http_client.post(
            f"{self.settings.supabase_url}/rest/v1/{table}",
            json=payload,
            headers={**self._headers(token), "Prefer": "return=representation"},
        )
        data = self._handle_mutation_response(response)
        if not data:
            raise HTTPException(status_code=502, detail="Banco não retornou o registro criado")
        return data[0]

    async def update(
        self,
        table: str,
        token: str,
        *,
        filters: dict[str, str],
        payload: dict[str, Any],
    ) -> dict[str, Any] | None:
        response = await self.http_client.patch(
            f"{self.settings.supabase_url}/rest/v1/{table}",
            params=filters,
            json=payload,
            headers={**self._headers(token), "Prefer": "return=representation"},
        )
        data = self._handle_mutation_response(response)
        return data[0] if data else None

    async def delete(
        self,
        table: str,
        token: str,
        *,
        filters: dict[str, str],
    ) -> dict[str, Any] | None:
        response = await self.http_client.delete(
            f"{self.settings.supabase_url}/rest/v1/{table}",
            params=filters,
            headers={**self._headers(token), "Prefer": "return=representation"},
        )
        data = self._handle_mutation_response(response)
        return data[0] if data else None

    async def rpc(
        self,
        function: str,
        token: str,
        *,
        payload: dict[str, Any],
    ) -> Any:
        response = await self.http_client.post(
            f"{self.settings.supabase_url}/rest/v1/rpc/{function}",
            json=payload,
            headers=self._headers(token),
        )
        if response.status_code == status.HTTP_401_UNAUTHORIZED:
            raise HTTPException(status_code=401, detail="Sessão expirada ou inválida")
        if response.status_code == status.HTTP_403_FORBIDDEN:
            raise HTTPException(status_code=403, detail="Operação não autorizada")
        if response.status_code == status.HTTP_400_BAD_REQUEST:
            detail = "Dados rejeitados pelo banco"
            try:
                body = response.json()
                detail = body.get("message") or detail
            except ValueError:
                pass
            raise HTTPException(status_code=400, detail=detail)
        if response.is_error:
            raise HTTPException(status_code=502, detail="Falha ao executar operação no banco")
        if not response.content:
            return None
        return response.json()

    @staticmethod
    def _handle_mutation_response(response: httpx.Response) -> list[dict[str, Any]]:
        if response.status_code == status.HTTP_401_UNAUTHORIZED:
            raise HTTPException(status_code=401, detail="Sessão expirada ou inválida")
        if response.status_code == status.HTTP_403_FORBIDDEN:
            raise HTTPException(status_code=403, detail="Operação não autorizada")
        if response.status_code == status.HTTP_409_CONFLICT:
            raise HTTPException(status_code=409, detail="Já existe um registro com esses dados")
        if response.status_code == status.HTTP_400_BAD_REQUEST:
            raise HTTPException(status_code=400, detail="Dados rejeitados pelo banco")
        if response.is_error:
            raise HTTPException(status_code=502, detail="Falha ao gravar no banco de dados")
        return response.json()

    def _headers(self, token: str) -> dict[str, str]:
        return {
            "apikey": self.settings.supabase_publishable_key,
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        }
