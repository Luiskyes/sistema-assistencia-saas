import asyncio
from dataclasses import dataclass
from typing import Any

import httpx
import jwt
from fastapi import HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError, PyJWKClient, PyJWKClientError

from app.config import Settings
from app.schemas import TokenClaims

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthenticatedRequest:
    token: str
    claims: TokenClaims


class SupabaseTokenVerifier:
    """Valida JWT assimétrico localmente e aceita o modo legado via Auth API."""

    def __init__(self, settings: Settings, http_client: httpx.AsyncClient) -> None:
        self.settings = settings
        self.http_client = http_client
        self.jwks = PyJWKClient(settings.supabase_jwks_url, cache_jwk_set=True, lifespan=600)

    async def verify(self, token: str) -> TokenClaims:
        try:
            signing_key = await asyncio.to_thread(self.jwks.get_signing_key_from_jwt, token)
        except PyJWKClientError:
            return await self._verify_with_auth_server(token)
        except InvalidTokenError as exc:
            raise self._unauthorized() from exc

        try:
            payload: dict[str, Any] = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256", "EdDSA"],
                audience="authenticated",
                issuer=self.settings.supabase_issuer,
                options={"require": ["exp", "iss", "sub", "role"]},
            )
            return TokenClaims.model_validate(payload)
        except (InvalidTokenError, ValueError) as exc:
            raise self._unauthorized() from exc

    async def _verify_with_auth_server(self, token: str) -> TokenClaims:
        response = await self.http_client.get(
            f"{self.settings.supabase_url}/auth/v1/user",
            headers={
                "apikey": self.settings.supabase_publishable_key,
                "Authorization": f"Bearer {token}",
            },
        )
        if response.status_code != status.HTTP_200_OK:
            raise self._unauthorized()

        try:
            payload = jwt.decode(token, options={"verify_signature": False})
            return TokenClaims.model_validate(payload)
        except (InvalidTokenError, ValueError) as exc:
            raise self._unauthorized() from exc

    @staticmethod
    def _unauthorized() -> HTTPException:
        return HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token ausente, inválido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_authenticated_request(request: Request) -> AuthenticatedRequest:
    credentials: HTTPAuthorizationCredentials | None = await bearer_scheme(request)
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise SupabaseTokenVerifier._unauthorized()

    verifier: SupabaseTokenVerifier = request.app.state.token_verifier
    claims = await verifier.verify(credentials.credentials)
    return AuthenticatedRequest(token=credentials.credentials, claims=claims)
