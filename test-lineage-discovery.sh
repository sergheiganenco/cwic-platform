#!/bin/bash

# Lineage Discovery Test Script
# Tests the new enhanced lineage discovery methods

echo "============================================"
echo "  CWIC Platform - Lineage Discovery Test"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get data sources
echo -e "${BLUE}📊 Fetching data sources...${NC}"
DATA_SOURCES=$(curl -s "http://localhost:8000/api/data-sources" | python -m json.tool)

# Extract IDs and names
POSTGRES_ID=$(echo "$DATA_SOURCES" | grep -A 50 "postgres" | grep '"id"' | head -1 | cut -d'"' -f4)
AZURE_ID=$(echo "$DATA_SOURCES" | grep -A 50 "Azure Feya" | grep '"id"' | head -1 | cut -d'"' -f4)

echo -e "${GREEN}✓ PostgreSQL Data Source: $POSTGRES_ID${NC}"
echo -e "${GREEN}✓ Azure SQL Data Source: $AZURE_ID${NC}"
echo ""

# Function to test lineage discovery
test_discovery() {
    local DS_ID=$1
    local DS_NAME=$2

    echo "----------------------------------------"
    echo -e "${BLUE}Testing: $DS_NAME${NC}"
    echo "----------------------------------------"

    # Get current lineage count
    echo "Current lineage relationships:"
    docker exec b48c1096c0b9_cwic-platform-db-1 psql -U cwic_user -d cwic_platform -c "
        SELECT
          edge_type,
          COUNT(*) as count
        FROM catalog_lineage cl
        JOIN catalog_assets ca ON ca.id = cl.from_asset_id OR ca.id = cl.to_asset_id
        WHERE ca.datasource_id = '$DS_ID'
        GROUP BY edge_type
        ORDER BY count DESC;
    " 2>/dev/null

    echo ""
    echo -e "${YELLOW}🔄 Triggering sync and lineage discovery...${NC}"

    # Trigger sync
    SYNC_RESULT=$(curl -s -X POST "http://localhost:8000/api/data-sources/$DS_ID/sync")

    # Wait for sync to complete
    sleep 5

    # Check logs for discovery results
    echo ""
    echo -e "${BLUE}📋 Discovery Results:${NC}"
    docker-compose logs --tail=100 data-service 2>&1 | \
        grep -E "(Exact match method|FK pattern method|Semantic similarity|Cardinality analysis|Lineage discovery complete)" | \
        tail -5

    echo ""
    echo -e "${GREEN}✓ Discovery complete!${NC}"
    echo ""
}

# Test PostgreSQL
if [ ! -z "$POSTGRES_ID" ]; then
    test_discovery "$POSTGRES_ID" "PostgreSQL (AdventureWorks)"
fi

# Test Azure SQL (if accessible)
if [ ! -z "$AZURE_ID" ]; then
    echo "⚠️  Azure SQL requires firewall access - skipping"
    # test_discovery "$AZURE_ID" "Azure SQL (Feya)"
fi

echo "============================================"
echo -e "${GREEN}✓ Testing Complete!${NC}"
echo "============================================"
echo ""
echo "Summary of all lineage relationships:"
docker exec b48c1096c0b9_cwic-platform-db-1 psql -U cwic_user -d cwic_platform -c "
    SELECT
      edge_type,
      COUNT(*) as total,
      ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
    FROM catalog_lineage
    GROUP BY edge_type
    ORDER BY total DESC;
" 2>/dev/null

echo ""
echo "Examples of discovered relationships:"
docker exec b48c1096c0b9_cwic-platform-db-1 psql -U cwic_user -d cwic_platform -c "
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
" 2>/dev/null

echo ""
echo -e "${BLUE}📖 For more information, see: LINEAGE_DISCOVERY_STRATEGIES.md${NC}"
