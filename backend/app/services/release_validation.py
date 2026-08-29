"""Quarentena local: inspeciona pacotes sem extrair nem executar código."""

import hashlib
import io
import json
import re
import sqlite3
import stat
import zipfile
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from uuid import uuid4

MAX_UPLOAD = 10 * 1024 * 1024
MAX_STORE = 100 * 1024 * 1024
MAX_EXPANDED = 40 * 1024 * 1024


def inspect_package(payload: bytes) -> dict:
    errors: list[str] = []
    manifest: dict = {}
    try:
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            entries = archive.infolist()
            if len(entries) > 2000 or sum(e.file_size for e in entries) > MAX_EXPANDED:
                raise ValueError("Pacote excede o limite de arquivos ou tamanho descompactado.")
            names: set[str] = set()
            for entry in entries:
                name = entry.orig_filename
                path = PurePosixPath(name)
                if (path.is_absolute() or ".." in path.parts or "\\" in name
                        or ":" in name or stat.S_ISLNK(entry.external_attr >> 16)):
                    raise ValueError("Pacote contém caminho inseguro ou link simbólico.")
                if name.casefold() in names:
                    raise ValueError("Pacote contém nomes de arquivos duplicados.")
                names.add(name.casefold())
                if entry.flag_bits & 1:
                    raise ValueError("Não é permitido ZIP protegido por senha.")
                if any(part in {".git", "node_modules", ".venv"} for part in path.parts):
                    raise ValueError("Não envie .git, node_modules ou .venv no pacote.")
                if path.name == ".env" or (
                    path.name.startswith(".env.") and not path.name.endswith(".example")
                ):
                    raise ValueError("Remova arquivos .env com credenciais do pacote.")
            info = archive.getinfo("release.json")
            if info.file_size > 65536:
                raise ValueError("O manifesto release.json é muito grande.")
            parsed = json.loads(archive.read(info))
            if not isinstance(parsed, dict):
                raise ValueError("release.json precisa ser um objeto JSON.")
            manifest = parsed
            if manifest.get("environment") != "homologacao":
                errors.append("O pacote deve declarar environment=homologacao.")
            if not re.fullmatch(r"\d+\.\d+\.\d+", str(manifest.get("version", ""))):
                errors.append("Informe version no formato 1.2.3.")
            if not re.fullmatch(r"\d+\.\d+\.\d+", str(manifest.get("base_version", ""))):
                errors.append("Informe base_version no formato 1.2.3.")
            if not isinstance(manifest.get("notes"), str) or not manifest["notes"].strip():
                errors.append("Descreva as alterações em notes.")
            for required in ("frontend/package.json", "backend/app/main.py", "pyproject.toml"):
                if required not in archive.namelist():
                    errors.append(f"Arquivo obrigatório ausente: {required}.")
    except (zipfile.BadZipFile, KeyError, UnicodeError, json.JSONDecodeError):
        errors.append("ZIP inválido ou release.json ausente/inválido na raiz.")
    except ValueError as exc:
        errors.append(str(exc))
    except (RuntimeError, NotImplementedError, OSError):
        errors.append("Não foi possível ler o formato deste ZIP.")
    return {
        "status": "BLOQUEADO" if errors else "AGUARDANDO_EXECUTOR",
        "errors": errors,
        "version": str(manifest.get("version", ""))[:60],
        "checks": {
            "estrutura": "FALHOU" if errors else "PASSOU",
            "compatibilidade": "NAO_EXECUTADO",
            "build": "NAO_EXECUTADO",
            "testes": "NAO_EXECUTADO",
            "migrations": "REVISAO_PENDENTE",
        },
        "notice": "Análise estrutural não aprova publicação. Executor isolado não configurado.",
    }


class ReleaseStore:
    def __init__(self, path: str):
        self.path = Path(path)

    @contextmanager
    def connect(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute(
            "CREATE TABLE IF NOT EXISTS releases "
            "(id TEXT PRIMARY KEY, owner TEXT, created TEXT, sha256 TEXT, "
            "payload BLOB, report TEXT)"
        )
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def add(self, owner: str, payload: bytes) -> dict:
        if not payload or len(payload) > MAX_UPLOAD:
            raise ValueError("Envie um arquivo ZIP de até 10 MB.")
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            total = db.execute(
                "SELECT coalesce(sum(length(payload)), 0) FROM releases"
            ).fetchone()[0]
            if total + len(payload) > MAX_STORE:
                raise ValueError("Quarentena cheia (100 MB). Solicite manutenção ao administrador.")
            identifier = str(uuid4())
            db.execute(
                "INSERT INTO releases VALUES (?, ?, ?, ?, ?, ?)",
                (identifier, owner, datetime.now(UTC).isoformat(),
                 hashlib.sha256(payload).hexdigest(), payload,
                 json.dumps({"status": "RECEBIDO", "checks": {}, "errors": []})),
            )
        return self.get(identifier)

    def get(self, identifier: str) -> dict:
        with self.connect() as db:
            row = db.execute(
                "SELECT id, created, sha256, report FROM releases WHERE id=?", (identifier,)
            ).fetchone()
        if row is None:
            raise LookupError("Versão não encontrada.")
        return {"id": row["id"], "created": row["created"], "sha256": row["sha256"],
                **json.loads(row["report"])}

    def list(self) -> list[dict]:
        with self.connect() as db:
            ids = db.execute("SELECT id FROM releases ORDER BY created DESC LIMIT 50").fetchall()
        return [self.get(row["id"]) for row in ids]

    def analyze(self, identifier: str) -> dict:
        with self.connect() as db:
            row = db.execute(
                "SELECT payload, sha256 FROM releases WHERE id=?", (identifier,)
            ).fetchone()
            if row is None:
                raise LookupError("Versão não encontrada.")
            if hashlib.sha256(row["payload"]).hexdigest() != row["sha256"]:
                report = {"status": "BLOQUEADO", "errors": ["Integridade do pacote inválida."]}
            else:
                report = inspect_package(row["payload"])
            db.execute("UPDATE releases SET report=? WHERE id=?", (json.dumps(report), identifier))
        return self.get(identifier)
