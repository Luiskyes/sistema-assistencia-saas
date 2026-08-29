from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


@dataclass(frozen=True)
class PreNotaDados:
    assistencia_nome: str
    numero_os: str
    data_abertura: datetime
    status: str
    cliente_nome: str
    cliente_cpf: str | None
    cliente_telefone: str | None
    cliente_endereco: str | None
    equipamento_marca: str | None
    equipamento_modelo: str | None
    equipamento_cor: str | None
    equipamento_serie: str | None
    equipamento_descricao: str | None
    defeito_relatado: str
    diagnostico: str
    tecnico_nome: str | None
    valor_total: Decimal
    observacoes: str | None


STATUS_LABELS = {
    "RECEBIDO": "Recebido",
    "EM_ANALISE": "Em análise",
    "AGUARDANDO_APROVACAO": "Aguardando aprovação",
    "EM_MANUTENCAO": "Em manutenção",
    "CONCLUIDO": "Concluído",
    "ENTREGUE": "Entregue",
    "CANCELADO": "Cancelado",
}

PAPER_WIDTH = 80 * mm
MARGIN_X = 4 * mm
CONTENT_WIDTH = PAPER_WIDTH - (MARGIN_X * 2)
FONT = "Helvetica"
FONT_BOLD = "Helvetica-Bold"


def _texto(value: object | None, fallback: str = "Não informado") -> str:
    if value is None:
        return fallback
    result = str(value).strip()
    return result or fallback


def _cpf(value: str | None) -> str:
    digits = "".join(ch for ch in (value or "") if ch.isdigit())
    if len(digits) == 11:
        return f"{digits[:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:]}"
    return _texto(value)


def _moeda(value: Decimal) -> str:
    formatted = f"{value:,.2f}"
    formatted = formatted.replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {formatted}"


def _wrap(text: str, font_name: str, font_size: float, max_width: float) -> list[str]:
    paragraphs = str(text).replace("\r", "").split("\n")
    lines: list[str] = []

    for paragraph in paragraphs:
        words = paragraph.split()
        if not words:
            lines.append("")
            continue

        current = words[0]
        for word in words[1:]:
            candidate = f"{current} {word}"
            if stringWidth(candidate, font_name, font_size) <= max_width:
                current = candidate
            else:
                lines.append(current)
                current = word
        lines.append(current)

    return lines


def _measure_text(text: str, font_name: str, font_size: float, leading: float) -> float:
    return len(_wrap(text, font_name, font_size, CONTENT_WIDTH)) * leading


def _separator_height() -> float:
    return 4.5 * mm


def _measure_document(dados: PreNotaDados) -> float:
    height = 8 * mm

    height += 6.5 * mm  # marca
    height += _measure_text(_texto(dados.assistencia_nome), FONT, 7.8, 9.3)
    height += 2.5 * mm
    height += 5.5 * mm  # título
    height += 4.5 * mm  # aviso fiscal
    height += _separator_height()

    compact_lines = [
        f"OS: {dados.numero_os}",
        f"Data: {dados.data_abertura.strftime('%d/%m/%Y %H:%M')}",
        f"Status: {STATUS_LABELS.get(dados.status, dados.status)}",
    ]
    for line in compact_lines:
        height += _measure_text(line, FONT, 7.7, 9.2)
    height += _separator_height()

    sections = [
        (
            "CLIENTE",
            [
                _texto(dados.cliente_nome),
                f"CPF: {_cpf(dados.cliente_cpf)}",
                f"Tel: {_texto(dados.cliente_telefone)}",
                f"End: {_texto(dados.cliente_endereco)}",
            ],
        ),
        (
            "EQUIPAMENTO",
            [
                " ".join(filter(None, [dados.equipamento_marca, dados.equipamento_modelo]))
                or "Não informado",
                f"Cor: {_texto(dados.equipamento_cor)}",
                f"Série: {_texto(dados.equipamento_serie)}",
                _texto(dados.equipamento_descricao),
            ],
        ),
        ("DEFEITO RELATADO", [_texto(dados.defeito_relatado)]),
        ("DIAGNÓSTICO", [_texto(dados.diagnostico)]),
        ("TÉCNICO", [_texto(dados.tecnico_nome)]),
    ]

    for _title, body_lines in sections:
        height += 4.2 * mm
        for line in body_lines:
            height += _measure_text(line, FONT, 7.7, 9.2)
        height += 2.2 * mm

    height += _separator_height()
    height += 4.5 * mm
    height += 8 * mm
    height += _separator_height()

    footer = (
        "Pré-nota para conferência e aprovação do cliente. "
        "Não substitui nota fiscal, NF-e ou NFS-e."
    )
    height += _measure_text(footer, FONT, 6.8, 8.2)
    height += 5 * mm
    height += 7 * mm

    return max(height, 120 * mm)


def gerar_pre_nota_pdf(dados: PreNotaDados) -> bytes:
    buffer = BytesIO()
    page_height = _measure_document(dados)
    pdf = canvas.Canvas(
        buffer,
        pagesize=(PAPER_WIDTH, page_height),
        pageCompression=1,
    )
    pdf.setTitle(f"Pré-nota {dados.numero_os}")
    pdf.setAuthor("LSAssist")

    y = page_height - 6 * mm

    def centered(text: str, font: str, size: float, leading: float | None = None) -> None:
        nonlocal y
        actual_leading = leading or size * 1.2
        lines = _wrap(text, font, size, CONTENT_WIDTH)
        pdf.setFont(font, size)
        pdf.setFillColor(colors.HexColor("#111111"))
        for line in lines:
            pdf.drawCentredString(PAPER_WIDTH / 2, y, line)
            y -= actual_leading

    def left(text: str, font: str = FONT, size: float = 7.7, leading: float = 9.2) -> None:
        nonlocal y
        pdf.setFont(font, size)
        pdf.setFillColor(colors.HexColor("#111111"))
        for line in _wrap(text, font, size, CONTENT_WIDTH):
            pdf.drawString(MARGIN_X, y, line)
            y -= leading

    def section(title: str) -> None:
        nonlocal y
        y -= 1.5 * mm
        pdf.setFont(FONT_BOLD, 7.4)
        pdf.setFillColor(colors.HexColor("#111111"))
        pdf.drawString(MARGIN_X, y, title)
        y -= 4.2 * mm

    def separator() -> None:
        nonlocal y
        y -= 1.5 * mm
        pdf.setStrokeColor(colors.HexColor("#777777"))
        pdf.setLineWidth(0.35)
        pdf.setDash(1.5, 1.5)
        pdf.line(MARGIN_X, y, PAPER_WIDTH - MARGIN_X, y)
        pdf.setDash()
        y -= 3 * mm

    centered("LSAssist", FONT_BOLD, 13.5, 15)
    centered(_texto(dados.assistencia_nome), FONT, 7.8, 9.3)
    y -= 1.5 * mm
    centered("PRÉ-NOTA / ORÇAMENTO", FONT_BOLD, 10.5, 12)
    pdf.setFillColor(colors.HexColor("#8A4B08"))
    pdf.setFont(FONT_BOLD, 7.2)
    pdf.drawCentredString(PAPER_WIDTH / 2, y, "NÃO É DOCUMENTO FISCAL")
    y -= 8.5
    separator()

    left(f"OS: {dados.numero_os}", FONT_BOLD)
    left(f"Data: {dados.data_abertura.strftime('%d/%m/%Y %H:%M')}")
    left(f"Status: {STATUS_LABELS.get(dados.status, dados.status)}")
    separator()

    section("CLIENTE")
    left(_texto(dados.cliente_nome), FONT_BOLD)
    left(f"CPF: {_cpf(dados.cliente_cpf)}")
    left(f"Tel: {_texto(dados.cliente_telefone)}")
    left(f"End: {_texto(dados.cliente_endereco)}")

    section("EQUIPAMENTO")
    equipamento = (
        " ".join(filter(None, [dados.equipamento_marca, dados.equipamento_modelo]))
        or "Não informado"
    )
    left(equipamento, FONT_BOLD)
    left(f"Cor: {_texto(dados.equipamento_cor)}")
    left(f"Série: {_texto(dados.equipamento_serie)}")
    if dados.equipamento_descricao:
        left(_texto(dados.equipamento_descricao))

    section("DEFEITO RELATADO")
    left(_texto(dados.defeito_relatado))

    section("DIAGNÓSTICO")
    left(_texto(dados.diagnostico))

    section("TÉCNICO")
    left(_texto(dados.tecnico_nome))

    separator()
    centered("ORÇAMENTO", FONT_BOLD, 8.5, 10)
    y -= 1 * mm
    pdf.setFillColor(colors.HexColor("#111111"))
    pdf.setFont(FONT_BOLD, 14)
    pdf.drawCentredString(PAPER_WIDTH / 2, y, _moeda(dados.valor_total))
    y -= 16
    separator()

    footer = (
        "Pré-nota para conferência e aprovação do cliente. "
        "Não substitui nota fiscal, NF-e ou NFS-e."
    )
    centered(footer, FONT, 6.8, 8.2)
    y -= 1.5 * mm
    centered("Gerado pelo LSAssist", FONT_BOLD, 6.5, 7.8)

    # pequenas linhas finais ajudam no corte manual da bobina
    y -= 2 * mm
    pdf.setStrokeColor(colors.HexColor("#999999"))
    pdf.setLineWidth(0.3)
    pdf.line(18 * mm, y, 62 * mm, y)

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
