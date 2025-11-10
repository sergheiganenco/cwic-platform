# Test Smart PII Detection API
# PowerShell script to test PII detection endpoints

$baseUrl = "http://localhost:3002"
$dataSourceId = "793e4fe5-db62-4aa4-8b48-c220960d85ba"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Smart PII Detection API Testing" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Get databases from PostgreSQL source
Write-Host "Test 1: Get Databases from PostgreSQL" -ForegroundColor Yellow
$response1 = Invoke-RestMethod -Uri "$baseUrl/api/catalog/databases?dataSourceId=$dataSourceId" -Method GET
Write-Host "✅ Databases found:" -ForegroundColor Green
$response1.databases | ForEach-Object { Write-Host "  - $_" }
Write-Host ""

# Test 2: Get tables from adventureworks database
Write-Host "Test 2: Get Tables from adventureworks" -ForegroundColor Yellow
try {
    $response2 = Invoke-RestMethod -Uri "$baseUrl/api/catalog/tables?dataSourceId=$dataSourceId&databaseName=adventureworks" -Method GET
    Write-Host "✅ Tables found: $($response2.tables.Count)" -ForegroundColor Green
    Write-Host "Sample tables:"
    $response2.tables | Select-Object -First 5 | ForEach-Object {
        Write-Host "  - $($_.schemaName).$($_.tableName)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 3: Check if audit_log table exists
Write-Host "Test 3: Check for audit_log table" -ForegroundColor Yellow
$auditLogExists = $response2.tables | Where-Object { $_.tableName -eq "audit_log" }
if ($auditLogExists) {
    Write-Host "✅ audit_log table found in schema: $($auditLogExists.schemaName)" -ForegroundColor Green
} else {
    Write-Host "⚠️  audit_log table NOT found - may need to create test data" -ForegroundColor Yellow
}
Write-Host ""

# Test 4: Get table schema/columns
Write-Host "Test 4: Get Table Columns" -ForegroundColor Yellow
$firstTable = $response2.tables | Select-Object -First 1
if ($firstTable) {
    try {
        $columnsUrl = "$baseUrl/api/catalog/columns?dataSourceId=$dataSourceId&databaseName=adventureworks&schemaName=$($firstTable.schemaName)&tableName=$($firstTable.tableName)"
        $response4 = Invoke-RestMethod -Uri $columnsUrl -Method GET
        Write-Host "✅ Columns found for $($firstTable.schemaName).$($firstTable.tableName): $($response4.columns.Count)" -ForegroundColor Green
        Write-Host "Sample columns:"
        $response4.columns | Select-Object -First 5 | ForEach-Object {
            Write-Host "  - $($_.columnName) ($($_.dataType))" -ForegroundColor Gray
        }
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}
Write-Host ""

# Test 5: Test Smart PII Detection (if endpoint exists)
Write-Host "Test 5: Smart PII Detection API" -ForegroundColor Yellow
try {
    $piiBody = @{
        dataSourceId = $dataSourceId
        databaseName = "adventureworks"
        schemaName = $firstTable.schemaName
        tableName = $firstTable.tableName
    } | ConvertTo-Json

    $response5 = Invoke-RestMethod -Uri "$baseUrl/api/catalog/pii/detect" -Method POST -Body $piiBody -ContentType "application/json"
    Write-Host "✅ PII Detection successful!" -ForegroundColor Green
    Write-Host "Results:"
    $response5.columns | ForEach-Object {
        $color = if ($_.isPII) { "Red" } else { "Green" }
        $piiLabel = if ($_.isPII) { "PII: $($_.piiType)" } else { "SAFE" }
        Write-Host "  - $($_.columnName): $piiLabel (confidence: $($_.confidence)%)" -ForegroundColor $color
        Write-Host "    Reason: $($_.reason)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.ErrorDetails.Message)" -ForegroundColor Gray
}
Write-Host ""

# Test 6: Check for system tables (should be filtered out)
Write-Host "Test 6: System Tables Filtering" -ForegroundColor Yellow
$systemTables = $response2.tables | Where-Object {
    $_.tableName -like "pg_*" -or
    $_.schemaName -eq "information_schema" -or
    $_.schemaName -eq "pg_catalog"
}
if ($systemTables.Count -eq 0) {
    Write-Host "✅ System tables are filtered out!" -ForegroundColor Green
} else {
    Write-Host "❌ FAIL: Found $($systemTables.Count) system tables:" -ForegroundColor Red
    $systemTables | Select-Object -First 5 | ForEach-Object {
        Write-Host "  - $($_.schemaName).$($_.tableName)" -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
