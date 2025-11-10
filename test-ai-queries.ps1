# Test AI Assistant Query Handling
Write-Host "`n=== Testing AI Assistant Query Patterns ===" -ForegroundColor Cyan

# Test table search patterns
$tableQueries = @(
    "show me table wish",
    "find the table Wish",
    "find tables customer",
    "show customer table",
    "what fields does customer table have",
    "describe products table"
)

Write-Host "`n--- Testing Table Search Queries ---" -ForegroundColor Yellow
foreach ($query in $tableQueries) {
    Write-Host "Query: '$query'" -ForegroundColor Green

    # Simulate what the AI should do
    if ($query -match "wish|Wish") {
        Write-Host "  Expected: Search for 'wish' table in catalog API" -ForegroundColor Gray
        $response = Invoke-RestMethod -Uri "http://localhost:3002/assets?search=wish" -Method GET -ErrorAction SilentlyContinue
        if ($response.success) {
            Write-Host "  API Response: Found $($response.data.assets.Count) assets" -ForegroundColor Green
        } else {
            Write-Host "  API Error" -ForegroundColor Red
        }
    }
    elseif ($query -match "customer") {
        Write-Host "  Expected: Search for 'customer' tables in catalog API" -ForegroundColor Gray
        $response = Invoke-RestMethod -Uri "http://localhost:3002/assets?search=customer" -Method GET -ErrorAction SilentlyContinue
        if ($response.success) {
            Write-Host "  API Response: Found $($response.data.assets.Count) assets" -ForegroundColor Green
            if ($query -match "fields|describe|columns") {
                Write-Host "  Expected: Get columns for first customer table" -ForegroundColor Gray
            }
        } else {
            Write-Host "  API Error" -ForegroundColor Red
        }
    }
    elseif ($query -match "products") {
        Write-Host "  Expected: Search for 'products' table and get columns" -ForegroundColor Gray
        $response = Invoke-RestMethod -Uri "http://localhost:3002/assets?search=products" -Method GET -ErrorAction SilentlyContinue
        if ($response.success) {
            Write-Host "  API Response: Found $($response.data.assets.Count) assets" -ForegroundColor Green
        } else {
            Write-Host "  API Error" -ForegroundColor Red
        }
    }
}

# Test PII discovery patterns
Write-Host "`n--- Testing PII Discovery Queries ---" -ForegroundColor Yellow
$piiQueries = @(
    "find all PII fields in all sources",
    "Find sensitive data fields",
    "show me all personal information"
)

foreach ($query in $piiQueries) {
    Write-Host "Query: '$query'" -ForegroundColor Green
    Write-Host "  Expected: Call /pii-discovery/patterns API" -ForegroundColor Gray
    $response = Invoke-RestMethod -Uri "http://localhost:3002/pii-discovery/patterns" -Method GET -ErrorAction SilentlyContinue
    if ($response) {
        Write-Host "  API Response received" -ForegroundColor Green
    } else {
        Write-Host "  API Error or not available" -ForegroundColor Red
    }
}

# Test quality metrics patterns
Write-Host "`n--- Testing Quality Metrics Queries ---" -ForegroundColor Yellow
$qualityQueries = @(
    "show data quality",
    "check quality metrics",
    "quality report"
)

foreach ($query in $qualityQueries) {
    Write-Host "Query: '$query'" -ForegroundColor Green
    Write-Host "  Expected: Call /api/quality/metrics API" -ForegroundColor Gray
    $response = Invoke-RestMethod -Uri "http://localhost:3002/api/quality/metrics" -Method GET -ErrorAction SilentlyContinue
    if ($response.success -or $response.overallScore) {
        Write-Host "  API Response: Quality score available" -ForegroundColor Green
    } else {
        Write-Host "  API Error or not available" -ForegroundColor Red
    }
}

# Test compliance patterns
Write-Host "`n--- Testing Compliance Queries ---" -ForegroundColor Yellow
$complianceQueries = @(
    "Find the Data governance compliance",
    "What is GDPR?",
    "show compliance status"
)

foreach ($query in $complianceQueries) {
    Write-Host "Query: '$query'" -ForegroundColor Green
    if ($query -match "GDPR") {
        Write-Host "  Expected: Return comprehensive GDPR guide" -ForegroundColor Gray
        Write-Host "  Should provide detailed GDPR explanation" -ForegroundColor Green
    }
    else {
        Write-Host "  Expected: Return compliance information" -ForegroundColor Gray
        Write-Host "  Should provide compliance details" -ForegroundColor Green
    }
}

Write-Host "`n=== Test Summary ===" -ForegroundColor Cyan
Write-Host "The AI Assistant should handle all these patterns correctly." -ForegroundColor White
Write-Host "If any queries return generic responses, the pattern matching needs improvement." -ForegroundColor Yellow