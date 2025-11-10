#!/usr/bin/env pwsh
# Comprehensive Test for Rules Hub - All Servers Filter

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Rules Hub Comprehensive Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$API_BASE = "http://localhost:3000/api"
$DEV_TOKEN = $env:DEV_BEARER

if (-not $DEV_TOKEN) {
    Write-Host "ERROR: DEV_BEARER environment variable not set" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $DEV_TOKEN"
    "Content-Type" = "application/json"
}

# Test 1: Fetch Data Sources
Write-Host "Test 1: Fetching available data sources..." -ForegroundColor Yellow
$dataSources = Invoke-RestMethod -Uri "$API_BASE/data-sources" -Method GET -Headers $headers
$sourceCount = $dataSources.data.Count
Write-Host "  Found $sourceCount data source(s)" -ForegroundColor Green

foreach ($ds in $dataSources.data) {
    Write-Host "    - $($ds.name) (ID: $($ds.id))" -ForegroundColor Cyan
}

Write-Host ""

# Test 2: Fetch Enabled Rules
Write-Host "Test 2: Fetching enabled rules only..." -ForegroundColor Yellow
$rulesResponse = Invoke-RestMethod -Uri "$API_BASE/quality/rules?enabled=true&limit=100" -Method GET -Headers $headers
$rules = $rulesResponse.data.rules
$ruleCount = $rules.Count
Write-Host "  Found $ruleCount enabled rule(s)" -ForegroundColor Green

# Show first 5 rules
Write-Host "  First 5 rules:" -ForegroundColor Cyan
$rules | Select-Object -First 5 | ForEach-Object {
    Write-Host "    - $($_.name) (Severity: $($_.severity))" -ForegroundColor Cyan
}

# Check for template rules
$templateRules = $rules | Where-Object { $_.expression -match '\$\{' }
$templateCount = $templateRules.Count
Write-Host "  Template rules found: $templateCount" -ForegroundColor $(if ($templateCount -eq 0) { "Green" } else { "Red" })

Write-Host ""

# Test 3: Pick a simple rule to test
Write-Host "Test 3: Selecting test rule..." -ForegroundColor Yellow
$testRule = $rules | Where-Object { $_.name -like "*Has Data*" } | Select-Object -First 1

if (-not $testRule) {
    $testRule = $rules | Where-Object { $_.expression -like "*SELECT COUNT*FROM*" } | Select-Object -First 1
}

if (-not $testRule) {
    Write-Host "  ERROR: Could not find suitable test rule" -ForegroundColor Red
    exit 1
}

Write-Host "  Using test rule: $($testRule.name)" -ForegroundColor Cyan
Write-Host "  Rule ID: $($testRule.id)" -ForegroundColor Cyan

Write-Host ""

# Test 4: Execute on first data source only
Write-Host "Test 4: Executing rule on first data source..." -ForegroundColor Yellow
$firstDs = $dataSources.data[0]
Write-Host "  Data source: $($firstDs.name)" -ForegroundColor Cyan

try {
    $payload = @{
        dataSourceId = $firstDs.id
        timeout = 60000
    } | ConvertTo-Json

    $result = Invoke-RestMethod -Uri "$API_BASE/quality/rules/$($testRule.id)/execute" `
        -Method POST -Headers $headers -Body $payload -ContentType "application/json"

    if ($result.success) {
        Write-Host "  SUCCESS!" -ForegroundColor Green
        Write-Host "    Status: $($result.data.status)" -ForegroundColor Cyan
        Write-Host "    Records Scanned: $($result.data.recordsScanned)" -ForegroundColor Cyan
        Write-Host "    Issues Found: $($result.data.issuesFound)" -ForegroundColor Cyan
    }
    else {
        Write-Host "  FAILED: $($result.error)" -ForegroundColor Red
    }
}
catch {
    Write-Host "  EXCEPTION: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 5: Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Data Sources: $sourceCount" -ForegroundColor Cyan
Write-Host "Enabled Rules: $ruleCount" -ForegroundColor Cyan
Write-Host "Template Rules: $templateCount" -ForegroundColor Cyan
Write-Host ""
Write-Host "Tests completed!" -ForegroundColor Green
