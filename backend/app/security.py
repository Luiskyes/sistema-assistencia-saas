import asyncio
import logging
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
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AuthenticatedRequest:
    token: str
    claims: TokenClaims


class SupabaseTokenVerifier:
    """Valida o JWT localmente e usa a Auth API como fallback seguro.

    A validação local é o caminho rápido. Se houver incompatibilidade de chave,
    algoritmo, rotação de signing key ou qualquer falha de validação local, o
    token é confirmado diretamente pelo Supabase Auth antes de ser rejeitado.
    """

    def __init__(self, settings: Settings, http_client: httpx.AsyncClient) -> None:
        self.settings = settings
        self.http_client = http_client
        self.jwks = PyJWKClient(
            settings.supabase_jwks_url,
            cache_jwk_set=True,
            lifespan=600,
        )

    async def verify(self, token: str) -> TokenClaims:
        try:
            signing_key = await asyncio.to_thread(
                self.jwks.get_signing_key_from_jwt,
                token,
            )

            payload: dict[str, Any] = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256", "EdDSA"],
                audience="authenticated",
                issuer=self.settings.supabase_issuer,
                options={"require": ["exp", "iss", "sub", "role"]},
            )

            return TokenClaims.model_validate(payload)

        except (PyJWKClientError, InvalidTokenError, ValueError) as exc:
            logger.info("Validação JWT local indisponível; usando Auth API: %s", type(exc).__name__)
            # Um token válido do Supabase pode não ser verificável localmente
            # durante rotação/mudança de signing key ou em modo legado.
            # Antes de rejeitar, confirmamos o token com o próprio Auth server.
            return await self._verify_with_auth_server(token)

    async def _verify_with_auth_server(self, token: str) -> TokenClaims:
        try:
            response = await self.http_client.get(
                f"{self.settings.supabase_url}/auth/v1/user",
                headers={
                    "apikey": self.settings.supabase_publishable_key,
                    "Authorization": f"Bearer {token}",
                },
            )
        except httpx.HTTPError as exc:
            logger.warning("Falha de rede ao validar token na Auth API: %s", type(exc).__name__)
            raise self._unauthorized() from exc

        if response.status_code != status.HTTP_200_OK:
            logger.warning("Auth API rejeitou o token com status %s", response.status_code)
            raise self._unauthorized()

        try:
            user = response.json()
            payload: dict[str, Any] = jwt.decode(
                token,
                options={
                    "verify_signature": False,
                    "verify_aud": False,
                },
            )
            claims = TokenClaims.model_validate(payload)

            # O /auth/v1/user já validou o token. Esta checagem adicional
            # garante que o subject do JWT corresponde ao usuário retornado.
            if str(claims.sub) != str(user.get("id")):
                raise ValueError("JWT subject divergente do usuário autenticado")

            if claims.iss != self.settings.supabase_issuer:
                raise ValueError("JWT issuer inesperado")

            return claims

        except (InvalidTokenError, ValueError, TypeError, KeyError) as exc:
            logger.warning(
                "Claims do token rejeitadas após validação remota: %s",
                type(exc).__name__,
            )
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

    return AuthenticatedRequest(
        token=credentials.credentials,
        claims=claims,
    )
