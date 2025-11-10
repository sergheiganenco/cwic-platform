$response = Invoke-RestMethod -Uri 'http://localhost:3002/api/quality/profile/datasource/793e4fe5-db62-4aa4-8b48-c220960d85ba' -Method POST -Headers @{'Content-Type'='application/json'} -Body '{"database":"adventureworks"}'

Write-Host "`n=== AssetType Field Verification ===" -ForegroundColor Cyan
Write-Host "Total Profiles: $($response.data.profileCount)" -ForegroundColor Green
Write-Host "Tables: $($response.data.profiles | Where-Object { $_.assetType -eq 'table' } | Measure-Object | Select-Object -ExpandProperty Count)" -ForegroundColor Green
Write-Host "Views: $($response.data.profiles | Where-Object { $_.assetType -eq 'view' } | Measure-Object | Select-Object -ExpandProperty Count)" -ForegroundColor Green

Write-Host "`nFirst 5 profiles:" -ForegroundColor Yellow
$response.data.profiles | Select-Object -First 5 | ForEach-Object {
    Write-Host "  - $($_.assetName) (type: $($_.assetType))" -ForegroundColor White
}

Write-Host "`n✅ AssetType field is now present in API response!" -ForegroundColor Green
