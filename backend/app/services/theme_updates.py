"""Atualizações declarativas: sem CSS livre, extração de ZIP ou execução de código."""

import hashlib
import json
import re
from datetime import UTC, datetime

from app.services.release_validation import ReleaseStore, inspect_package, strict_json

TOKENS = {
    "--ls-sem-success", "--ls-sem-success-bg", "--ls-sem-success-hover",
    "--ls-sem-info", "--ls-sem-info-bg", "--ls-sem-edit", "--ls-sem-warning",
    "--ls-sem-danger", "--ls-sem-special",
}
INITIAL = {"version": "0.1.0", "revision": 0, "themes": {}, "release_id": None,
           "can_restore": False}


def contrast(first: str, second: str) -> float:
    def luminance(color):
        rgb = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
        rgb = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb]
        return sum(c * w for c, w in zip(rgb, (.2126, .7152, .0722), strict=True))
    a, b = sorted((luminance(first), luminance(second)))
    return (b + .05) / (a + .05)


def validate_theme(archive, manifest):
    fields = {"kind", "schema_version", "environment", "version", "base_version", "notes"}
    if set(manifest) != fields or type(manifest.get("schema_version")) is not int:
        raise ValueError("Manifesto de tema incompatível: utilize schema_version=1.")
    if manifest["schema_version"] != 1:
        raise ValueError("Versão do formato de tema não suportada.")
    if set(archive.namelist()) != {"release.json", "theme.json"}:
        raise ValueError("Pacote de tema aceita somente release.json e theme.json na raiz.")
    if archive.getinfo("theme.json").file_size > 16384:
        raise ValueError("theme.json excede 16 KB.")
    themes = strict_json(archive.read("theme.json"))
    if not isinstance(themes, dict) or set(themes) != {"light", "dark"}:
        raise ValueError("Informe os temas light e dark.")
    ratios = {}
    for mode, colors in themes.items():
        if not isinstance(colors, dict) or set(colors) != TOKENS:
            raise ValueError("Informe exatamente os nove tokens semânticos permitidos.")
        for key, color in colors.items():
            if not isinstance(color, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", color):
                raise ValueError("Cores devem ser hexadecimais #RRGGBB; CSS livre é proibido.")
            background = "#ffffff" if key.endswith(("-bg", "-hover")) else (
                "#d7ecdc" if mode == "light" else "#2c406e")
            if not key.endswith(("-bg", "-hover")):
                # Fundo dos botões de contorno inclui 9% da cor de destaque.
                channels = [round(int(color[i:i + 2], 16) * .09
                                  + int(background[i:i + 2], 16) * .91) for i in (1, 3, 5)]
                background = "#" + "".join(f"{channel:02x}" for channel in channels)
            ratio = contrast(color, background)
            ratios[f"{mode}:{key}"] = round(ratio, 2)
            if ratio < 4.5:
                raise ValueError(f"Contraste insuficiente em {mode}: {key} (mínimo 4,5:1).")
    return themes, ratios


class ThemeStore(ReleaseStore):
    def setup(self, db):
        db.execute("CREATE TABLE IF NOT EXISTS theme_state (id INTEGER PRIMARY KEY, data TEXT)")
        db.execute("INSERT OR IGNORE INTO theme_state VALUES (1, ?)", (json.dumps(INITIAL),))
        db.execute("CREATE TABLE IF NOT EXISTS theme_events (revision INTEGER PRIMARY KEY, "
                   "actor TEXT, created TEXT, action TEXT, before_state TEXT, after_state TEXT)")

    def state(self):
        with self.connect() as db:
            self.setup(db)
            return json.loads(db.execute("SELECT data FROM theme_state WHERE id=1").fetchone()[0])

    def history(self):
        with self.connect() as db:
            self.setup(db)
            return [dict(row) for row in db.execute(
                "SELECT revision, actor, created, action FROM theme_events "
                "ORDER BY revision DESC LIMIT 50")]

    def preview(self, identifier):
        report = self.analyze(identifier)
        state = self.state()
        if report.get("status") != "TEMA_VALIDADO":
            raise ValueError("Somente pacotes declarativos de tema validados têm prévia.")
        if report["base_version"] != state["version"]:
            raise ValueError("Versão base incompatível com o tema instalado.")
        return {**report, "expected_revision": state["revision"]}

    def change(self, actor, revision, confirmation, identifier=None, sha256=None):
        with self.connect() as db:
            self.setup(db)
            # Reserva de escrita: duas confirmações concorrentes não aplicam duas vezes.
            db.commit()
            db.execute("BEGIN IMMEDIATE")
            before = json.loads(db.execute("SELECT data FROM theme_state WHERE id=1").fetchone()[0])
            if before["revision"] != revision:
                raise ValueError("O tema mudou. Atualize a página e confira a prévia novamente.")
            if identifier:
                row = db.execute("SELECT * FROM releases WHERE id=?", (identifier,)).fetchone()
                if row is None:
                    raise LookupError("Versão não encontrada.")
                digest = hashlib.sha256(row["payload"]).hexdigest()
                if digest != row["sha256"] or sha256 != digest:
                    raise ValueError("Integridade ou confirmação do hash inválida.")
                report = inspect_package(row["payload"])
                if report["status"] != "TEMA_VALIDADO":
                    raise ValueError("Aplicação bloqueada: somente temas declarativos validados.")
                if report["base_version"] != before["version"]:
                    raise ValueError("Versão base incompatível com o tema instalado.")
                if confirmation != f"APLICAR {report['version']}":
                    raise ValueError("Confirmação incorreta. Digite APLICAR e a versão.")
                after = {"version": report["version"], "themes": report["themes"],
                         "release_id": identifier}
                action = "APLICAR"
            else:
                if confirmation != "RESTAURAR":
                    raise ValueError("Digite RESTAURAR para confirmar.")
                event = db.execute(
                    "SELECT * FROM theme_events WHERE revision=?", (revision,),
                ).fetchone()
                if event is None or event["action"] != "APLICAR":
                    raise ValueError("Nenhuma aplicação disponível para restaurar.")
                after = json.loads(event["before_state"])
                action = "RESTAURAR"
            after["revision"] = revision + 1
            after["can_restore"] = action == "APLICAR"
            db.execute("UPDATE theme_state SET data=? WHERE id=1", (json.dumps(after),))
            db.execute("INSERT INTO theme_events VALUES (?, ?, ?, ?, ?, ?)", (
                after["revision"], actor, datetime.now(UTC).isoformat(), action,
                json.dumps(before), json.dumps(after)))
        return after
