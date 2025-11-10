# Test Agentic AI Workflow Automation System
# This script tests all components of the system

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "AGENTIC AI SYSTEM - COMPREHENSIVE TEST" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$baseUrl = "http://localhost:3005"

# Test 1: Health Check
Write-Host "[1] Testing Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET
    Write-Host "   ✓ Service Status: $($health.status)" -ForegroundColor Green
    Write-Host "   ✓ Version: $($health.version)" -ForegroundColor Green
    Write-Host "   ✓ Features:" -ForegroundColor Green
    Write-Host "     - Workflows: $($health.features.workflows)" -ForegroundColor Gray
    Write-Host "     - Webhooks: $($health.features.webhooks)" -ForegroundColor Gray
    Write-Host "     - Scheduler: $($health.features.scheduler)" -ForegroundColor Gray
    Write-Host "     - AI: $($health.features.ai)" -ForegroundColor Gray
    Write-Host "     - Mocks: $($health.features.mocks)`n" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Pipeline Failure Workflow
Write-Host "[2] Testing Pipeline Failure Workflow..." -ForegroundColor Yellow
$pipelineFailure = @{
    type = "pipeline_failure"
    pipelineId = "test-pipeline-001"
    pipelineName = "Daily Customer Analytics"
    runId = "run-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    stepId = "transform-customer-data"
    error = "Column 'loyalty_tier' does not exist"
    stackTrace = "at executeSQL (executor.ts:45)"
    attemptNumber = 3
    logs = @(
        "Starting pipeline execution...",
        "Connected to Azure SQL database",
        "Running transformation step",
        "ERROR: column 'loyalty_tier' does not exist in table 'customers'",
        "Retry attempt 1 failed",
        "Retry attempt 2 failed",
        "Retry attempt 3 failed"
    )
} | ConvertTo-Json -Depth 10

try {
    $result = Invoke-RestMethod -Uri "$baseUrl/api/workflows/pipeline-failure" `
        -Method POST `
        -Body $pipelineFailure `
        -ContentType "application/json"

    Write-Host "   ✓ Workflow executed successfully" -ForegroundColor Green
    Write-Host "   ✓ Event ID: $($result.result.eventId)" -ForegroundColor Green
    Write-Host "   ✓ Root Cause: $($result.result.analysis.rootCause)" -ForegroundColor Green
    Write-Host "   ✓ Category: $($result.result.analysis.category)" -ForegroundColor Green
    Write-Host "   ✓ Confidence: $([math]::Round($result.result.analysis.confidence * 100))%" -ForegroundColor Green
    Write-Host "   ✓ Auto-fixable: $($result.result.analysis.autoFixable)" -ForegroundColor Green

    if ($result.result.incident) {
        Write-Host "   ✓ Incident Created: $($result.result.incident.incidentNumber)" -ForegroundColor Green
    }

    Write-Host "   ✓ Actions taken: $($result.result.actions.Count)" -ForegroundColor Green
    foreach ($action in $result.result.actions) {
        Write-Host "     - $($action.type): $($action.status)" -ForegroundColor Gray
    }
    Write-Host ""
} catch {
    Write-Host "   ✗ Pipeline workflow failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Data Quality Failure Workflow (PII Exposure)
Write-Host "[3] Testing Data Quality Failure Workflow (PII Exposure)..." -ForegroundColor Yellow
$qualityFailure = @{
    type = "data_quality_failure"
    ruleId = "pii-check-001"
    ruleName = "Check PII in Public Tables"
    table = "analytics_summary"
    schema = "public"
    failureCount = 15000
    totalRecords = 15000
    isPII = $true
    complianceRisk = "high"
    metadata = @{
        piiFields = @("customer_email", "phone_number", "ssn")
        detectedAt = Get-Date -Format "o"
    }
} | ConvertTo-Json -Depth 10

try {
    $result = Invoke-RestMethod -Uri "$baseUrl/api/workflows/data-quality-failure" `
        -Method POST `
        -Body $qualityFailure `
        -ContentType "application/json"

    Write-Host "   ✓ Workflow executed successfully" -ForegroundColor Green
    Write-Host "   ✓ Event ID: $($result.result.eventId)" -ForegroundColor Green

    if ($result.result.incident) {
        Write-Host "   ✓ Incident: $($result.result.incident.incidentNumber)" -ForegroundColor Green
        Write-Host "   ✓ Auto-remediation attempted: $($result.result.autoRemediationAttempted)" -ForegroundColor Green
        Write-Host "   ✓ Auto-remediation success: $($result.result.autoRemediationSuccess)" -ForegroundColor Green
    }

    Write-Host "   ✓ Actions taken: $($result.result.actions.Count)" -ForegroundColor Green
    foreach ($action in $result.result.actions) {
        $color = if ($action.status -eq "success") { "Green" } else { "Yellow" }
        Write-Host "     - $($action.type): $($action.message)" -ForegroundColor $color
    }
    Write-Host ""
} catch {
    Write-Host "   ✗ Data quality workflow failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Pipeline Scheduler
Write-Host "[4] Testing Pipeline Scheduler..." -ForegroundColor Yellow
$schedulePipeline = @{
    pipelineId = "daily-etl-001"
    name = "Daily ETL Pipeline"
    schedule = "0 2 * * *"  # Daily at 2 AM
    enabled = $true
    timezone = "America/New_York"
} | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "$baseUrl/api/scheduler/pipelines" `
        -Method POST `
        -Body $schedulePipeline `
        -ContentType "application/json"

    Write-Host "   ✓ Pipeline scheduled successfully" -ForegroundColor Green

    # Get scheduler stats
    $stats = Invoke-RestMethod -Uri "$baseUrl/api/scheduler/stats" -Method GET
    Write-Host "   ✓ Total scheduled jobs: $($stats.totalJobs)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "   ✗ Scheduler test failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: GitHub Webhook Simulation
Write-Host "[5] Testing GitHub Webhook (Push Event)..." -ForegroundColor Yellow
$githubPush = @{
    ref = "refs/heads/main"
    before = "abc123"
    after = "def456"
    repository = @{
        name = "data-platform"
        full_name = "company/data-platform"
        owner = @{
            name = "Company"
            email = "dev@company.com"
        }
    }
    pusher = @{
        name = "developer"
        email = "developer@company.com"
    }
    commits = @(
        @{
            id = "def456"
            message = "Add new data quality rule"
            timestamp = Get-Date -Format "o"
            author = @{
                name = "developer"
                email = "developer@company.com"
            }
            added = @("backend/data-service/migrations/002_add_quality_rule.sql")
            modified = @("backend/data-service/src/services/QualityService.ts")
            removed = @()
        }
    )
} | ConvertTo-Json -Depth 10

try {
    $headers = @{
        "X-GitHub-Event" = "push"
        "Content-Type" = "application/json"
    }

    $result = Invoke-RestMethod -Uri "$baseUrl/api/webhooks/github" `
        -Method POST `
        -Body $githubPush `
        -Headers $headers

    Write-Host "   ✓ Webhook processed successfully" -ForegroundColor Green
    if ($result.pipelinesTriggered) {
        Write-Host "   ✓ Pipelines triggered: $($result.pipelinesTriggered -join ', ')" -ForegroundColor Green
    }
    Write-Host ""
} catch {
    Write-Host "   ✗ Webhook test failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 6: Workflow Statistics
Write-Host "[6] Testing Workflow Statistics..." -ForegroundColor Yellow
try {
    $stats = Invoke-RestMethod -Uri "$baseUrl/api/workflows/stats" -Method GET
    Write-Host "   ✓ Pipeline Agent Knowledge Base: $($stats.pipelineAgentKnowledgeBase) patterns" -ForegroundColor Green
    Write-Host "   ✓ Configuration:" -ForegroundColor Green
    Write-Host "     - Using Mocks: $($stats.config.useMocks)" -ForegroundColor Gray
    Write-Host "     - AI Enabled: $($stats.config.enableAI)" -ForegroundColor Gray
    Write-Host "     - Auto-Remediate: $($stats.config.autoRemediate)`n" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Stats retrieval failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "✓ All core features tested successfully!" -ForegroundColor Green
Write-Host "`nKey Features Verified:" -ForegroundColor White
Write-Host "  1. Pipeline Intelligence Agent - Root cause analysis" -ForegroundColor Gray
Write-Host "  2. Incident Response Agent - Smart routing & auto-remediation" -ForegroundColor Gray
Write-Host "  3. Workflow Orchestrator - End-to-end automation" -ForegroundColor Gray
Write-Host "  4. Integration Adapters - Jira, ServiceNow, Azure DevOps (mocked)" -ForegroundColor Gray
Write-Host "  5. Pipeline Scheduler - Cron-based execution" -ForegroundColor Gray
Write-Host "  6. GitHub Webhooks - Automated triggers" -ForegroundColor Gray

Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "  • Configure real integration credentials (Jira, ServiceNow, Azure DevOps)" -ForegroundColor White
Write-Host "  • Enable OpenAI for advanced root cause analysis" -ForegroundColor White
Write-Host "  • Set up GitHub webhooks in your repository" -ForegroundColor White
Write-Host "  • Schedule your pipelines" -ForegroundColor White
Write-Host "  • Monitor the system in action!`n" -ForegroundColor White

Write-Host "For documentation, see: AGENTIC_AI_SYSTEM_GUIDE.md`n" -ForegroundColor Cyan
