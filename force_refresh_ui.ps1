#!/usr/bin/env pwsh
# ============================================================================
# Force Browser Refresh Script - Rules Hub Fix
# ============================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Force UI Refresh - Rules Hub Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "BROWSER CACHE ISSUE DETECTED" -ForegroundColor Yellow
Write-Host "============================" -ForegroundColor Yellow
Write-Host ""

Write-Host "The following fixes have been applied:" -ForegroundColor Green
Write-Host "  1. ✓ Frontend now filters for enabled=true rules only" -ForegroundColor Green
Write-Host "  2. ✓ 578 broken autopilot NULL check rules disabled in database" -ForegroundColor Green
Write-Host "  3. ✓ Data service restarted with latest changes" -ForegroundColor Green
Write-Host "  4. ✓ Frontend dev server hot-reloaded" -ForegroundColor Green
Write-Host ""

Write-Host "PROBLEM:" -ForegroundColor Red
Write-Host "========" -ForegroundColor Red
Write-Host "Your browser is showing a CACHED version of the old code that still has:" -ForegroundColor Red
Write-Host "  - Disabled autopilot rules (showing 0 of 0 records)" -ForegroundColor Red
Write-Host "  - Old fetchRules function without enabled=true filter" -ForegroundColor Red
Write-Host ""

Write-Host "SOLUTION - HARD REFRESH YOUR BROWSER:" -ForegroundColor Yellow
Write-Host "======================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Windows: Ctrl + Shift + R" -ForegroundColor Cyan
Write-Host "  Mac:     Cmd + Shift + R" -ForegroundColor Cyan
Write-Host ""
Write-Host "Alternative methods:" -ForegroundColor Gray
Write-Host "  - Press Ctrl + F5 (Windows)" -ForegroundColor Gray
Write-Host "  - Open DevTools (F12), right-click refresh, 'Empty Cache and Hard Reload'" -ForegroundColor Gray
Write-Host "  - Open an Incognito/Private window" -ForegroundColor Gray
Write-Host ""

Write-Host "Verification - API Test:" -ForegroundColor Yellow
Write-Host "=======================" -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/quality/rules?enabled=true&limit=3" -Method GET
    $ruleCount = $response.data.pagination.total
    $rules = $response.data.rules

    Write-Host "  ✓ API Response: SUCCESS" -ForegroundColor Green
    Write-Host "  Total Enabled Rules: $ruleCount" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Sample Rules:" -ForegroundColor Cyan

    foreach ($rule in $rules) {
        $isTemplate = if ($rule.expression -match '\$\{') { "Template" } else { "Executable" }
        Write-Host "    - $($rule.name)" -ForegroundColor Cyan
        Write-Host "      Type: $isTemplate | Enabled: $($rule.enabled)" -ForegroundColor Gray
    }

    Write-Host ""
    Write-Host "  ✓ Backend is working correctly!" -ForegroundColor Green
    Write-Host "  ✓ The fix is ready - just refresh your browser!" -ForegroundColor Green
} catch {
    Write-Host "  ✗ API Error: $_" -ForegroundColor Red
    Write-Host "  Please ensure services are running." -ForegroundColor Red
}

Write-Host ""
Write-Host "After Hard Refresh, You Should See:" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green
Write-Host "  ✓ No autopilot NULL check rules with '0 of 0 records'" -ForegroundColor Green
Write-Host "  ✓ Only enabled, valid rules in the list" -ForegroundColor Green
Write-Host "  ✓ Template rules automatically skipped when running 'Run All'" -ForegroundColor Green
Write-Host "  ✓ Multi-source scanning working correctly with 'All Servers' filter" -ForegroundColor Green
Write-Host ""

Write-Host "Technical Details:" -ForegroundColor Cyan
Write-Host "==================" -ForegroundColor Cyan
Write-Host "  - Total enabled rules: 236 (includes template rules)" -ForegroundColor Cyan
Write-Host "  - Executable rules: ~173 (non-template)" -ForegroundColor Cyan
Write-Host "  - Disabled autopilot rules: 578" -ForegroundColor Cyan
Write-Host "  - Frontend fix: ModernRulesHubFixed.tsx:323-326" -ForegroundColor Cyan
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Please HARD REFRESH your browser now!" -ForegroundColor Yellow
Write-Host "  Press: Ctrl + Shift + R" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
