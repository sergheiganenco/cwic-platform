#!/bin/bash

# Verification script for Visual Rule Builder fix
# This script checks if the data sources have catalog data

echo "=================================================="
echo "Visual Rule Builder Fix Verification"
echo "=================================================="
echo ""

# Check if services are running
echo "1. Checking if services are running..."
echo ""

DATA_SERVICE=$(curl -s http://localhost:3002/health 2>&1)
if [[ $DATA_SERVICE == *"ok"* ]] || [[ $DATA_SERVICE == *"healthy"* ]]; then
    echo "✅ Data Service is running (port 3002)"
else
    echo "❌ Data Service is NOT running (port 3002)"
    echo "   Please start services with: docker-compose up -d"
    exit 1
fi

API_GATEWAY=$(curl -s http://localhost:8000/health 2>&1)
if [[ $API_GATEWAY == *"ok"* ]] || [[ $API_GATEWAY == *"healthy"* ]]; then
    echo "✅ API Gateway is running (port 8000)"
else
    echo "❌ API Gateway is NOT running (port 8000)"
fi

echo ""
echo "2. Fetching all data sources..."
echo ""

# Get data sources
DATA_SOURCES=$(curl -s http://localhost:3002/api/data-sources)

# Parse and display data sources with asset counts
echo "Data Sources and their catalog status:"
echo "--------------------------------------"

# Test each data source
echo "$DATA_SOURCES" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | while read -r DS_ID; do
    DS_NAME=$(echo "$DATA_SOURCES" | grep -o "\"id\":\"$DS_ID\"[^}]*\"name\":\"[^\"]*\"" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
    DS_TYPE=$(echo "$DATA_SOURCES" | grep -o "\"id\":\"$DS_ID\"[^}]*\"type\":\"[^\"]*\"" | grep -o '"type":"[^"]*"' | cut -d'"' -f4)

    # Get asset count
    ASSETS=$(curl -s "http://localhost:3002/api/assets?dataSourceId=$DS_ID&limit=1")
    ASSET_COUNT=$(echo "$ASSETS" | grep -o '"total":[0-9]*' | cut -d':' -f2)

    if [ -z "$ASSET_COUNT" ]; then
        ASSET_COUNT=0
    fi

    STATUS="❌ NOT SCANNED"
    if [ "$ASSET_COUNT" -gt 0 ]; then
        STATUS="✅ $ASSET_COUNT tables"
    fi

    echo ""
    echo "📊 $DS_NAME ($DS_TYPE)"
    echo "   ID: $DS_ID"
    echo "   Status: $STATUS"

    # Show recommendation
    if [ "$ASSET_COUNT" -eq 0 ]; then
        echo "   ⚠️  This data source needs to be scanned before creating rules"
        echo "   💡 Go to Data Catalog → Select this source → Click 'Scan Data Source'"
    fi
done

echo ""
echo "=================================================="
echo "Verification Complete"
echo "=================================================="
echo ""
echo "Next Steps:"
echo "1. For any data source showing '❌ NOT SCANNED':"
echo "   - Go to http://localhost:5173/data-catalog"
echo "   - Select the data source"
echo "   - Click 'Scan Data Source' button"
echo "   - Wait for scan to complete"
echo ""
echo "2. Then you can create rules for that data source:"
echo "   - Go to http://localhost:5173/data-quality"
echo "   - Select the scanned data source"
echo "   - Click 'Rules' tab → '+ Create Rule'"
echo "   - Visual Rule Builder will now show tables!"
echo ""
