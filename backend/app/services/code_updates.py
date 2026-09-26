"""Inventário de atualização: somente leitura, nunca executa código ou SQL do ZIP."""

import hashlib
from pathlib import PurePosixPath
from zipfile import ZipFile


def prepare_code_plan(archive: ZipFile, manifest: dict, payload: bytes) -> dict:
    files = []
    migrations = []
    for entry in sorted(archive.infolist(), key=lambda item: item.filename):
        if entry.is_dir():
            continue
        digest = hashlib.sha256(archive.read(entry)).hexdigest()
        record = {"path": entry.filename, "bytes": entry.file_size, "sha256": digest}
        files.append(record)
        path = PurePosixPath(entry.filename)
        if path.suffix.lower() == ".sql":
            migrations.append({**record, "review": "REVISAO_OBRIGATORIA"})

    names = {item["path"] for item in files}
    required = ("frontend/index.html", "frontend/package-lock.json", "main.py")
    missing = [name for name in required if name not in names]
    blockers = []
    if missing:
        blockers.append("Pacote incompleto para build: " + ", ".join(missing) + ".")
    blockers.extend([
        "A versão instalada do aplicativo ainda não foi registrada; a base não foi comparada.",
        "Falta executar este ZIP em ambiente isolado e vincular os resultados ao seu SHA-256.",
        "Falta configurar o instalador e verificar a saúde da versão após a instalação.",
        "Falta validar uma cópia recuperável da versão anterior do aplicativo.",
    ])
    if migrations:
        blockers.append(
            "SQL exige revisão, comparação com migrações já aplicadas, backup e teste em banco "
            "descartável. Nenhum arquivo SQL foi executado ou aprovado."
        )
    return {
        "schema_version": 1,
        "package_sha256": hashlib.sha256(payload).hexdigest(),
        "target": "homologacao",
        "base_version": manifest["base_version"],
        "version": manifest["version"],
        "files": files,
        "migrations": migrations,
        "missing_build_files": missing,
        "blockers": blockers,
        "can_apply": False,
        "production_enabled": False,
        "recovery": {
            "application": "NAO_CONFIGURADA",
            "database": "REVISAO_OBRIGATORIA" if migrations else "SEM_SQL_NO_PACOTE",
            "notice": "Restaurar o código não desfaz mudanças no banco. A recuperação do banco "
                      "precisa de um plano próprio, sem perda dos dados posteriores.",
        },
    }
