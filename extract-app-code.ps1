# Application Code Extractor (Enhanced)
# Default: same behavior as your script (app code only, no configs/assets)
# Optional:
#   -IncludeConfigs  -> include package/build configs & env templates (safe)
#   -IncludeData     -> include DB migrations/seeds, Prisma schema, OpenAPI, YAML
#   -BackendOnly     -> backend services only

param(
  [string]$OutputFile = "cwic-app-code-only.txt",
  [switch]$BackendOnly = $false,
  [switch]$IncludeConfigs = $false,
  [switch]$IncludeData = $false
)

"" | Out-File -FilePath $OutputFile -Encoding UTF8

function Write-SectionHeader { param([string]$Title)
  "`n" + "=" * 100 | Add-Content -Path $OutputFile -Encoding UTF8
  "  $Title" | Add-Content -Path $OutputFile -Encoding UTF8
  "=" * 100 | Add-Content -Path $OutputFile -Encoding UTF8
  "" | Add-Content -Path $OutputFile -Encoding UTF8
}

function Write-FileHeader { param([string]$FilePath)
  "`n" + "-" * 60 | Add-Content -Path $OutputFile -Encoding UTF8
  "FILE: $FilePath" | Add-Content -Path $OutputFile -Encoding UTF8
  "-" * 60 | Add-Content -Path $OutputFile -Encoding UTF8
}

function Add-FileContent { param([string]$FilePath)
  try {
    if (Test-Path $FilePath -PathType Leaf) {
      $fileSize = (Get-Item $FilePath).Length
      if ($fileSize -gt 2MB) {
        "# File too large (>2MB) - skipped" | Add-Content -Path $OutputFile -Encoding UTF8
        return
      }
      try {
        $content = Get-Content $FilePath -Raw -ErrorAction Stop
        if ($content) { $content | Add-Content -Path $OutputFile -Encoding UTF8 }
        else { "# Empty file" | Add-Content -Path $OutputFile -Encoding UTF8 }
      } catch { "# Encoding issue - skipped" | Add-Content -Path $OutputFile -Encoding UTF8 }
    }
  } catch { "# Error reading file: $($_.Exception.Message)" | Add-Content -Path $OutputFile -Encoding UTF8 }
  "" | Add-Content -Path $OutputFile -Encoding UTF8
}

# Core application source extensions
$appExtensions = @("*.ts","*.tsx","*.js","*.jsx")

# Optional configs (safe to include; no secrets)
$configExtensions = @(
  "package.json","package-lock.json","yarn.lock","pnpm-lock.yaml",
  "tsconfig.json","tsconfig.*.json",
  "vite.config.*","webpack.config.*","rollup.config.*","next.config.*",
  "babel.config.*","jest.config.*","vitest.config.*",
  "postcss.config.*","tailwind.config.*",
  ".eslintrc.*","eslint.config.*",".prettierrc*","prettier.config.*",
  ".env.example",".env.sample",".env.dist","*.nvmrc",".npmrc"
)

# Optional data/model/API artifacts
$dataExtensions = @(
  # DB & schema
  "*.sql","*.psql","*.prisma",
  # OpenAPI/AsyncAPI/specs
  "openapi.*.json","openapi.*.yaml","openapi.*.yml","openapi.json","openapi.yaml","openapi.yml",
  "swagger.*.json","swagger.*.yaml","swagger.json","swagger.yaml",
  # Job/infra descriptors (no secrets)
  "*.yml","*.yaml","*.graphql","*.gql","*.cypher","*.cql"
)

# Strict excludes (still avoid secrets & build artifacts)
$excludeFiles = @(
  ".env",".env.*", # real secrets excluded
  "*.lock","*.log","*.pid","*.bak","*.tmp","Thumbs.db",
  "README.md","CHANGELOG.md","LICENSE",
  "Dockerfile*","docker-compose.*", # excluded unless you want them; toggle below
  "index.html","favicon.*","robots.txt","manifest.json","sw.js","service-worker.js"
)

# Optional: include container files if you want me to run locally
$includeDocker = $IncludeConfigs # tie to configs by default
if ($includeDocker) {
  $excludeFiles = $excludeFiles | Where-Object { $_ -notlike "Dockerfile*" -and $_ -notlike "docker-compose.*" }
}

$excludeDirs = @(
  "node_modules",".git","dist","build",".next",
  "coverage",".nyc_output","logs","tmp","temp",".turbo",".cache",
  ".vscode",".idea","public","assets","static"
)

# Exclude obvious non-app patterns
$systemFilePatterns = @("*config*","*Config*","*.config.*","setup*","Setup*","*setup*")

Write-SectionHeader ("CWIC PLATFORM - " + ($(if($BackendOnly){"BACKEND "}else{""}) + "APPLICATION CODE EXTRACT (Enhanced)"))
"Generated on: $(Get-Date)" | Add-Content -Path $OutputFile -Encoding UTF8
"Mode: CodeOnly$(if($IncludeConfigs){' + Configs'}else{''})$(if($IncludeData){' + Data'}else{''})" | Add-Content -Path $OutputFile -Encoding UTF8
"Includes: Business logic, components, services$(if($IncludeConfigs){', essential configs'})$(if($IncludeData){', DB migrations & OpenAPI'})" | Add-Content -Path $OutputFile -Encoding UTF8
"Excludes: Secrets, heavy binaries, build outputs" | Add-Content -Path $OutputFile -Encoding UTF8
"" | Add-Content -Path $OutputFile -Encoding UTF8

function Should-ExcludeFile { param([string]$fileName,[string]$filePath)
  foreach ($pattern in $excludeFiles) { if ($fileName -like $pattern) { return $true } }
  foreach ($pattern in $systemFilePatterns) {
    if (-not $IncludeConfigs) { if ($fileName -like $pattern) { return $true } }
  }
  if ($fileName -match "\.(test|spec)\.(ts|tsx|js|jsx)$") { return $true }
  if ($fileName -like "*test*" -or $fileName -like "*mock*") { return $true }
  return $false
}

# Services to scan
$backendServices = @(
  "backend/api-gateway",
  "backend/auth-service",
  "backend/data-service",
  "backend/ai-service",
  "backend/pipeline-service",
  "backend/notification-service",
  "backend/integration-service"
)

function Collect-Files {
  param(
    [string]$root,
    [string[]]$extensions,
    [string]$label
  )
  if (Test-Path $root) {
    Write-SectionHeader "$label"
    Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object {
        $name = $_.Name; $full = $_.FullName
        # ext match
        $hasExt = $false
        foreach ($ext in $extensions) { if ($name -like $ext) { $hasExt = $true; break } }

        # dir exclude
        $inExcludedDir = $false
        foreach ($dir in $excludeDirs) { if ($full -like "*\$dir\*") { $inExcludedDir = $true; break } }

        $hasExt -and -not $inExcludedDir -and -not (Should-ExcludeFile $name $full)
      } |
      Sort-Object FullName |
      ForEach-Object {
        $relativePath = $_.FullName.Replace((Get-Location).Path + "\", "")
        Write-FileHeader $relativePath
        Add-FileContent $_.FullName
      }
  }
}

# Backend
foreach ($service in $backendServices) {
  if (Test-Path $service) {
    $serviceName = ($service -split "/")[-1].Replace("-", " ").ToUpper()
    # src code
    Collect-Files -root (Join-Path $service "src") -extensions $appExtensions -label "$serviceName - SRC"
    if ($IncludeConfigs) {
      Collect-Files -root $service -extensions $configExtensions -label "$serviceName - CONFIGS"
    }
    if ($IncludeData) {
      Collect-Files -root $service -extensions $dataExtensions -label "$serviceName - DATA & API ARTIFACTS"
    }
  }
}

# Frontend
if (-not $BackendOnly) {
  Collect-Files -root "frontend/src" -extensions $appExtensions -label "FRONTEND - SRC"
  if ($IncludeConfigs) {
    Collect-Files -root "frontend" -extensions $configExtensions -label "FRONTEND - CONFIGS"
  }
  if ($IncludeData) {
    Collect-Files -root "frontend" -extensions $dataExtensions -label "FRONTEND - DATA & API ARTIFACTS"
  }
}

# Summary
Write-SectionHeader "SUMMARY"
"Included code types: $($appExtensions -join ', ')" | Add-Content -Path $OutputFile -Encoding UTF8
if ($IncludeConfigs) { "Included configs: $($configExtensions -join ', ')" | Add-Content -Path $OutputFile -Encoding UTF8 }
if ($IncludeData)   { "Included data/API: $($dataExtensions -join ', ')" | Add-Content -Path $OutputFile -Encoding UTF8 }
"Strictly excluded directories: $($excludeDirs -join ', ')" | Add-Content -Path $OutputFile -Encoding UTF8
"Secrets excluded: .env, .env.* (except .env.example)" | Add-Content -Path $OutputFile -Encoding UTF8

Write-Host "`nApplication code extraction completed!"
Write-Host "Output file: $OutputFile"
Write-Host "Size: $([math]::Round(((Get-Item $OutputFile).Length / 1KB),2)) KB"
$totalLines = (Get-Content $OutputFile | Measure-Object -Line).Lines
Write-Host "Total lines: $totalLines`n"
