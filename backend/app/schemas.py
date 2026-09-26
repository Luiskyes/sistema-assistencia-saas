from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class FuncaoUsuario(StrEnum):
    DONO = "DONO"
    TECNICO = "TECNICO"
    RECEPCIONISTA = "RECEPCIONISTA"


class TokenClaims(BaseModel):
    sub: UUID
    role: str
    email: EmailStr | None = None
    exp: int
    iss: str
    app_metadata: dict[str, object] = Field(default_factory=dict)


class UsuarioAutenticado(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id_usuario: UUID
    id_auth: UUID
    id_assistencia: UUID
    cpf_usuario: str | None
    nome_usuario: str
    funcao_usuario: FuncaoUsuario
    email_usuario: EmailStr
    ativo: bool
    data_criacao: datetime


class AssistenciaAtual(BaseModel):
    id_assistencia: UUID
    nome_assistencia: str
    ativo: bool


class SessaoAtual(BaseModel):
    usuario: UsuarioAutenticado
    assistencia: AssistenciaAtual
