# Ensures CWIC repo structure exists without overwriting existing files.
# Run from repo root: powershell -ExecutionPolicy Bypass -File .\ensure-structure.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Dirs {
  param([string[]]$Dirs)
  foreach ($d in $Dirs) {
    if (-not [string]::IsNullOrWhiteSpace($d)) {
      if (-not (Test-Path -LiteralPath $d)) {
        New-Item -ItemType Directory -Path $d -Force | Out-Null
        Write-Host "[created] $d"
      }
      # ensure .gitkeep so empty dirs are committed
      $gitkeep = Join-Path $d ".gitkeep"
      if (-not (Test-Path -LiteralPath $gitkeep)) {
        New-Item -ItemType File -Path $gitkeep -Force | Out-Null
      }
    }
  }
}

function Ensure-Files {
  param([string[]]$Files)
  foreach ($f in $Files) {
    if (-not [string]::IsNullOrWhiteSpace($f)) {
      if (-not (Test-Path -LiteralPath $f)) {
        # create parent dir if needed
        $parent = Split-Path -Parent $f
        if ($parent -and -not (Test-Path -LiteralPath $parent)) {
          New-Item -ItemType Directory -Path $parent -Force | Out-Null
        }
        New-Item -ItemType File -Path $f -Force | Out-Null
        Write-Host "[created] $f"
      }
    }
  }
}

Write-Host "==> Ensuring CWIC structure..."

# -----------------------------
# FRONTEND (folders + representative files)
# -----------------------------
$feDirs = @(
  "frontend\src\components\ui",
  "frontend\src\components\layout",
  "frontend\src\components\features\dashboard",
  "frontend\src\components\features\ai-assistant",
  "frontend\src\components\features\data-catalog",
  "frontend\src\components\features\data-quality",
  "frontend\src\components\features\pipelines",
  "frontend\src\components\features\Requests",
  "frontend\src\components\features\connections",
  "frontend\src\components\common",
  "frontend\src\pages",
  "frontend\src\hooks",
  "frontend\src\services\api",
  "frontend\src\services\integrations",
  "frontend\src\services\database",
  "frontend\src\store\slices",
  "frontend\src\store\middleware",
  "frontend\src\utils",
  "frontend\src\types",
  "frontend\src\styles",
  "frontend\src\config",
  "frontend\src\assets\images",
  "frontend\src\assets\icons",
  "frontend\src\assets\fonts",
  "frontend\public"
)
Ensure-Dirs $feDirs

$feFiles = @(
  # ui components
  "frontend\src\components\ui\Button.tsx",
  "frontend\src\components\ui\Modal.tsx",
  "frontend\src\components\ui\Card.tsx",
  "frontend\src\components\ui\Input.tsx",
  "frontend\src\components\ui\Select.tsx",
  "frontend\src\components\ui\Badge.tsx",
  "frontend\src\components\ui\Notification.tsx",
  "frontend\src\components\ui\index.ts",
  # layout
  "frontend\src\components\layout\Navigation.tsx",
  "frontend\src\components\layout\Header.tsx",
  "frontend\src\components\layout\Sidebar.tsx",
  "frontend\src\components\layout\Footer.tsx",
  "frontend\src\components\layout\index.ts",
  # features - dashboard
  "frontend\src\components\features\dashboard\DashboardOverview.tsx",
  "frontend\src\components\features\dashboard\KPICards.tsx",
  "frontend\src\components\features\dashboard\ActivityFeed.tsx",
  "frontend\src\components\features\dashboard\QuickActions.tsx",
  "frontend\src\components\features\dashboard\index.ts",
  # features - ai-assistant
  "frontend\src\components\features\ai-assistant\ChatInterface.tsx",
  "frontend\src\components\features\ai-assistant\MessageBubble.tsx",
  "frontend\src\components\features\ai-assistant\ActionButtons.tsx",
  "frontend\src\components\features\ai-assistant\TypingIndicator.tsx",
  "frontend\src\components\features\ai-assistant\index.ts",
  # features - data-catalog
  "frontend\src\components\features\data-catalog\AssetGrid.tsx",
  "frontend\src\components\features\data-catalog\AssetCard.tsx",
  "frontend\src\components\features\data-catalog\AssetDetails.tsx",
  "frontend\src\components\features\data-catalog\SearchFilters.tsx",
  "frontend\src\components\features\data-catalog\index.ts",
  # features - data-quality
  "frontend\src\components\features\data-quality\QualityOverview.tsx",
  "frontend\src\components\features\data-quality\QualityRules.tsx",
  "frontend\src\components\features\data-quality\ViolationsList.tsx",
  "frontend\src\components\features\data-quality\QualityTrends.tsx",
  "frontend\src\components\features\data-quality\index.ts",
  # features - pipelines
  "frontend\src\components\features\pipelines\PipelineList.tsx",
  "frontend\src\components\features\pipelines\PipelineCard.tsx",
  "frontend\src\components\features\pipelines\PipelineDetails.tsx",
  "frontend\src\components\features\pipelines\DeploymentHistory.tsx",
  "frontend\src\components\features\pipelines\index.ts",
  # features - requests
  "frontend\src\components\features\Requests\RequestList.tsx",
  "frontend\src\components\features\Requests\RequestForm.tsx",
  "frontend\src\components\features\Requests\RequestDetails.tsx",
  "frontend\src\components\features\Requests\ApprovalWorkflow.tsx",
  "frontend\src\components\features\Requests\index.ts",
  # features - connections
  "frontend\src\components\features\connections\DataSourceList.tsx",
  "frontend\src\components\features\connections\ConnectionForm.tsx",
  "frontend\src\components\features\connections\ConnectionTest.tsx",
  "frontend\src\components\features\connections\HealthMonitor.tsx",
  "frontend\src\components\features\connections\index.ts",
  # common
  "frontend\src\components\common\LoadingSpinner.tsx",
  "frontend\src\components\common\ErrorBoundary.tsx",
  "frontend\src\components\common\ConfirmDialog.tsx",
  "frontend\src\components\common\DataTable.tsx",
  "frontend\src\components\common\index.ts",
  # pages
  "frontend\src\pages\Dashboard.tsx",
  "frontend\src\pages\AIAssistant.tsx",
  "frontend\src\pages\DataCatalog.tsx",
  "frontend\src\pages\DataQuality.tsx",
  "frontend\src\pages\DataLineage.tsx",
  "frontend\src\pages\Pipelines.tsx",
  "frontend\src\pages\Requests.tsx",
  "frontend\src\pages\Connections.tsx",
  "frontend\src\pages\Governance.tsx",
  "frontend\src\pages\Monitoring.tsx",
  "frontend\src\pages\Settings.tsx",
  "frontend\src\pages\index.ts",
  # hooks
  "frontend\src\hooks\useAuth.ts",
  "frontend\src\hooks\useNotifications.ts",
  "frontend\src\hooks\useDataSources.ts",
  "frontend\src\hooks\useDataAssets.ts",
  "frontend\src\hooks\useQualityRules.ts",
  "frontend\src\hooks\usePipelines.ts",
  "frontend\src\hooks\useRequests.ts",
  "frontend\src\hooks\useAIChat.ts",
  "frontend\src\hooks\useLocalStorage.ts",
  "frontend\src\hooks\useDebounce.ts",
  "frontend\src\hooks\index.ts",
  # services
  "frontend\src\services\api\auth.ts",
  "frontend\src\services\api\dataSources.ts",
  "frontend\src\services\api\dataAssets.ts",
  "frontend\src\services\api\qualityRules.ts",
  "frontend\src\services\api\pipelines.ts",
  "frontend\src\services\api\Requests.ts",
  "frontend\src\services\api\aiAssistant.ts",
  "frontend\src\services\api\notifications.ts",
  "frontend\src\services\api\index.ts",
  "frontend\src\services\integrations\serviceNow.ts",
  "frontend\src\services\integrations\jira.ts",
  "frontend\src\services\integrations\azureDevOps.ts",
  "frontend\src\services\integrations\git.ts",
  "frontend\src\services\integrations\index.ts",
  "frontend\src\services\database\azureSql.ts",
  "frontend\src\services\database\synapse.ts",
  "frontend\src\services\database\fabric.ts",
  "frontend\src\services\database\dataLake.ts",
  "frontend\src\services\database\index.ts",
  # store
  "frontend\src\store\slices\authSlice.ts",
  "frontend\src\store\slices\dataSourcesSlice.ts",
  "frontend\src\store\slices\dataAssetsSlice.ts",
  "frontend\src\store\slices\qualitySlice.ts",
  "frontend\src\store\slices\pipelinesSlice.ts",
  "frontend\src\store\slices\RequestsSlice.ts",
  "frontend\src\store\slices\notificationsSlice.ts",
  "frontend\src\store\slices\uiSlice.ts",
  "frontend\src\store\middleware\authMiddleware.ts",
  "frontend\src\store\middleware\loggingMiddleware.ts",
  "frontend\src\store\middleware\index.ts",
  "frontend\src\store\index.ts",
  "frontend\src\store\store.ts",
  # utils
  "frontend\src\utils\formatters.ts",
  "frontend\src\utils\validators.ts",
  "frontend\src\utils\constants.ts",
  "frontend\src\utils\helpers.ts",
  "frontend\src\utils\dateUtils.ts",
  "frontend\src\utils\stringUtils.ts",
  "frontend\src\utils\apiUtils.ts",
  "frontend\src\utils\index.ts",
  # types
  "frontend\src\types\auth.ts",
  "frontend\src\types\dataSources.ts",
  "frontend\src\types\dataAssets.ts",
  "frontend\src\types\qualityRules.ts",
  "frontend\src\types\pipelines.ts",
  "frontend\src\types\Requests.ts",
  "frontend\src\types\notifications.ts",
  "frontend\src\types\api.ts",
  "frontend\src\types\common.ts",
  "frontend\src\types\index.ts",
  # styles + config
  "frontend\src\styles\globals.css",
  "frontend\src\styles\components.css",
  "frontend\src\styles\utilities.css",
  "frontend\src\styles\tailwind.css",
  "frontend\src\config\environment.ts",
  "frontend\src\config\api.ts",
  "frontend\src\config\database.ts",
  "frontend\src\config\auth.ts",
  "frontend\src\config\index.ts",
  # entry
  "frontend\src\App.tsx",
  "frontend\src\main.tsx",
  "frontend\src\vite-env.d.ts",
  # public
  "frontend\public\favicon.ico",
  "frontend\public\logo192.png",
  "frontend\public\logo512.png",
  "frontend\public\manifest.json",
  # root-level frontend config (placeholders if missing)
  "frontend\package.json",
  "frontend\tsconfig.json",
  "frontend\vite.config.ts",
  "frontend\tailwind.config.js",
  "frontend\postcss.config.js",
  "frontend\eslint.config.js",
  "frontend\.prettierrc",
  "frontend\.env.example",
  "frontend\Dockerfile"
)
Ensure-Files $feFiles

# -----------------------------
# BACKEND (services + shared)
# -----------------------------
$beServiceBase = @(
  "backend\api-gateway",
  "backend\auth-service",
  "backend\ai-service",
  "backend\data-service",
  "backend\pipeline-service",
  "backend\notification-service",
  "backend\integration-service"
)

$beDirs = @()
foreach ($svc in $beServiceBase) {
  $beDirs += @(
    "$svc\src",
    "$svc\src\controllers",
    "$svc\src\services",
    "$svc\src\models",
    "$svc\src\middleware",
    "$svc\src\routes",
    "$svc\src\utils"
  )
}
# service-specific extras
$beDirs += @(
  "backend\ai-service\src\processors",
  "backend\ai-service\src\prompts",
  "backend\integration-service\src\adapters\servicenow",
  "backend\integration-service\src\adapters\jira",
  "backend\integration-service\src\adapters\azure-devops",
  "backend\integration-service\src\adapters\git",
  "backend\shared\types",
  "backend\shared\utils",
  "backend\shared\config",
  "backend\shared\middleware",
  "backend\shared\constants"
)
Ensure-Dirs $beDirs

$beFiles = @(
  # minimal app.ts per service (placeholder)
  "backend\api-gateway\src\app.ts",
  "backend\auth-service\src\app.ts",
  "backend\ai-service\src\app.ts",
  "backend\data-service\src\app.ts",
  "backend\pipeline-service\src\app.ts",
  "backend\notification-service\src\app.ts",
  "backend\integration-service\src\app.ts",
  # package/docker placeholders if missing
  "backend\api-gateway\package.json",
  "backend\api-gateway\Dockerfile",
  "backend\auth-service\package.json",
  "backend\auth-service\Dockerfile",
  "backend\ai-service\package.json",
  "backend\ai-service\Dockerfile",
  "backend\data-service\package.json",
  "backend\data-service\Dockerfile",
  "backend\pipeline-service\package.json",
  "backend\pipeline-service\Dockerfile",
  "backend\notification-service\package.json",
  "backend\notification-service\Dockerfile",
  "backend\integration-service\package.json",
  "backend\integration-service\Dockerfile"
)
Ensure-Files $beFiles

# -----------------------------
# INFRASTRUCTURE
# -----------------------------
$infraDirs = @(
  "infrastructure\terraform\environments\dev",
  "infrastructure\terraform\environments\staging",
  "infrastructure\terraform\environments\production",
  "infrastructure\terraform\modules\networking",
  "infrastructure\terraform\modules\compute",
  "infrastructure\terraform\modules\storage",
  "infrastructure\terraform\modules\database",
  "infrastructure\terraform\modules\monitoring",
  "infrastructure\kubernetes\namespaces",
  "infrastructure\kubernetes\deployments",
  "infrastructure\kubernetes\services",
  "infrastructure\kubernetes\ingress",
  "infrastructure\kubernetes\configmaps",
  "infrastructure\kubernetes\secrets",
  "infrastructure\kubernetes\monitoring",
  "infrastructure\helm-charts\cwic-platform\templates",
  "infrastructure\helm-charts\dependencies",
  "infrastructure\docker-compose",
  "infrastructure\scripts"
)
Ensure-Dirs $infraDirs

$infraFiles = @(
  "infrastructure\terraform\main.tf",
  "infrastructure\terraform\variables.tf",
  "infrastructure\terraform\outputs.tf",
  "infrastructure\terraform\terraform.tfvars.example",
  "infrastructure\helm-charts\cwic-platform\values.yaml",
  "infrastructure\helm-charts\cwic-platform\Chart.yaml",
  "infrastructure\docker-compose\docker-compose.dev.yml",
  "infrastructure\docker-compose\docker-compose.staging.yml",
  "infrastructure\docker-compose\docker-compose.prod.yml",
  "infrastructure\docker-compose\docker-compose.override.yml",
  "infrastructure\scripts\deploy.sh",
  "infrastructure\scripts\rollback.sh",
  "infrastructure\scripts\backup.sh",
  "infrastructure\scripts\cleanup.sh"
)
Ensure-Files $infraFiles

# -----------------------------
# DATABASE
# -----------------------------
$dbDirs = @(
  "database\migrations",
  "database\seeds",
  "database\schemas",
  "database\scripts"
)
Ensure-Dirs $dbDirs

$dbFiles = @(
  "database\migrations\001_initial_schema.sql",
  "database\migrations\002_add_data_sources.sql",
  "database\migrations\003_add_quality_rules.sql",
  "database\migrations\004_add_pipelines.sql",
  "database\seeds\users.sql",
  "database\seeds\data_sources.sql",
  "database\seeds\quality_rules.sql",
  "database\seeds\pipelines.sql",
  "database\schemas\auth.sql",
  "database\schemas\data_catalog.sql",
  "database\schemas\quality.sql",
  "database\schemas\pipelines.sql",
  "database\schemas\audit.sql",
  "database\scripts\backup.sh",
  "database\scripts\restore.sh",
  "database\scripts\migrate.sh"
)
Ensure-Files $dbFiles

# -----------------------------
# DOCS
# -----------------------------
$docsDirs = @(
  "docs\api",
  "docs\architecture",
  "docs\user-guides",
  "docs\developer"
)
Ensure-Dirs $docsDirs

$docsFiles = @(
  "docs\api\auth-service.md",
  "docs\api\data-service.md",
  "docs\api\ai-service.md",
  "docs\api\pipeline-service.md",
  "docs\api\openapi.yaml",
  "docs\architecture\system-overview.md",
  "docs\architecture\data-flow.md",
  "docs\architecture\security.md",
  "docs\architecture\deployment.md",
  "docs\architecture\scaling.md",
  "docs\user-guides\getting-started.md",
  "docs\user-guides\ai-assistant.md",
  "docs\user-guides\data-catalog.md",
  "docs\user-guides\quality-management.md",
  "docs\user-guides\pipeline-management.md",
  "docs\developer\setup.md",
  "docs\developer\contributing.md",
  "docs\developer\coding-standards.md",
  "docs\developer\testing.md",
  "docs\developer\deployment.md",
  "docs\README.md"
)
Ensure-Files $docsFiles

# -----------------------------
# SCRIPTS
# -----------------------------
$scriptsDirs = @(
  "scripts\setup",
  "scripts\development",
  "scripts\deployment",
  "scripts\maintenance"
)
Ensure-Dirs $scriptsDirs

$scriptsFiles = @(
  "scripts\setup\install-dependencies.sh",
  "scripts\setup\setup-database.sh",
  "scripts\setup\configure-environment.sh",
  "scripts\setup\init-project.sh",
  "scripts\development\start-dev.sh",
  "scripts\development\build.sh",
  "scripts\development\test.sh",
  "scripts\development\lint.sh",
  "scripts\deployment\deploy-staging.sh",
  "scripts\deployment\deploy-production.sh",
  "scripts\deployment\rollback.sh",
  "scripts\deployment\health-check.sh",
  "scripts\maintenance\backup.sh",
  "scripts\maintenance\cleanup.sh",
  "scripts\maintenance\update-dependencies.sh",
  "scripts\maintenance\security-scan.sh"
)
Ensure-Files $scriptsFiles

# -----------------------------
# TESTS
# -----------------------------
$testsDirs = @(
  "tests\unit\frontend",
  "tests\unit\backend",
  "tests\integration\api",
  "tests\integration\database",
  "tests\e2e\cypress",
  "tests\e2e\playwright",
  "tests\performance\load",
  "tests\performance\stress",
  "tests\fixtures"
)
Ensure-Dirs $testsDirs

$testsFiles = @(
  "tests\fixtures\users.json",
  "tests\fixtures\data-sources.json",
  "tests\fixtures\pipelines.json"
)
Ensure-Files $testsFiles

# -----------------------------
# .GITHUB
# -----------------------------
$ghDirs = @(
  ".github\workflows",
  ".github\ISSUE_TEMPLATE"
)
Ensure-Dirs $ghDirs

$ghFiles = @(
  ".github\workflows\ci.yml",
  ".github\workflows\cd.yml",
  ".github\workflows\security.yml",
  ".github\workflows\dependency-update.yml",
  ".github\PULL_REQUEST_TEMPLATE.md",
  ".github\dependabot.yml"
)
Ensure-Files $ghFiles

# -----------------------------
# ROOT FILES
# -----------------------------
$rootFiles = @(
  "docker-compose.yml",
  "docker-compose.override.yml",
  ".env.example",
  ".gitignore",
  ".gitattributes",
  "README.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "CHANGELOG.md"
)
Ensure-Files $rootFiles

Write-Host "==> Done. All missing folders/files have been created as placeholders."
