param(
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$Version = '0.1.1',
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$BaseVersion = '0.1.0',
    [ValidateLength(3, 500)]
    [string]$Notes = 'Mini atualização visual da homologação.'
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Split-Path -Parent $PSScriptRoot)).Path
$releaseDirectory = Join-Path $projectRoot 'releases'
New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null
$output = Join-Path $releaseDirectory "lsassist-$Version-homologacao.zip"

if (-not ((Resolve-Path -LiteralPath $releaseDirectory).Path).StartsWith($projectRoot)) {
    throw 'Diretório de saída inválido.'
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stream = [System.IO.File]::Open($output, [System.IO.FileMode]::Create)
$archive = [System.IO.Compression.ZipArchive]::new(
    $stream, [System.IO.Compression.ZipArchiveMode]::Create, $false
)

try {
    $manifest = [ordered]@{
        environment = 'homologacao'
        version = $Version
        base_version = $BaseVersion
        notes = $Notes
    } | ConvertTo-Json
    $manifestEntry = $archive.CreateEntry('release.json')
    $writer = [System.IO.StreamWriter]::new($manifestEntry.Open())
    try { $writer.Write($manifest) } finally { $writer.Dispose() }

    $roots = @('backend', 'frontend/src', 'tests', 'supabase/migrations')
    $files = @('main.py', 'pyproject.toml', 'frontend/package.json',
        'frontend/package-lock.json', 'frontend/tsconfig.json', 'frontend/tsconfig.app.json',
        'frontend/tsconfig.node.json', 'frontend/vite.config.ts')
    foreach ($relative in $roots) {
        $absolute = Join-Path $projectRoot $relative
        if (Test-Path -LiteralPath $absolute) {
            $files += Get-ChildItem -LiteralPath $absolute -Recurse -File |
                Where-Object {
                    $_.FullName -notmatch '[\\/](__pycache__|node_modules|dist)[\\/]' -and
                    $_.Name -notlike '*.pyc' -and $_.Name -notlike '.env*'
                } | ForEach-Object {
                    $_.FullName.Substring($projectRoot.Length).TrimStart('\', '/')
                }
        }
    }

    foreach ($relative in ($files | Sort-Object -Unique)) {
        $absolute = Join-Path $projectRoot $relative
        if (-not (Test-Path -LiteralPath $absolute -PathType Leaf)) { continue }
        $entryName = $relative.Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $archive, $absolute, $entryName, [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    }
} finally {
    $archive.Dispose()
    $stream.Dispose()
}

$result = Get-Item -LiteralPath $output
if ($result.Length -gt 10MB) {
    throw "Pacote excede 10 MB: $($result.Length) bytes."
}
Get-FileHash -LiteralPath $output -Algorithm SHA256 |
    Select-Object Path, Hash, @{Name='Bytes';Expression={$result.Length}}
