param(
  [string]$TsRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

$ErrorActionPreference = "Stop"

$ufoSrc = Join-Path $RepoRoot "UFO"
$tftdSrc = Join-Path $RepoRoot "TFTD"
$outRoot = Join-Path $TsRoot "public\game-assets"
$ufoDst = Join-Path $outRoot "ufo"
$tftdDst = Join-Path $outRoot "tftd"

function Copy-Tree {
  param(
    [string]$Source,
    [string]$Destination
  )

  if (-not (Test-Path $Source)) {
    return $false
  }

  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  robocopy $Source $Destination /MIR /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
  return ($LASTEXITCODE -lt 8)
}

New-Item -ItemType Directory -Path $outRoot -Force | Out-Null

$ufoOk = Copy-Tree -Source $ufoSrc -Destination $ufoDst
$tftdOk = Copy-Tree -Source $tftdSrc -Destination $tftdDst

function Build-PackManifest {
  param(
    [string]$Name,
    [string]$Path,
    [bool]$Synced
  )

  if (-not $Synced -or -not (Test-Path $Path)) {
    return [ordered]@{
      name = $Name
      synced = $false
      fileCount = 0
      topExtensions = @()
    }
  }

  $files = Get-ChildItem -Path $Path -Recurse -File
  $topExtensions = $files |
    Group-Object Extension |
    Sort-Object Count -Descending |
    Select-Object -First 10 |
    ForEach-Object {
      [ordered]@{
        ext = if ([string]::IsNullOrWhiteSpace($_.Name)) { "<none>" } else { $_.Name }
        count = $_.Count
      }
    }

  return [ordered]@{
    name = $Name
    synced = $true
    fileCount = $files.Count
    topExtensions = $topExtensions
  }
}

$manifest = [ordered]@{
  generatedAtIso = (Get-Date).ToUniversalTime().ToString("o")
  packs = @(
    (Build-PackManifest -Name "ufo" -Path $ufoDst -Synced $ufoOk),
    (Build-PackManifest -Name "tftd" -Path $tftdDst -Synced $tftdOk)
  )
}

$manifestPath = Join-Path $outRoot "manifest.json"
$manifest | ConvertTo-Json -Depth 8 | Set-Content -Path $manifestPath -Encoding UTF8

Write-Host "Synced asset packs to $outRoot"
Write-Host "Manifest: $manifestPath"
