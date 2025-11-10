# Test Revolutionary AI Interface
Write-Host "`n=== Testing Revolutionary AI Interface ===`n" -ForegroundColor Cyan

# Test URLs
$apiUrl = "http://localhost:3002"
$frontendUrl = "http://localhost:3000"

Write-Host "Frontend URL: $frontendUrl/assistant" -ForegroundColor Yellow
Write-Host "Backend API: $apiUrl`n" -ForegroundColor Yellow

# Test 1: Backend API Health
Write-Host "--- 1. Backend API Health ---" -ForegroundColor Magenta
try {
    $health = Invoke-RestMethod -Uri "$apiUrl/health" -Method GET
    Write-Host "✅ Backend is healthy - Version: $($health.version)" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend not responding: $_" -ForegroundColor Red
}

# Test 2: Table Search API
Write-Host "`n--- 2. Testing Table Search API ---" -ForegroundColor Magenta
try {
    $response = Invoke-RestMethod -Uri "$apiUrl/assets?search=wish" -Method GET
    if ($response.success -and $response.data.assets) {
        Write-Host "✅ Table search working - Found $($response.data.assets.Count) assets for 'wish'" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Table search returned no results" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Table search failed: $_" -ForegroundColor Red
}

# Test 3: Quality Metrics API
Write-Host "`n--- 3. Testing Quality Metrics API ---" -ForegroundColor Magenta
try {
    $response = Invoke-RestMethod -Uri "$apiUrl/api/quality/metrics" -Method GET
    $score = if ($response.overallScore) { $response.overallScore } else { $response.overall_score }
    Write-Host "✅ Quality metrics working - Score: $score%" -ForegroundColor Green
} catch {
    Write-Host "❌ Quality metrics failed: $_" -ForegroundColor Red
}

# Test 4: PII Discovery API
Write-Host "`n--- 4. Testing PII Discovery API ---" -ForegroundColor Magenta
try {
    $response = Invoke-RestMethod -Uri "$apiUrl/pii-discovery/patterns" -Method GET
    if ($response.success) {
        Write-Host "✅ PII Discovery working" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ PII Discovery failed: $_" -ForegroundColor Red
}

# Test 5: Catalog Stats API
Write-Host "`n--- 5. Testing Catalog Stats API ---" -ForegroundColor Magenta
try {
    $response = Invoke-RestMethod -Uri "$apiUrl/api/catalog/stats" -Method GET
    Write-Host "✅ Catalog stats working" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Catalog stats not available (normal if not configured)" -ForegroundColor Yellow
}

Write-Host "`n=== Revolutionary AI Features ===" -ForegroundColor Cyan
Write-Host "✨ Split View Design:" -ForegroundColor White
Write-Host "   • Chat Tab - Main conversation interface" -ForegroundColor Gray
Write-Host "   • Insights Tab - Data analysis and recommendations" -ForegroundColor Gray
Write-Host "   • Actions Tab - Quick task execution" -ForegroundColor Gray

Write-Host "`n✨ Command Palette:" -ForegroundColor White
Write-Host "   • Press Cmd+K (Mac) or Ctrl+K (Windows) to open" -ForegroundColor Gray
Write-Host "   • Quick access to all features" -ForegroundColor Gray

Write-Host "`n✨ Quick Actions Bar:" -ForegroundColor White
Write-Host "   • Check Quality - Instant quality metrics" -ForegroundColor Gray
Write-Host "   • Find PII - Discover sensitive data" -ForegroundColor Gray
Write-Host "   • Generate SQL - Create queries" -ForegroundColor Gray
Write-Host "   • View Lineage - Data relationships" -ForegroundColor Gray

Write-Host "`n✨ Context Panel:" -ForegroundColor White
Write-Host "   • System intelligence and current context" -ForegroundColor Gray
Write-Host "   • Active pipelines and data sources" -ForegroundColor Gray
Write-Host "   • Recent activities" -ForegroundColor Gray

Write-Host "`n✨ Bottom Metrics Bar:" -ForegroundColor White
Write-Host "   • Assets Managed - Total catalog items" -ForegroundColor Gray
Write-Host "   • Quality Score - Overall health" -ForegroundColor Gray
Write-Host "   • Active Pipelines - Running workflows" -ForegroundColor Gray
Write-Host "   • Users Online - Active users" -ForegroundColor Gray

Write-Host "`n=== Test Queries to Try ===" -ForegroundColor Cyan
Write-Host "1. 'hello' - Get personalized greeting" -ForegroundColor White
Write-Host "2. 'find table wish' - Search for tables" -ForegroundColor White
Write-Host "3. 'show quality metrics' - Display quality stats" -ForegroundColor White
Write-Host "4. 'find PII fields' - Discover sensitive data" -ForegroundColor White
Write-Host "5. 'generate SQL for customer analysis' - Create queries" -ForegroundColor White

Write-Host "`n🚀 Open the Revolutionary AI at: $frontendUrl/assistant" -ForegroundColor Green
Write-Host "Press Cmd+K or Ctrl+K to open the command palette!`n" -ForegroundColor Yellow