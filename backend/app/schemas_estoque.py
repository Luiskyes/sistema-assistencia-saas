from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_serializer,
    field_validator,
    model_validator,
)


class EstoqueItemBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    codigo: str = Field(min_length=1, max_length=40)
    descricao: str = Field(min_length=2, max_length=140)
    categoria: str | None = Field(default=None, max_length=60)
    marca_compativel: str | None = Field(default=None, max_length=60)
    modelo_compativel: str | None = Field(default=None, max_length=120)
    quantidade_atual: int = Field(default=0, ge=0)
    quantidade_minima: int = Field(default=0, ge=0)
    custo_unitario: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    preco_venda: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    localizacao: str | None = Field(default=None, max_length=80)
    ativo: bool = True

    @field_validator(
        "codigo",
        "descricao",
        "categoria",
        "marca_compativel",
        "modelo_compativel",
        "localizacao",
        mode="before",
    )
    @classmethod
    def limpar_texto(cls, value: object) -> object:
        if value is None or not isinstance(value, str):
            return value
        clean = " ".join(value.strip().split())
        return clean or None

    @field_validator("codigo", mode="after")
    @classmethod
    def normalizar_codigo(cls, value: str) -> str:
        return value.upper()


class EstoqueItemCreate(EstoqueItemBase):
    pass


class EstoqueItemUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    codigo: str | None = Field(default=None, min_length=1, max_length=40)
    descricao: str | None = Field(default=None, min_length=2, max_length=140)
    categoria: str | None = Field(default=None, max_length=60)
    marca_compativel: str | None = Field(default=None, max_length=60)
    modelo_compativel: str | None = Field(default=None, max_length=120)
    quantidade_minima: int | None = Field(default=None, ge=0)
    custo_unitario: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    preco_venda: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    localizacao: str | None = Field(default=None, max_length=80)
    ativo: bool | None = None

    @field_validator(
        "codigo",
        "descricao",
        "categoria",
        "marca_compativel",
        "modelo_compativel",
        "localizacao",
        mode="before",
    )
    @classmethod
    def limpar_texto(cls, value: object) -> object:
        if value is None or not isinstance(value, str):
            return value
        clean = " ".join(value.strip().split())
        return clean or None

    @field_validator("codigo", mode="after")
    @classmethod
    def normalizar_codigo(cls, value: str | None) -> str | None:
        return value.upper() if value else value

    @model_validator(mode="after")
    def exigir_alguma_alteracao(self) -> "EstoqueItemUpdate":
        if not self.model_fields_set:
            raise ValueError("Informe pelo menos um campo para alterar")
        return self


class EstoqueAjuste(BaseModel):
    model_config = ConfigDict(extra="forbid")

    quantidade_nova: int = Field(ge=0)
    motivo: str = Field(min_length=3, max_length=255)

    @field_validator("motivo", mode="before")
    @classmethod
    def limpar_motivo(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        return " ".join(value.strip().split())


class EstoqueItemResponse(EstoqueItemBase):
    model_config = ConfigDict(extra="ignore")

    id_item: UUID
    id_assistencia: UUID
    data_criacao: datetime
    data_atualizacao: datetime

    @field_serializer("custo_unitario", "preco_venda", when_used="json")
    def serializar_valor_monetario(self, value: Decimal | None) -> float | None:
        return float(value) if value is not None else None


class MovimentoEstoqueResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id_movimento: UUID
    id_assistencia: UUID
    id_item: UUID
    id_usuario: UUID | None
    tipo: str
    quantidade: int
    quantidade_anterior: int
    quantidade_nova: int
    motivo: str | None
    data_movimento: datetime
