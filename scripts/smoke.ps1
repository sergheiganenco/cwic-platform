$ErrorActionPreference = "Stop"

function T($u){ Write-Host "`n--- $u ---" -ForegroundColor Cyan; curl.exe -s $u | Out-String | Write-Host }

T http://localhost:8000/upstreams
T http://localhost:8000/health
T http://localhost:8000/ready
T http://localhost:8000/api/auth/health
T http://localhost:8000/api/ai/health
T http://localhost:8000/api/data-sources
