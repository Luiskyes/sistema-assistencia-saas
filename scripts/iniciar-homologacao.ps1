$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot ".env.homologacao"
$uvicorn = Join-Path $projectRoot ".venv\Scripts\uvicorn.exe"

if (-not (Test-Path -LiteralPath $envFile)) {
    throw "Arquivo .env.homologacao não encontrado. Copie .env.homologacao.example e preencha as credenciais."
}

if (-not (Test-Path -LiteralPath $uvicorn)) {
    throw "Ambiente Python não encontrado em .venv."
}

$env:LSASSIST_ENV_FILE = $envFile
Set-Location -LiteralPath $projectRoot
& $uvicorn main:app --host 127.0.0.1 --port 8000
