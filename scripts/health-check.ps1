# scripts/health-check.ps1
$services = @(
  @{ Name = "API Gateway";        Url = "http://localhost:8000/health" },
  @{ Name = "Auth Service";       Url = "http://localhost:3001/health" },
  @{ Name = "Data Service";       Url = "http://localhost:3002/health" },
  @{ Name = "AI Service";         Url = "http://localhost:3003/health" },
  @{ Name = "Pipeline Service";   Url = "http://localhost:3004/health" },
  @{ Name = "Integration Service";Url = "http://localhost:3006/health" },
  @{ Name = "Notification Service"; Url = "http://localhost:3007/health" }
)

Write-Host "🏥 CWIC Platform Health Check" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor DarkGray

$allHealthy = $true
foreach ($s in $services) {
  $name = $s.Name
  $url  = $s.Url
  Write-Host ("{0,-22} {1}" -f "$name:", $url) -ForegroundColor DarkGray
  try {
    $res = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
    if ($res.StatusCode -eq 200) {
      Write-Host "  ✅ Healthy" -ForegroundColor Green
    } else {
      Write-Host "  ❌ $($res.StatusCode)" -ForegroundColor Red
      $allHealthy = $false
    }
  }
  catch {
    Write-Host "  ❌ $($_.Exception.Message)" -ForegroundColor Red
    $allHealthy = $false
  }
}
if (-not $allHealthy) { exit 1 }
