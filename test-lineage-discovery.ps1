# Lineage Discovery Test Script (PowerShell)
# Tests the new enhanced lineage discovery methods

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  CWIC Platform - Lineage Discovery Test" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Get data sources
Write-Host "📊 Fetching data sources..." -ForegroundColor Blue
$dataSources = Invoke-RestMethod -Uri "http://localhost:8000/api/data-sources" -Method Get

$postgresSource = $dataSources.data | Where-Object { $_.name -eq "postgres" }
$azureSource = $dataSources.data | Where-Object { $_.name -like "*Azure*" }

Write-Host "✓ PostgreSQL Data Source: $($postgresSource.id)" -ForegroundColor Green
if ($azureSource) {
    Write-Host "✓ Azure SQL Data Source: $($azureSource.id)" -ForegroundColor Green
}
Write-Host ""

# Function to test lineage discovery
function Test-LineageDiscovery {
    param(
        [string]$DataSourceId,
        [string]$DataSourceName
    )

    Write-Host "----------------------------------------" -ForegroundColor White
    Write-Host "Testing: $DataSourceName" -ForegroundColor Blue
    Write-Host "----------------------------------------" -ForegroundColor White

    # Get current lineage count
    Write-Host "Current lineage relationships:" -ForegroundColor Yellow
    docker exec b48c1096c0b9_cwic-platform-db-1 psql -U cwic_user -d cwic_platform -c @"
        SELECT
          edge_type,
          COUNT(*) as count
        FROM catalog_lineage cl
        JOIN catalog_assets ca ON ca.id = cl.from_asset_id OR ca.id = cl.to_asset_id
        WHERE ca.datasource_id = '$DataSourceId'
        GROUP BY edge_type
        ORDER BY count DESC;
"@

    Write-Host ""
    Write-Host "🔄 Triggering sync and lineage discovery..." -ForegroundColor Yellow

    # Trigger sync
    try {
        $syncResult = Invoke-RestMethod -Uri "http://localhost:8000/api/data-sources/$DataSourceId/sync" -Method Post
        Write-Host "Sync triggered successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️  Sync failed: $_" -ForegroundColor Red
        return
    }

    # Wait for sync to complete
    Write-Host "Waiting for discovery to complete..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5

    # Check logs for discovery results
    Write-Host ""
    Write-Host "📋 Discovery Results:" -ForegroundColor Blue
    docker-compose logs --tail=100 data-service 2>&1 | Select-String -Pattern "(Exact match method|FK pattern method|Semantic similarity|Cardinality analysis|Lineage discovery complete)" | Select-Object -Last 5

    Write-Host ""
    Write-Host "✓ Discovery complete!" -ForegroundColor Green
    Write-Host ""
}

# Test PostgreSQL
if ($postgresSource) {
    Test-LineageDiscovery -DataSourceId $postgresSource.id -DataSourceName "PostgreSQL (AdventureWorks)"
}

# Test Azure SQL (if accessible)
if ($azureSource) {
    Write-Host "⚠️  Azure SQL requires firewall access - skipping" -ForegroundColor Yellow
    # Test-LineageDiscovery -DataSourceId $azureSource.id -DataSourceName "Azure SQL (Feya)"
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "✓ Testing Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Summary of all lineage relationships:" -ForegroundColor Blue
docker exec b48c1096c0b9_cwic-platform-db-1 psql -U cwic_user -d cwic_platform -c @"
    SELECT
      edge_type,
      COUNT(*) as total,
      ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
    FROM catalog_lineage
    GROUP BY edge_type
    ORDER BY total DESC;
"@

Write-Host ""
Write-Host "Examples of discovered relationships (AdventureWorks):" -ForegroundColor Blue
docker exec b48c1096c0b9_cwic-platform-db-1 psql -U cwic_user -d cwic_platform -c @"
    SELECT
      ca1.table_name || '.' || (cl.metadata->'columns'->0->>'from') as from_column,
      ca2.table_name || '.' || (cl.metadata->'columns'->0->>'to') as to_column,
      cl.edge_type,
      COALESCE((cl.metadata->'columns'->0->>'similarityScore')::text, 'N/A') as similarity
    FROM catalog_lineage cl
    JOIN catalog_assets ca1 ON ca1.id = cl.from_asset_id
    JOIN catalog_assets ca2 ON ca2.id = cl.to_asset_id
    WHERE ca1.database_name = 'adventureworks'
    ORDER BY cl.edge_type, ca1.table_name
    LIMIT 15;
"@

Write-Host ""
Write-Host "📖 For more information, see: LINEAGE_DISCOVERY_STRATEGIES.md" -ForegroundColor Blue
Write-Host ""
