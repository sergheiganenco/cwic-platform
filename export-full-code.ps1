<#
  export-code-safe.ps1
  - Concatenates repo files into a single bundle (no backticks, no markdown fences).
  - Optional ZIP of the tree (preserves structure).
#>

[CmdletBinding()]
param(
  [string]$Root = (Get-Location).Path,
  [string]$OutFile = "FULL_CODE_BUNDLE.txt",
  [string]$ZipFile = "",
  [switch]$IncludeEverything,
  [int]$MaxFileKB = 5120,
  [string[]]$ExcludeDirs = @('node_modules','.git','.next','dist','build','.turbo','coverage','.vscode','.idea','logs','tmp','temp'),
  [string[]]$DefaultCodeExt = @('*.ts','*.tsx','*.js','*.jsx','*.json','*.sql','*.yml','*.yaml','*.md','*.sh','*.ps1','*.cjs','*.mjs','*.css','*.scss')
)

function Should-ExcludePath {
  param([string]$FullPath, [string[]]$Dirs)
  foreach ($d in $Dirs) {
    if ($FullPath -like "*\$d\*" -or $FullPath -like "*$d") { return $true }
  }
  return $false
}

Write-Host "Scanning: $Root"
$allFiles = Get-ChildItem -Path $Root -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
  -not (Should-ExcludePath $_.FullName $ExcludeDirs)
}

if (-not $IncludeEverything) {
  $allFiles = $allFiles | Where-Object {
    $name = $_.Name
    $matches = $false
    foreach ($p in $DefaultCodeExt) { if ($name -like $p) { $matches = $true; break } }
    $matches
  }
}

"Generated: $(Get-Date -Format s)  Root: $Root" | Out-File -FilePath $OutFile -Encoding UTF8
"FULL CODE BUNDLE (no markdown fences)" | Out-File -FilePath $OutFile -Append -Encoding UTF8
"" | Out-File -FilePath $OutFile -Append -Encoding UTF8

$repoRoot = (Resolve-Path $Root).Path
$sep = ('=' * 80)
$sub = ('-' * 80)

foreach ($f in $allFiles | Sort-Object FullName) {
  try {
    $sizeKB = [math]::Round(($f.Length/1KB),2)
    $rel = $f.FullName.Substring($repoRoot.Length).TrimStart('\','/')
    $header = "$sep`r`nFILE: $rel  (Size: ${sizeKB} KB)`r`n$sub"

    if ($f.Length -gt ($MaxFileKB*1KB)) {
      "$header`r`n# Skipped (>$MaxFileKB KB)`r`n" | Out-File -FilePath $OutFile -Append -Encoding UTF8
      continue
    }

    $header | Out-File -FilePath $OutFile -Append -Encoding UTF8
    Get-Content -LiteralPath $f.FullName -Raw -ErrorAction Stop | Out-File -FilePath $OutFile -Append -Encoding UTF8
    "`r`n" | Out-File -FilePath $OutFile -Append -Encoding UTF8
  } catch {
    $rel = $f.FullName.Substring($repoRoot.Length).TrimStart('\','/')
    "$sep`r`nFILE: $rel`r`n$sub`r`n# ERROR: $($_.Exception.Message)`r`n" | Out-File -FilePath $OutFile -Append -Encoding UTF8
  }
}

Write-Host "Bundle written to: $OutFile"

if ($ZipFile -and $ZipFile.Trim().Length -gt 0) {
  $tmpDir = Join-Path $env:TEMP ("cwic-zip-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $tmpDir | Out-Null
  try {
    foreach ($item in Get-ChildItem -Path $Root -Recurse -Force -ErrorAction SilentlyContinue) {
      if ($item.PSIsContainer) {
        if (Should-ExcludePath $item.FullName $ExcludeDirs) { continue }
        $dest = (Join-Path $tmpDir ($item.FullName.Substring($repoRoot.Length).TrimStart('\','/')))
        if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest -Force | Out-Null }
      } else {
        if (Should-ExcludePath $item.DirectoryName $ExcludeDirs) { continue }
        $destFile = (Join-Path $tmpDir ($item.FullName.Substring($repoRoot.Length).TrimStart('\','/')))
        $destDir  = Split-Path $destFile -Parent
        if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
        Copy-Item -LiteralPath $item.FullName -Destination $destFile -Force -ErrorAction SilentlyContinue
      }
    }
    if (Test-Path $ZipFile) { Remove-Item $ZipFile -Force }
    Compress-Archive -Path (Join-Path $tmpDir '*') -DestinationPath $ZipFile -Force
    Write-Host "ZIP written to: $ZipFile"
  } finally {
    Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}
