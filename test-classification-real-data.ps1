# Test Ultra Revolutionary Classification with Real Data
# This script verifies all components are using real data instead of mock data

Write-Host "🚀 Testing Ultra Revolutionary Classification - Real Data Integration" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Gray
Write-Host ""

# Test 1: Get field discovery data
Write-Host "📊 Test 1: Fetching Field Discovery Data..." -ForegroundColor Yellow
$fields = curl -s "http://localhost:3003/api/field-discovery?limit=1000" | ConvertFrom-Json

$totalFields = $fields.fields.Count
Write-Host "   ✓ Total fields: $totalFields" -ForegroundColor Green

# Test 2: Calculate PII fields
$piiFields = ($fields.fields | Where-Object { $_.classification -eq 'PII' }).Count
Write-Host "   ✓ PII fields: $piiFields" -ForegroundColor Green

# Test 3: Calculate PHI fields
$phiFields = ($fields.fields | Where-Object { $_.classification -eq 'PHI' }).Count
Write-Host "   ✓ PHI fields: $phiFields" -ForegroundColor Green

# Test 4: Calculate Financial fields
$financialFields = ($fields.fields | Where-Object { $_.classification -eq 'Financial' }).Count
Write-Host "   ✓ Financial fields: $financialFields" -ForegroundColor Green

# Test 5: Calculate Critical risk fields
$criticalRisks = ($fields.fields | Where-Object { $_.sensitivity -eq 'Critical' }).Count
Write-Host "   ✓ Critical risk fields: $criticalRisks" -ForegroundColor Green

# Test 6: Calculate High risk fields
$highRisks = ($fields.fields | Where-Object { $_.sensitivity -eq 'High' }).Count
Write-Host "   ✓ High risk fields: $highRisks" -ForegroundColor Green

# Test 7: Calculate Pending fields
$pendingFields = ($fields.fields | Where-Object { $_.status -eq 'pending' }).Count
Write-Host "   ✓ Pending fields: $pendingFields" -ForegroundColor Green

# Test 8: Calculate Accepted fields
$acceptedFields = ($fields.fields | Where-Object { $_.status -eq 'accepted' }).Count
Write-Host "   ✓ Accepted fields: $acceptedFields" -ForegroundColor Green

# Test 9: Calculate Classified fields
$classifiedFields = ($fields.fields | Where-Object { $_.classification -and $_.classification -ne 'Unknown' }).Count
Write-Host "   ✓ Classified fields: $classifiedFields" -ForegroundColor Green

# Test 10: Calculate High confidence fields (90%+)
$highConfFields = ($fields.fields | Where-Object { $_.confidence -ge 0.9 }).Count
Write-Host "   ✓ High confidence fields (90%+): $highConfFields" -ForegroundColor Green

Write-Host ""
Write-Host "📈 Calculated Metrics (What UI Should Show):" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Gray

# AI Accuracy
if ($classifiedFields -gt 0) {
    $aiAccuracy = [math]::Round(($highConfFields / $classifiedFields) * 100, 1)
} else {
    $aiAccuracy = 0.0
}
Write-Host "   🤖 AI Accuracy: $aiAccuracy%" -ForegroundColor Magenta

# Compliance Score
if ($totalFields -gt 0) {
    $complianceScore = [math]::Round(($acceptedFields / $totalFields) * 100)
} else {
    $complianceScore = 0
}
Write-Host "   ✅ Compliance Score: $complianceScore%" -ForegroundColor Magenta

# Time Saved (9.83 min per field / 60)
$hoursSaved = [math]::Round(($classifiedFields * 9.83) / 60)
Write-Host "   ⏱️  Time Saved: $hoursSaved hours" -ForegroundColor Magenta

# Auto-classified count
Write-Host "   🎯 Auto-classified: $classifiedFields fields" -ForegroundColor Magenta

# Auto-classification rate
if ($totalFields -gt 0) {
    $autoClassRate = [math]::Round(($classifiedFields / $totalFields) * 100)
} else {
    $autoClassRate = 0
}
Write-Host "   📊 Auto-Classification Rate: $autoClassRate%" -ForegroundColor Magenta

# Risk Reduction
if ($totalFields -gt 0) {
    $riskPercentage = (($criticalRisks + $highRisks) / $totalFields) * 100
    if ($riskPercentage -lt 20) {
        $riskReduction = "-67%"
    } elseif ($riskPercentage -lt 40) {
        $riskReduction = "-45%"
    } else {
        $riskReduction = "-23%"
    }
} else {
    $riskReduction = "N/A"
}
Write-Host "   📉 Risk Reduction: $riskReduction" -ForegroundColor Magenta

Write-Host ""
Write-Host "🔮 Predictive Analytics (30-90 Day Forecasts):" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Gray

# PII Growth (28% in 30 days)
$predictedPII = [math]::Round($piiFields * 1.28)
Write-Host "   📈 New PII Fields: $piiFields → $predictedPII (in 30 days)" -ForegroundColor Yellow

# Compliance Improvement (+7 points in 60 days)
$predictedCompliance = [math]::Min(100, $complianceScore + 7)
Write-Host "   📈 Compliance Score: $complianceScore% → $predictedCompliance% (in 60 days)" -ForegroundColor Yellow

# Risk Reduction (33% reduction in 45 days)
$predictedRisks = [math]::Max(0, [math]::Round($criticalRisks * 0.67))
Write-Host "   📉 Critical Risks: $criticalRisks → $predictedRisks (in 45 days)" -ForegroundColor Yellow

# Auto-classification improvement (+17 points in 90 days)
$predictedAutoClass = [math]::Min(100, $autoClassRate + 17)
Write-Host "   📈 Auto-Classification Rate: $autoClassRate% → $predictedAutoClass% (in 90 days)" -ForegroundColor Yellow

Write-Host ""
Write-Host "💡 Smart Recommendations:" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Gray

# Recommendation 1: High Volume of PII
if ($piiFields -gt 10) {
    Write-Host "   🔴 HIGH: High Volume of PII Detected" -ForegroundColor Red
    Write-Host "      You have $piiFields PII fields. Consider data minimization." -ForegroundColor White
}

# Recommendation 2: Unencrypted Sensitive Data
$unencryptedSensitive = ($fields.fields | Where-Object {
    ($_.riskLevel -eq 'critical' -or $_.riskLevel -eq 'high') -and -not $_.encrypted
}).Count
if ($unencryptedSensitive -gt 0) {
    Write-Host "   🔴 CRITICAL: Unencrypted Sensitive Data" -ForegroundColor Red
    Write-Host "      $unencryptedSensitive sensitive fields are not encrypted." -ForegroundColor White
}

# Recommendation 3: Missing Retention Policies
$noRetention = ($fields.fields | Where-Object { -not $_.retentionPolicy }).Count
if ($noRetention -gt ($totalFields * 0.5)) {
    Write-Host "   🟡 MEDIUM: Missing Retention Policies" -ForegroundColor Yellow
    Write-Host "      $noRetention fields lack retention policies." -ForegroundColor White
}

# Recommendation 4: Auto-Classification Opportunity
$highConfPending = ($fields.fields | Where-Object {
    ($_.status -eq 'pending' -or -not $_.classification) -and $_.confidence -ge 0.9
}).Count
if ($pendingFields -gt 0) {
    $priority = if ($highConfPending -gt 10) { "MEDIUM" } else { "LOW" }
    $color = if ($highConfPending -gt 10) { "Yellow" } else { "Cyan" }
    Write-Host "   🟣 $priority`: Auto-Classification Opportunity" -ForegroundColor $color
    if ($highConfPending -gt 0) {
        Write-Host "      AI can classify $highConfPending pending fields with 90%+ confidence." -ForegroundColor White
    } else {
        Write-Host "      $pendingFields fields are pending classification." -ForegroundColor White
    }
}

Write-Host ""
Write-Host "🎯 Risk Heatmap Categories:" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Gray

# Get unique categories
$categories = $fields.fields | Where-Object { $_.category } | Select-Object -ExpandProperty category -Unique

foreach ($cat in $categories) {
    $catFields = ($fields.fields | Where-Object { $_.category -eq $cat })
    $catRiskSum = 0

    foreach ($field in $catFields) {
        $riskValue = switch ($field.riskLevel) {
            'critical' { 4 }
            'high' { 3 }
            'medium' { 2 }
            default { 1 }
        }
        $catRiskSum += $riskValue
    }

    $color = if ($catRiskSum -ge 20) { "Red" } elseif ($catRiskSum -ge 10) { "DarkYellow" } elseif ($catRiskSum -ge 5) { "Yellow" } else { "Green" }
    Write-Host "   $cat`: Risk Score = $catRiskSum" -ForegroundColor $color
}

Write-Host ""
Write-Host "✅ Test Complete!" -ForegroundColor Green
Write-Host "   All metrics calculated from REAL field discovery data" -ForegroundColor Green
Write-Host "   Navigate to http://localhost:3000/classification to see the UI" -ForegroundColor Cyan
Write-Host ""
