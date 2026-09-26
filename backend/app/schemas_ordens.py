from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_serializer,
    field_validator,
    model_validator,
)


class StatusOS(StrEnum):
    RECEBIDO = "RECEBIDO"
    EM_ANALISE = "EM_ANALISE"
    AGUARDANDO_APROVACAO = "AGUARDANDO_APROVACAO"
    EM_MANUTENCAO = "EM_MANUTENCAO"
    CONCLUIDO = "CONCLUIDO"
    ENTREGUE = "ENTREGUE"
    CANCELADO = "CANCELADO"


class PrioridadeOS(StrEnum):
    BAIXA = "BAIXA"
    NORMAL = "NORMAL"
    ALTA = "ALTA"
    URGENTE = "URGENTE"


class TipoItemOS(StrEnum):
    PECA = "PECA"
    SERVICO = "SERVICO"


class StatusCompraExterna(StrEnum):
    SOLICITADA = "SOLICITADA"
    COMPRADA = "COMPRADA"
    RECEBIDA = "RECEBIDA"
    CANCELADA = "CANCELADA"


class DestinoPecasCancelamento(StrEnum):
    DEVOLVER_ESTOQUE = "DEVOLVER_ESTOQUE"
    CONSUMIDAS = "CONSUMIDAS"
    PERDA = "PERDA"


class OrdemItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tipo: TipoItemOS
    id_item_estoque: UUID | None = None
    descricao: str | None = Field(default=None, max_length=300)
    quantidade: Decimal = Field(gt=0, le=Decimal("999999.99"), decimal_places=2)
    valor_unitario: Decimal | None = Field(
        default=None, ge=0, le=Decimal("999999999.99"), decimal_places=2
    )
    fornecedor: str | None = Field(default=None, max_length=180)
    custo_unitario: Decimal | None = Field(
        default=None, ge=0, le=Decimal("999999999.99"), decimal_places=2
    )

    @field_validator("descricao", "fornecedor", mode="before")
    @classmethod
    def limpar_descricao(cls, value: object) -> object:
        if value is None or not isinstance(value, str):
            return value
        clean = " ".join(value.strip().split())
        return clean or None

    @model_validator(mode="after")
    def validar_tipo(self) -> "OrdemItemCreate":
        if self.tipo == TipoItemOS.PECA:
            if self.quantidade != self.quantidade.to_integral_value():
                raise ValueError("A quantidade de peças deve ser inteira")
            if self.id_item_estoque is None and not self.descricao:
                raise ValueError("Informe a peça comprada para esta OS")
            if self.id_item_estoque is None and self.valor_unitario is None:
                raise ValueError("Informe o preço cobrado pela peça")
        else:
            if self.id_item_estoque is not None:
                raise ValueError("Serviços não podem apontar para o estoque")
            if not self.descricao:
                raise ValueError("Informe a descrição do serviço")
            if self.valor_unitario is None:
                raise ValueError("Informe o valor do serviço")
            if self.fornecedor is not None or self.custo_unitario is not None:
                raise ValueError("Fornecedor e custo são exclusivos de peças avulsas")
        return self


class OrdemItemResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id_item_os: UUID
    id_assistencia: UUID
    id_os: UUID
    tipo: TipoItemOS
    id_item_estoque: UUID | None
    descricao: str
    quantidade: Decimal
    valor_unitario: Decimal
    fornecedor: str | None = None
    custo_unitario: Decimal | None = None
    status_compra: StatusCompraExterna | None = None
    data_compra: datetime | None = None
    data_recebimento: datetime | None = None
    subtotal: Decimal
    data_criacao: datetime

    @field_serializer(
        "quantidade", "valor_unitario", "subtotal", "custo_unitario", when_used="json"
    )
    def serializar_decimal(self, value: Decimal | None) -> float | None:
        return float(value) if value is not None else None


class OrdemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id_cliente: UUID
    id_equip: UUID
    id_tecnico_responsavel: UUID | None = None
    defeito_relatorio: str = Field(min_length=3, max_length=3000)
    obser_os: str | None = Field(default=None, max_length=3000)
    prioridade_os: PrioridadeOS = PrioridadeOS.NORMAL

    @field_validator("defeito_relatorio", "obser_os", mode="before")
    @classmethod
    def limpar_texto(cls, value: object) -> object:
        if value is None or not isinstance(value, str):
            return value
        clean = " ".join(value.strip().split())
        return clean or None


class OrdemUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    defeito_relatorio: str | None = Field(default=None, min_length=3, max_length=3000)
    diag_os: str | None = Field(default=None, max_length=5000)
    obser_os: str | None = Field(default=None, max_length=3000)
    prioridade_os: PrioridadeOS | None = None
    id_tecnico_responsavel: UUID | None = None
    valor_total: Decimal | None = Field(
        default=None,
        ge=0,
        le=Decimal("999999999.99"),
        decimal_places=2,
    )

    @field_validator("defeito_relatorio", "diag_os", "obser_os", mode="before")
    @classmethod
    def limpar_texto(cls, value: object) -> object:
        if value is None or not isinstance(value, str):
            return value
        clean = " ".join(value.strip().split())
        return clean or None

    @model_validator(mode="after")
    def exigir_alteracao(self) -> "OrdemUpdate":
        if not self.model_fields_set:
            raise ValueError("Informe pelo menos um campo para alterar")
        return self


class AlteracaoStatusOS(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status_os: StatusOS


class AtualizacaoCompraExterna(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status_compra: StatusCompraExterna


class CancelamentoManutencao(BaseModel):
    model_config = ConfigDict(extra="forbid")
    destino_pecas: DestinoPecasCancelamento


class OrdemResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id_os: UUID
    id_assistencia: UUID
    num_os: str
    id_cliente: UUID
    id_equip: UUID
    id_usuario_abertura: UUID
    id_tecnico_responsavel: UUID | None
    data_aber: datetime
    data_atual: datetime
    data_conc: datetime | None
    data_entre: datetime | None
    defeito_relatorio: str
    diag_os: str | None
    valor_total: Decimal
    status_os: StatusOS
    obser_os: str | None
    prioridade_os: PrioridadeOS
    destino_pecas_cancelamento: DestinoPecasCancelamento | None = None
    data_cancelamento: datetime | None = None

    @field_serializer("valor_total", when_used="json")
    def serializar_valor_total(self, value: Decimal) -> float:
        return float(value)


class HistoricoOSResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id_hist: UUID
    id_assistencia: UUID
    id_usuario: UUID | None
    id_os: UUID
    data_evento: datetime
    status_anterior: StatusOS | None
    status_novo: StatusOS
    obs_hist: str | None


class UsuarioOperacionalResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id_usuario: UUID
    nome_usuario: str
    funcao_usuario: str
    ativo: bool
