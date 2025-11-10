Write-Host 'Testing Field Discovery Classification Filters:' -ForegroundColor Cyan
Write-Host ''

# Test All Fields
Write-Host '1. All fields (no filter):' -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri 'http://localhost:3003/api/field-discovery?limit=2000' -Method Get
    Write-Host "   Total: $($response.data.total), Returned: $($response.data.fields.Count)" -ForegroundColor Green
} catch {
    Write-Host "   Error: $_" -ForegroundColor Red
}

# Test PII Filter
Write-Host ''
Write-Host '2. PII fields:' -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri 'http://localhost:3003/api/field-discovery?classification=PII&limit=1000' -Method Get
    Write-Host "   Total: $($response.data.total), Returned: $($response.data.fields.Count)" -ForegroundColor Green
} catch {
    Write-Host "   Error: $_" -ForegroundColor Red
}

# Test Financial Filter
Write-Host ''
Write-Host '3. Financial fields:' -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri 'http://localhost:3003/api/field-discovery?classification=Financial&limit=1000' -Method Get
    Write-Host "   Total: $($response.data.total), Returned: $($response.data.fields.Count)" -ForegroundColor Green
} catch {
    Write-Host "   Error: $_" -ForegroundColor Red
}

# Test General Filter
Write-Host ''
Write-Host '4. General fields:' -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri 'http://localhost:3003/api/field-discovery?classification=General&limit=2000' -Method Get
    Write-Host "   Total: $($response.data.total), Returned: $($response.data.fields.Count)" -ForegroundColor Green
} catch {
    Write-Host "   Error: $_" -ForegroundColor Red
}

# Test Status Filters
Write-Host ''
Write-Host '5. Status filters:' -ForegroundColor Yellow
try {
    $pending = Invoke-RestMethod -Uri 'http://localhost:3003/api/field-discovery?status=pending&limit=2000' -Method Get
    Write-Host "   Pending: $($pending.data.total)" -ForegroundColor Green

    $accepted = Invoke-RestMethod -Uri 'http://localhost:3003/api/field-discovery?status=accepted&limit=1000' -Method Get
    Write-Host "   Accepted: $($accepted.data.total)" -ForegroundColor Green

    $rejected = Invoke-RestMethod -Uri 'http://localhost:3003/api/field-discovery?status=rejected&limit=1000' -Method Get
    Write-Host "   Rejected: $($rejected.data.total)" -ForegroundColor Green
} catch {
    Write-Host "   Error: $_" -ForegroundColor Red
}

Write-Host ''
Write-Host 'All tests completed!' -ForegroundColor Cyan