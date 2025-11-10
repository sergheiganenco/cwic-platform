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
try {
    $dataSources = Invoke-RestMethod -Uri "$API_BASE/data-sources" -Method GET -Headers $headers
    $sourceCount = $dataSources.data.Count
    Write-Host "✓ Found $sourceCount data source(s)" -ForegroundColor Green

    if ($sourceCount -eq 0) {
        Write-Host "ERROR: No data sources available. Please add a data source first." -ForegroundColor Red
        exit 1
    }

    foreach ($ds in $dataSources.data) {
        Write-Host "  - $($ds.name) (ID: $($ds.id))" -ForegroundColor Cyan
    }
} catch {
    Write-Host "✗ Failed to fetch data sources: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 2: Fetch Enabled Rules (should exclude disabled rules now)
Write-Host "Test 2: Fetching enabled rules only..." -ForegroundColor Yellow
try {
    $rulesResponse = Invoke-RestMethod -Uri "$API_BASE/quality/rules?enabled=true" -Method GET -Headers $headers
    $rules = $rulesResponse.data.rules
    $ruleCount = $rules.Count
    Write-Host "✓ Found $ruleCount enabled rule(s)" -ForegroundColor Green

    if ($ruleCount -eq 0) {
        Write-Host "ERROR: No enabled rules available. Cannot proceed with tests." -ForegroundColor Red
        exit 1
    }

    # Show first 5 rules
    Write-Host "  First 5 rules:" -ForegroundColor Cyan
    $rules | Select-Object -First 5 | ForEach-Object {
        Write-Host "    - $($_.name) (Severity: $($_.severity), Enabled: $($_.enabled))" -ForegroundColor Cyan
    }

    # Check for disabled rules (should be none with enabled=true filter)
    $disabledCount = ($rules | Where-Object { -not $_.enabled }).Count
    if ($disabledCount -gt 0) {
        Write-Host "⚠ WARNING: Found $disabledCount disabled rule(s) despite enabled=true filter!" -ForegroundColor Red
    } else {
        Write-Host "✓ All fetched rules are enabled (filter working correctly)" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Failed to fetch rules: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 3: Execute a rule on ALL data sources (empty dataSourceId)
Write-Host "Test 3: Executing rule on ALL data sources..." -ForegroundColor Yellow

# Pick a simple rule that's likely to work (e.g., a "Has Data" rule)
$testRule = $rules | Where-Object { $_.name -like "*Has Data*" } | Select-Object -First 1

if (-not $testRule) {
    # If no "Has Data" rule, pick any enabled rule
    $testRule = $rules | Select-Object -First 1
}

Write-Host "  Using test rule: $($testRule.name) (ID: $($testRule.id))" -ForegroundColor Cyan

try {
    $executePayload = @{
        timeout = 60000
    } | ConvertTo-Json

    Write-Host "  Executing on ALL data sources (no dataSourceId specified)..." -ForegroundColor Cyan

    $executeResponse = Invoke-RestMethod -Uri "$API_BASE/quality/rules/$($testRule.id)/execute" `
        -Method POST -Headers $headers -Body $executePayload

    if ($executeResponse.success) {
        Write-Host "✓ Rule executed successfully" -ForegroundColor Green
        Write-Host "  Status: $($executeResponse.data.status)" -ForegroundColor Cyan
        Write-Host "  Records Scanned: $($executeResponse.data.recordsScanned)" -ForegroundColor Cyan
        Write-Host "  Issues Found: $($executeResponse.data.issuesFound)" -ForegroundColor Cyan

        if ($executeResponse.data.findings) {
            Write-Host "  Findings: $($executeResponse.data.findings.Count) finding(s)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "✗ Rule execution returned success=false" -ForegroundColor Red
        Write-Host "  Error: $($executeResponse.error)" -ForegroundColor Red
    }
} catch {
    $errorDetail = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "✗ Rule execution failed" -ForegroundColor Red
    Write-Host "  Error: $($errorDetail.error.message)" -ForegroundColor Red
    Write-Host "  Full error: $_" -ForegroundColor Red
}

Write-Host ""

# Test 4: Execute rule on EACH data source individually
Write-Host "Test 4: Executing rule on each data source individually..." -ForegroundColor Yellow

foreach ($ds in $dataSources.data) {
    Write-Host "  Testing data source: $($ds.name)" -ForegroundColor Cyan

    try {
        $executePayload = @{
            dataSourceId = $ds.id
            timeout = 60000
        } | ConvertTo-Json

        $executeResponse = Invoke-RestMethod -Uri "$API_BASE/quality/rules/$($testRule.id)/execute" `
            -Method POST -Headers $headers -Body $executePayload

        if ($executeResponse.success) {
            Write-Host "    ✓ Success - Status: $($executeResponse.data.status), Records: $($executeResponse.data.recordsScanned), Issues: $($executeResponse.data.issuesFound)" -ForegroundColor Green
        } else {
            Write-Host "    ✗ Failed - $($executeResponse.error)" -ForegroundColor Red
        }
    } catch {
        $errorDetail = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "    ✗ Exception - $($errorDetail.error.message)" -ForegroundColor Red
    }
}

Write-Host ""

# Test 5: Verify template rules are not in the enabled list
Write-Host "Test 5: Verifying template rules are filtered out..." -ForegroundColor Yellow

$templateCount = ($rules | Where-Object { $_.expression -match '\$\{[^}]+\}' }).Count

if ($templateCount -eq 0) {
    Write-Host "✓ No template rules in enabled rules list (correctly filtered)" -ForegroundColor Green
} else {
    Write-Host "⚠ WARNING: Found $templateCount template rule(s) in enabled list!" -ForegroundColor Red
    $rules | Where-Object { $_.expression -match '\$\{[^}]+\}' } | ForEach-Object {
        Write-Host "    - $($_.name)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Data Sources: $sourceCount" -ForegroundColor Cyan
Write-Host "Enabled Rules: $ruleCount" -ForegroundColor Cyan
Write-Host "Template Rules: $templateCount" -ForegroundColor Cyan
Write-Host ""
Write-Host "All tests completed!" -ForegroundColor Green
