"""Gera um pacote de cores sem código. Execute a partir da raiz com Python da .venv."""
import argparse
import io
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from app.services.release_validation import inspect_package

parser = argparse.ArgumentParser()
parser.add_argument("--base", default="0.1.0")
parser.add_argument("--version", default="0.1.1")
args = parser.parse_args()
keys = ["success", "success-bg", "success-hover", "info", "info-bg",
        "edit", "warning", "danger", "special"]
themes = {mode: dict(zip(["--ls-sem-" + k for k in keys], colors, strict=True))
          for mode, colors in {
              "light": ["#005510", "#006414", "#00440c", "#07556c", "#07556c",
                        "#5316b5", "#803d00", "#a51c1c", "#871251"],
              "dark": ["#80ef90", "#075b32", "#064d2b", "#75dcff", "#075a73",
                       "#dbcaff", "#ffd080", "#ffc1c1", "#ffc5e1"],
          }.items()}
manifest = {"kind": "theme", "schema_version": 1, "environment": "homologacao",
            "version": args.version, "base_version": args.base,
            "notes": "Luis — botões verdes, ciano, roxo, laranja e vermelho nos dois temas."}
buffer = io.BytesIO()
with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
    archive.writestr("release.json", json.dumps(manifest, ensure_ascii=False))
    archive.writestr("theme.json", json.dumps(themes))
report = inspect_package(buffer.getvalue())
if report["status"] != "TEMA_VALIDADO":
    raise SystemExit(report["errors"])
output = Path("releases") / f"luis-tema-{args.version}.zip"
output.parent.mkdir(exist_ok=True)
output.write_bytes(buffer.getvalue())
print(f"Pacote validado: {output}; menor contraste: {min(report['contrast'].values())}")
