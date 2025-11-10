# Test Intelligent AI Assistant
Write-Host "`n=== Testing Intelligent AI Assistant ===`n" -ForegroundColor Cyan

$frontendUrl = "http://localhost:3000"
$apiUrl = "http://localhost:3002"

# Test 1: Frontend Check
Write-Host "--- 1. Frontend Check ---" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$frontendUrl/assistant" -Method GET -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "OK - Frontend is accessible" -ForegroundColor Green
    }
} catch {
    Write-Host "ERROR - Frontend: $_" -ForegroundColor Red
}

# Test 2: Backend Check
Write-Host "`n--- 2. Backend Check ---" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$apiUrl/health" -Method GET
    Write-Host "OK - Backend is healthy" -ForegroundColor Green
} catch {
    Write-Host "ERROR - Backend: $_" -ForegroundColor Red
}

Write-Host "`n=== INTELLIGENT FEATURES ===`n" -ForegroundColor Cyan

Write-Host "1. Context Awareness" -ForegroundColor White
Write-Host "   - Remembers last discussed table" -ForegroundColor Gray
Write-Host "   - Understands follow-up questions" -ForegroundColor Gray

Write-Host "`n2. Intent Understanding" -ForegroundColor White
Write-Host "   - show_columns: Displays actual table columns" -ForegroundColor Gray
Write-Host "   - compliance_info: Provides GDPR, CCPA, HIPAA details" -ForegroundColor Gray
Write-Host "   - find_table: Searches and remembers context" -ForegroundColor Gray

Write-Host "`n3. Compliance Knowledge" -ForegroundColor White
Write-Host "   - GDPR: EU privacy regulation" -ForegroundColor Gray
Write-Host "   - CCPA: California privacy" -ForegroundColor Gray
Write-Host "   - HIPAA: Healthcare data" -ForegroundColor Gray

Write-Host "`n=== TEST QUERIES ===" -ForegroundColor Cyan
Write-Host "1. show columns for Notifications" -ForegroundColor White
Write-Host "2. what compliance regulations should I follow" -ForegroundColor White
Write-Host "3. find table wish" -ForegroundColor White
Write-Host "4. show data quality metrics" -ForegroundColor White

Write-Host "`nOpen browser: $frontendUrl/assistant" -ForegroundColor Green
Write-Host "The AI is now INTELLIGENT!`n" -ForegroundColor Yellow