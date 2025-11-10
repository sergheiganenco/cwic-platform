# Complete Filter Testing Script
# Tests all 3 Data Quality filters: Server, Database, Type

$ErrorActionPreference = "Continue"
$baseUrl = "http://localhost:3002"
$dataSourceId = "793e4fe5-db62-4aa4-8b48-c220960d85ba"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Data Quality - Complete Filter Testing" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# TEST 1: SERVER FILTER (Data Sources)
# ============================================================================
Write-Host "TEST 1: Server Filter (Data Sources)" -ForegroundColor Yellow
Write-Host "--------------------------------------" -ForegroundColor Yellow

try {
    $response1 = Invoke-RestMethod -Uri "$baseUrl/api/data-sources" -Method GET

    if ($response1.success) {
        Write-Host "✅ PASS: Server filter API working" -ForegroundColor Green
        Write-Host "   Total data sources: $($response1.data.Count)" -ForegroundColor Gray

        foreach ($ds in $response1.data) {
            $statusColor = if ($ds.status -eq "connected") { "Green" } else { "Red" }
            Write-Host "   - $($ds.name) ($($ds.type)): $($ds.status)" -ForegroundColor $statusColor
        }

        $postgresSource = $response1.data | Where-Object { $_.type -eq "postgresql" } | Select-Object -First 1
        if ($postgresSource) {
            Write-Host "   ✅ PostgreSQL data source found: $($postgresSource.name)" -ForegroundColor Green
            $dataSourceId = $postgresSource.id
        } else {
            Write-Host "   ❌ FAIL: No PostgreSQL data source found!" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ FAIL: API returned success=false" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ FAIL: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# ============================================================================
# TEST 2: DATABASE FILTER
# ============================================================================
Write-Host "TEST 2: Database Filter" -ForegroundColor Yellow
Write-Host "--------------------------------------" -ForegroundColor Yellow

try {
    $response2 = Invoke-RestMethod -Uri "$baseUrl/api/data-sources/$dataSourceId/databases" -Method GET

    if ($response2.success) {
        Write-Host "✅ PASS: Database filter API working" -ForegroundColor Green
        Write-Host "   Total databases: $($response2.data.Count)" -ForegroundColor Gray

        foreach ($db in $response2.data) {
            Write-Host "   - $($db.name)" -ForegroundColor Gray
        }

        $adventureworks = $response2.data | Where-Object { $_.name -eq "adventureworks" }
        if ($adventureworks) {
            Write-Host "   ✅ 'adventureworks' database found" -ForegroundColor Green
        } else {
            Write-Host "   ❌ FAIL: 'adventureworks' database NOT found!" -ForegroundColor Red
        }

        # Check no system databases
        $systemDbs = @('postgres', 'template0', 'template1', 'master', 'tempdb')
        $foundSystemDb = $response2.data | Where-Object { $systemDbs -contains $_.name }
        if ($foundSystemDb) {
            Write-Host "   ⚠️  WARNING: System database found: $($foundSystemDb.name)" -ForegroundColor Yellow
        } else {
            Write-Host "   ✅ No system databases in list (correctly filtered)" -ForegroundColor Green
        }
    } else {
        Write-Host "❌ FAIL: API returned success=false" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ FAIL: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# ============================================================================
# TEST 3: PROFILING DATA (Type Filter)
# ============================================================================
Write-Host "TEST 3: Type Filter (Profiling)" -ForegroundColor Yellow
Write-Host "--------------------------------------" -ForegroundColor Yellow

try {
    $profilingBody = @{ database = "adventureworks" } | ConvertTo-Json
    $response3 = Invoke-RestMethod -Uri "$baseUrl/api/quality/profile/datasource/$dataSourceId" `
        -Method POST `
        -Body $profilingBody `
        -ContentType "application/json"

    if ($response3.success) {
        $profiles = $response3.data.profiles
        Write-Host "✅ PASS: Profiling API working" -ForegroundColor Green
        Write-Host "   Total profiles: $($profiles.Count)" -ForegroundColor Gray
        Write-Host "   Successful: $($response3.data.successfulProfiles)" -ForegroundColor Green
        Write-Host "   Failed: $($response3.data.failedProfiles)" -ForegroundColor $(if ($response3.data.failedProfiles -eq 0) { "Green" } else { "Red" })
        Write-Host "   Avg Quality Score: $($response3.data.averageQualityScore)%" -ForegroundColor Cyan
        Write-Host ""

        # Count by type
        $tables = $profiles | Where-Object { $_.assetType -eq "table" }
        $views = $profiles | Where-Object { $_.assetType -eq "view" }

        Write-Host "   Asset Type Breakdown:" -ForegroundColor White
        Write-Host "   - Tables: $($tables.Count)" -ForegroundColor Gray
        Write-Host "   - Views: $($views.Count)" -ForegroundColor Gray
        Write-Host ""

        if ($tables.Count -eq 20) {
            Write-Host "   ✅ Correct table count (20)" -ForegroundColor Green
        } else {
            Write-Host "   ❌ FAIL: Expected 20 tables, got $($tables.Count)" -ForegroundColor Red
        }

        if ($views.Count -eq 0) {
            Write-Host "   ✅ Correct view count (0)" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  WARNING: Expected 0 views, got $($views.Count)" -ForegroundColor Yellow
        }

        # Check for system tables
        $systemTables = $profiles | Where-Object {
            $_.assetName -match "^pg_" -or
            $_.assetName -match "information_schema" -or
            $_.assetName -match "sys\."
        }

        if ($systemTables.Count -eq 0) {
            Write-Host "   ✅ No system tables in results" -ForegroundColor Green
        } else {
            Write-Host "   ❌ FAIL: Found $($systemTables.Count) system tables!" -ForegroundColor Red
            $systemTables | ForEach-Object {
                Write-Host "      - $($_.assetName)" -ForegroundColor Red
            }
        }

        # Sample table names
        Write-Host ""
        Write-Host "   Sample Tables (first 5):" -ForegroundColor White
        $profiles | Select-Object -First 5 | ForEach-Object {
            Write-Host "   - $($_.assetName) (Quality: $($_.qualityScore)%)" -ForegroundColor Gray
        }

    } else {
        Write-Host "❌ FAIL: API returned success=false" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ FAIL: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Details: $($_.ErrorDetails.Message)" -ForegroundColor Gray
}
Write-Host ""

# ============================================================================
# SUMMARY
# ============================================================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Filter 1 - Server (Data Sources):" -ForegroundColor White
Write-Host "  Status: $(if ($response1.success) { '✅ WORKING' } else { '❌ FAILED' })" -ForegroundColor $(if ($response1.success) { 'Green' } else { 'Red' })
Write-Host ""
Write-Host "Filter 2 - Database:" -ForegroundColor White
Write-Host "  Status: $(if ($response2.success) { '✅ WORKING' } else { '❌ FAILED' })" -ForegroundColor $(if ($response2.success) { 'Green' } else { 'Red' })
Write-Host "  Databases Found: $($response2.data.Count)" -ForegroundColor Gray
Write-Host ""
Write-Host "Filter 3 - Type (Profiling):" -ForegroundColor White
Write-Host "  Status: $(if ($response3.success) { '✅ WORKING' } else { '❌ FAILED' })" -ForegroundColor $(if ($response3.success) { 'Green' } else { 'Red' })
Write-Host "  Tables: $($tables.Count)" -ForegroundColor Gray
Write-Host "  Views: $($views.Count)" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

if ($response1.success -and $response2.success -and $response3.success) {
    Write-Host "✅ ALL FILTERS WORKING!" -ForegroundColor Green
} else {
    Write-Host "❌ SOME FILTERS FAILED - Check details above" -ForegroundColor Red
}
Write-Host "========================================" -ForegroundColor Cyan
