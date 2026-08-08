from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class EquipamentoBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id_cliente: UUID
    marca_equip: str | None = Field(default=None, max_length=50)
    modelo_equip: str | None = Field(default=None, max_length=100)
    cor_equip: str | None = Field(default=None, max_length=30)
    num_serie: str | None = Field(default=None, max_length=100)
    descr_equip: str | None = Field(default=None, max_length=2000)

    @field_validator(
        "marca_equip", "modelo_equip", "cor_equip", "num_serie", "descr_equip", mode="before"
    )
    @classmethod
    def limpar_texto(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        clean = " ".join(value.strip().split())
        return clean or None


class EquipamentoCreate(EquipamentoBase):
    pass


class EquipamentoUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id_cliente: UUID | None = None
    marca_equip: str | None = Field(default=None, max_length=50)
    modelo_equip: str | None = Field(default=None, max_length=100)
    cor_equip: str | None = Field(default=None, max_length=30)
    num_serie: str | None = Field(default=None, max_length=100)
    descr_equip: str | None = Field(default=None, max_length=2000)

    @field_validator(
        "marca_equip", "modelo_equip", "cor_equip", "num_serie", "descr_equip", mode="before"
    )
    @classmethod
    def limpar_texto(cls, value: object) -> object:
        if value is None or not isinstance(value, str):
            return value
        clean = " ".join(value.strip().split())
        return clean or None

    @model_validator(mode="after")
    def exigir_alguma_alteracao(self) -> "EquipamentoUpdate":
        if not self.model_fields_set:
            raise ValueError("Informe pelo menos um campo para alterar")
        if "id_cliente" in self.model_fields_set and self.id_cliente is None:
            raise ValueError("id_cliente não pode ser nulo")
        return self


class EquipamentoResponse(EquipamentoBase):
    model_config = ConfigDict(extra="ignore")

    id_equip: UUID
    id_assistencia: UUID
    data_criacao: datetime
