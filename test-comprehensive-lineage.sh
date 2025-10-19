#!/bin/bash

# Comprehensive Lineage Discovery Test Script
# Tests all lineage relationships for accuracy and completeness

echo "============================================"
echo "  CWIC Platform - Comprehensive Lineage Test"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Database container
DB_CONTAINER="b48c1096c0b9_cwic-platform-db-1"

# Data source ID for Azure SQL (Feya)
DS_ID="af910adf-c7c1-4573-9eec-93f05f0970b7"

echo -e "${BLUE}📊 Testing Data Source: Azure SQL (Feya)${NC}"
echo -e "${BLUE}Data Source ID: $DS_ID${NC}"
echo ""

# Function to run SQL query
run_query() {
    docker exec $DB_CONTAINER psql -U cwic_user -d cwic_platform -t -A -c "$1" 2>/dev/null
}

# Function to check a specific relationship
check_relationship() {
    local from_table=$1
    local from_column=$2
    local to_table=$3
    local to_column=$4
    local expected_confidence=$5

    result=$(run_query "
        SELECT COUNT(*)
        FROM catalog_lineage cl
        JOIN catalog_assets ca1 ON ca1.id = cl.from_asset_id
        JOIN catalog_assets ca2 ON ca2.id = cl.to_asset_id
        WHERE ca1.table_name = '$from_table'
          AND ca2.table_name = '$to_table'
          AND cl.metadata->'columns'->0->>'from' = '$from_column'
          AND cl.metadata->'columns'->0->>'to' = '$to_column'
          AND ca1.datasource_id = '$DS_ID';
    ")

    if [ "$result" = "1" ]; then
        echo -e "${GREEN}✓${NC} $from_table.$from_column → $to_table.$to_column"
    else
        echo -e "${RED}✗${NC} $from_table.$from_column → $to_table.$to_column (NOT FOUND)"
        return 1
    fi
}

echo "============================================"
echo -e "${BLUE}1. Overall Statistics${NC}"
echo "============================================"

# Get statistics
total_tables=$(run_query "
    SELECT COUNT(DISTINCT ca.id)
    FROM catalog_assets ca
    WHERE ca.datasource_id = '$DS_ID'
      AND ca.asset_type = 'table';
")

tables_with_lineage=$(run_query "
    SELECT COUNT(DISTINCT asset_id)
    FROM (
        SELECT from_asset_id as asset_id FROM catalog_lineage cl
        JOIN catalog_assets ca ON ca.id = cl.from_asset_id
        WHERE ca.datasource_id = '$DS_ID'
        UNION
        SELECT to_asset_id as asset_id FROM catalog_lineage cl
        JOIN catalog_assets ca ON ca.id = cl.to_asset_id
        WHERE ca.datasource_id = '$DS_ID'
    ) t;
")

total_relationships=$(run_query "
    SELECT COUNT(*)
    FROM catalog_lineage cl
    JOIN catalog_assets ca ON ca.id = cl.from_asset_id
    WHERE ca.datasource_id = '$DS_ID';
")

total_views=$(run_query "
    SELECT COUNT(DISTINCT ca.id)
    FROM catalog_assets ca
    WHERE ca.datasource_id = '$DS_ID'
      AND ca.asset_type = 'view'
      AND ca.table_name NOT LIKE 'sys%'
      AND ca.table_name NOT LIKE 'dm_%';
")

views_with_lineage=$(run_query "
    SELECT COUNT(DISTINCT ca.id)
    FROM catalog_assets ca
    JOIN catalog_lineage cl ON cl.from_asset_id = ca.id
    WHERE ca.datasource_id = '$DS_ID'
      AND ca.asset_type = 'view';
")

echo "Total Tables: $total_tables"
echo "Tables with Lineage: $tables_with_lineage"
echo "Total Views: $total_views"
echo "Views with Lineage: $views_with_lineage"
echo "Total Relationships: $total_relationships"
echo "Table Coverage: $(( tables_with_lineage * 100 / total_tables ))%"
echo ""

echo "============================================"
echo -e "${BLUE}2. Expected Relationships Test${NC}"
echo "============================================"

# Test critical relationships
failed=0

echo -e "${YELLOW}Testing TblWish relationships:${NC}"
check_relationship "Notifications" "WishID" "TblWish" "Id" "high" || ((failed++))
check_relationship "TblWish" "CreatedByUserId" "User" "Id" "medium" || ((failed++))
check_relationship "TblWish" "PickedByUserId" "User" "Id" "medium" || ((failed++))

echo ""
echo -e "${YELLOW}Testing User relationships:${NC}"
check_relationship "Notifications" "UserId" "User" "Id" "high" || ((failed++))
check_relationship "UserRoles" "UserId" "User" "Id" "high" || ((failed++))
check_relationship "UserLogins" "UserId" "User" "Id" "high" || ((failed++))
check_relationship "UserClaims" "UserId" "User" "Id" "high" || ((failed++))
check_relationship "UserTokens" "UserId" "User" "Id" "high" || ((failed++))

echo ""
echo -e "${YELLOW}Testing Role relationships:${NC}"
check_relationship "UserRoles" "RoleId" "Role" "Id" "high" || ((failed++))
check_relationship "RoleClaims" "RoleId" "Role" "Id" "high" || ((failed++))

echo ""
echo -e "${YELLOW}Testing View lineage:${NC}"
# Views don't have column-level lineage, just table-level
view_result=$(run_query "
    SELECT COUNT(*)
    FROM catalog_lineage cl
    JOIN catalog_assets ca1 ON ca1.id = cl.from_asset_id
    JOIN catalog_assets ca2 ON ca2.id = cl.to_asset_id
    WHERE ca1.table_name = 'Wish' AND ca1.asset_type = 'view'
      AND ca2.table_name = 'TblWish' AND ca2.asset_type = 'table'
      AND cl.edge_type = 'view_source'
      AND ca1.datasource_id = '$DS_ID';
")
if [ "$view_result" = "1" ]; then
    echo -e "${GREEN}✓${NC} Wish view → TblWish table"
else
    echo -e "${RED}✗${NC} Wish view → TblWish table (NOT FOUND)"
    ((failed++))
fi

echo ""
echo "============================================"
echo -e "${BLUE}3. Tables Without Lineage${NC}"
echo "============================================"

tables_without_lineage=$(run_query "
    SELECT ca.table_name
    FROM catalog_assets ca
    WHERE ca.datasource_id = '$DS_ID'
      AND ca.asset_type = 'table'
      AND ca.id NOT IN (
        SELECT from_asset_id FROM catalog_lineage cl
        JOIN catalog_assets ca2 ON ca2.id = cl.from_asset_id
        WHERE ca2.datasource_id = '$DS_ID'
        UNION
        SELECT to_asset_id FROM catalog_lineage cl
        JOIN catalog_assets ca2 ON ca2.id = cl.to_asset_id
        WHERE ca2.datasource_id = '$DS_ID'
      );
")

if [ -z "$tables_without_lineage" ]; then
    echo -e "${GREEN}✓ All tables have lineage relationships${NC}"
else
    echo -e "${YELLOW}Tables without relationships:${NC}"
    echo "$tables_without_lineage" | while read table; do
        if [[ "$table" == *"__EFMigrations"* ]] || [[ "$table" == *"sysdiagram"* ]]; then
            echo -e "  ${BLUE}ℹ${NC} $table (system table - expected)"
        else
            echo -e "  ${RED}⚠${NC} $table"
        fi
    done
fi

echo ""
echo "============================================"
echo -e "${BLUE}4. Relationship Types Distribution${NC}"
echo "============================================"

run_query "
    SELECT
        cl.edge_type,
        cl.metadata->>'confidence' as confidence,
        COUNT(*) as count
    FROM catalog_lineage cl
    JOIN catalog_assets ca ON ca.id = cl.from_asset_id
    WHERE ca.datasource_id = '$DS_ID'
    GROUP BY cl.edge_type, cl.metadata->>'confidence'
    ORDER BY count DESC;
" | column -t -s'|'

echo ""
echo "============================================"
echo -e "${BLUE}5. Sample Discovered Relationships${NC}"
echo "============================================"

echo "First 10 relationships:"
run_query "
    SELECT
        ca1.table_name || '.' || (cl.metadata->'columns'->0->>'from') ||
        ' → ' ||
        ca2.table_name || '.' || (cl.metadata->'columns'->0->>'to') ||
        ' (' || cl.metadata->>'confidence' || ')'
    FROM catalog_lineage cl
    JOIN catalog_assets ca1 ON ca1.id = cl.from_asset_id
    JOIN catalog_assets ca2 ON ca2.id = cl.to_asset_id
    WHERE ca1.datasource_id = '$DS_ID'
    ORDER BY cl.created_at DESC
    LIMIT 10;
" | while read line; do
    echo "  • $line"
done

echo ""
echo "============================================"
echo -e "${BLUE}Test Summary${NC}"
echo "============================================"

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✓ All expected relationships found!${NC}"
    echo -e "${GREEN}✓ Lineage discovery is working correctly${NC}"
    exit 0
else
    echo -e "${RED}✗ $failed expected relationships are missing${NC}"
    echo -e "${YELLOW}Run the enhanced discovery to fix:${NC}"
    echo "  curl -X POST http://localhost:8000/api/catalog/lineage/discover-enhanced/$DS_ID"
    exit 1
fi