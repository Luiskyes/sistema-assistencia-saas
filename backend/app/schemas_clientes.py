import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ClienteBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nome_cliente: str = Field(min_length=2, max_length=100)
    cpf_cliente: str | None = None
    telefone: str | None = Field(default=None, max_length=20)
    endereco_cliente: str | None = Field(default=None, max_length=255)

    @field_validator("nome_cliente", "telefone", "endereco_cliente", mode="before")
    @classmethod
    def limpar_texto(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        clean = " ".join(value.strip().split())
        return clean or None

    @field_validator("cpf_cliente", mode="before")
    @classmethod
    def normalizar_cpf(cls, value: object) -> object:
        if value is None or value == "":
            return None
        if not isinstance(value, str):
            raise ValueError("CPF deve ser informado como texto")
        digits = re.sub(r"\D", "", value)
        if len(digits) != 11:
            raise ValueError("CPF deve possuir 11 dígitos")
        return digits


class ClienteCreate(ClienteBase):
    pass


class ClienteUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nome_cliente: str | None = Field(default=None, min_length=2, max_length=100)
    cpf_cliente: str | None = None
    telefone: str | None = Field(default=None, max_length=20)
    endereco_cliente: str | None = Field(default=None, max_length=255)

    @field_validator("nome_cliente", "telefone", "endereco_cliente", mode="before")
    @classmethod
    def limpar_texto(cls, value: object) -> object:
        if value is None:
            return None
        if not isinstance(value, str):
            return value
        clean = " ".join(value.strip().split())
        return clean or None

    @field_validator("cpf_cliente", mode="before")
    @classmethod
    def normalizar_cpf(cls, value: object) -> object:
        if value is None or value == "":
            return None
        if not isinstance(value, str):
            raise ValueError("CPF deve ser informado como texto")
        digits = re.sub(r"\D", "", value)
        if len(digits) != 11:
            raise ValueError("CPF deve possuir 11 dígitos")
        return digits

    @model_validator(mode="after")
    def exigir_alguma_alteracao(self) -> "ClienteUpdate":
        if not self.model_fields_set:
            raise ValueError("Informe pelo menos um campo para alterar")
        return self


class ClienteResponse(ClienteBase):
    model_config = ConfigDict(extra="ignore")

    id_cliente: UUID
    id_assistencia: UUID
    data_criacao: datetime
