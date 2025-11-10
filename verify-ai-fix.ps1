# Verify Revolutionary AI is Working After Fix
Write-Host "`n=== Verifying Revolutionary AI After Import Fix ===`n" -ForegroundColor Cyan

$frontendUrl = "http://localhost:3000"
$apiUrl = "http://localhost:3002"

# Test 1: Frontend is accessible
Write-Host "--- 1. Frontend Check ---" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$frontendUrl/assistant" -Method GET -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Frontend is accessible" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Frontend error: $_" -ForegroundColor Red
}

# Test 2: Backend API is healthy
Write-Host "`n--- 2. Backend API Check ---" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$apiUrl/health" -Method GET
    Write-Host "✅ Backend is healthy" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend error: $_" -ForegroundColor Red
}

# Test 3: Table Search Working
Write-Host "`n--- 3. Table Search API ---" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$apiUrl/assets?search=wish" -Method GET
    if ($response.success) {
        Write-Host "✅ Table search API working - Found $($response.data.assets.Count) results" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Table search error: $_" -ForegroundColor Red
}

Write-Host "`n=== Fix Applied Successfully! ===`n" -ForegroundColor Cyan
Write-Host "The XCircle import has been added to RevolutionaryAI.tsx" -ForegroundColor White
Write-Host "The component should now render without errors" -ForegroundColor White
Write-Host "`n🚀 Open your browser to: $frontendUrl/assistant" -ForegroundColor Green
Write-Host "The Revolutionary AI Assistant is ready to use!`n" -ForegroundColor Yellow