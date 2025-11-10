# AI Assistant Real Data Setup Verification Script (PowerShell)

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "AI Assistant Real Data Configuration Checker" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$TotalChecks = 0
$PassedChecks = 0

# Function to check if a service is running
function Test-Service {
    param(
        [string]$Name,
        [string]$Url
    )

    Write-Host "Checking $Name... " -NoNewline
    $TotalChecks++

    try {
        $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "✓ Running" -ForegroundColor Green
            $script:PassedChecks++
            return $true
        }
    } catch {
        Write-Host "✗ Not responding" -ForegroundColor Red
        return $false
    }
}

# Function to check environment variable
function Test-EnvVar {
    param(
        [string]$File,
        [string]$Variable,
        [string]$Expected
    )

    Write-Host "  Checking $Variable in $File... " -NoNewline
    $script:TotalChecks++

    if (Test-Path $File) {
        $content = Get-Content $File -Raw
        if ($content -match "^$Variable=$Expected" -or $content -match "`n$Variable=$Expected") {
            Write-Host "✓ Correct" -ForegroundColor Green
            $script:PassedChecks++
            return $true
        }
    }

    Write-Host "✗ Not set or incorrect" -ForegroundColor Red
    return $false
}

Write-Host "1. Checking Services Status" -ForegroundColor Yellow
Write-Host "----------------------------"
$DataService = Test-Service "Data Service" "http://localhost:3002/health"
$AIService = Test-Service "AI Service" "http://localhost:8003/health"
$APIGateway = Test-Service "API Gateway" "http://localhost:8000/health"
$Frontend = Test-Service "Frontend" "http://localhost:5173"

Write-Host ""
Write-Host "2. Checking Backend Configuration" -ForegroundColor Yellow
Write-Host "---------------------------------"
$AIConfig = Test-EnvVar "backend\ai-service\.env" "DATA_SERVICE_URL" "http://localhost:3002"

Write-Host ""
Write-Host "3. Checking Frontend Configuration" -ForegroundColor Yellow
Write-Host "-----------------------------------"
$BackendEnabled = Test-EnvVar "frontend\.env" "VITE_USE_AI_BACKEND" "true"
$MockDisabled = Test-EnvVar "frontend\.env" "VITE_ENABLE_MOCK_MODE" "false"

Write-Host ""
Write-Host "4. Testing Real Data Availability" -ForegroundColor Yellow
Write-Host "----------------------------------"
Write-Host "  Testing data assets endpoint... " -NoNewline
$TotalChecks++

try {
    $assetsResponse = Invoke-WebRequest -Uri "http://localhost:3002/api/assets?limit=1" -UseBasicParsing -TimeoutSec 5
    if ($assetsResponse.Content -match '"data"') {
        Write-Host "✓ Data available" -ForegroundColor Green
        $PassedChecks++
        $AssetsOK = $true
    } else {
        Write-Host "⚠ No assets found (may need to run discovery)" -ForegroundColor Yellow
        $AssetsOK = $false
    }
} catch {
    Write-Host "✗ Cannot access data service" -ForegroundColor Red
    $AssetsOK = $false
}

Write-Host "  Testing AI enhanced query endpoint... " -NoNewline
$TotalChecks++

try {
    $aiResponse = Invoke-WebRequest -Uri "http://localhost:8000/api/ai/health" -UseBasicParsing -TimeoutSec 5
    if ($aiResponse.Content -match "ok") {
        Write-Host "✓ Endpoint accessible" -ForegroundColor Green
        $PassedChecks++
        $AIEndpointOK = $true
    } else {
        Write-Host "✗ Endpoint not accessible" -ForegroundColor Red
        $AIEndpointOK = $false
    }
} catch {
    Write-Host "✗ Endpoint not accessible" -ForegroundColor Red
    $AIEndpointOK = $false
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Checks passed: $PassedChecks/$TotalChecks"
Write-Host ""

if ($PassedChecks -eq $TotalChecks) {
    Write-Host "✓ All checks passed! AI Assistant is ready to use real data." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. Open http://localhost:5173/ai-assistant"
    Write-Host "  2. Ask: 'How many assets do we have?'"
    Write-Host "  3. You should see real numbers from your catalog"
    exit 0
} else {
    Write-Host "⚠ Some checks failed. Please review the issues above." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Common fixes:"

    if (-not $DataService) {
        Write-Host "  • Start Data Service: cd backend\data-service; npm run dev" -ForegroundColor Yellow
    }
    if (-not $AIService) {
        Write-Host "  • Start AI Service: cd backend\ai-service; npm run dev" -ForegroundColor Yellow
    }
    if (-not $APIGateway) {
        Write-Host "  • Start API Gateway: cd backend\api-gateway; npm run dev" -ForegroundColor Yellow
    }
    if (-not $Frontend) {
        Write-Host "  • Start Frontend: cd frontend; npm run dev" -ForegroundColor Yellow
    }
    if (-not $AIConfig -or -not $BackendEnabled -or -not $MockDisabled) {
        Write-Host "  • Check environment files (.env) have correct values" -ForegroundColor Yellow
        Write-Host "  • Restart services after changing .env files" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "For detailed configuration, see: REAL_DATA_CONFIGURATION.md" -ForegroundColor Cyan
    exit 1
}
