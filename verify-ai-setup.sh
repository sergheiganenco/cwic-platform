#!/bin/bash

# AI Assistant Real Data Setup Verification Script

echo "================================================"
echo "AI Assistant Real Data Configuration Checker"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check functions
check_service() {
    local name=$1
    local url=$2
    echo -n "Checking $name... "
    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200"; then
        echo -e "${GREEN}✓ Running${NC}"
        return 0
    else
        echo -e "${RED}✗ Not responding${NC}"
        return 1
    fi
}

check_env_var() {
    local file=$1
    local var=$2
    local expected=$3
    echo -n "  Checking $var in $file... "
    if grep -q "^$var=$expected" "$file" 2>/dev/null; then
        echo -e "${GREEN}✓ Correct${NC}"
        return 0
    else
        echo -e "${RED}✗ Not set or incorrect${NC}"
        return 1
    fi
}

echo "1. Checking Services Status"
echo "----------------------------"
check_service "Data Service" "http://localhost:3002/health"
DATA_SERVICE=$?

check_service "AI Service" "http://localhost:8003/health"
AI_SERVICE=$?

check_service "API Gateway" "http://localhost:8000/health"
API_GATEWAY=$?

check_service "Frontend" "http://localhost:5173"
FRONTEND=$?

echo ""
echo "2. Checking Backend Configuration"
echo "---------------------------------"
check_env_var "backend/ai-service/.env" "DATA_SERVICE_URL" "http://localhost:3002"
AI_CONFIG=$?

echo ""
echo "3. Checking Frontend Configuration"
echo "-----------------------------------"
check_env_var "frontend/.env" "VITE_USE_AI_BACKEND" "true"
BACKEND_ENABLED=$?

check_env_var "frontend/.env" "VITE_ENABLE_MOCK_MODE" "false"
MOCK_DISABLED=$?

echo ""
echo "4. Testing Real Data Availability"
echo "----------------------------------"
echo -n "  Testing data assets endpoint... "
ASSETS_COUNT=$(curl -s "http://localhost:3002/api/assets?limit=1" | grep -o '"data":\[' | wc -l)
if [ "$ASSETS_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Data available${NC}"
    ASSETS_OK=0
else
    echo -e "${YELLOW}⚠ No assets found (may need to run discovery)${NC}"
    ASSETS_OK=1
fi

echo -n "  Testing AI enhanced query endpoint... "
if curl -s "http://localhost:8000/api/ai/health" | grep -q "ok"; then
    echo -e "${GREEN}✓ Endpoint accessible${NC}"
    AI_ENDPOINT_OK=0
else
    echo -e "${RED}✗ Endpoint not accessible${NC}"
    AI_ENDPOINT_OK=1
fi

echo ""
echo "================================================"
echo "Summary"
echo "================================================"

TOTAL_CHECKS=9
PASSED_CHECKS=0

[ $DATA_SERVICE -eq 0 ] && ((PASSED_CHECKS++))
[ $AI_SERVICE -eq 0 ] && ((PASSED_CHECKS++))
[ $API_GATEWAY -eq 0 ] && ((PASSED_CHECKS++))
[ $FRONTEND -eq 0 ] && ((PASSED_CHECKS++))
[ $AI_CONFIG -eq 0 ] && ((PASSED_CHECKS++))
[ $BACKEND_ENABLED -eq 0 ] && ((PASSED_CHECKS++))
[ $MOCK_DISABLED -eq 0 ] && ((PASSED_CHECKS++))
[ $ASSETS_OK -eq 0 ] && ((PASSED_CHECKS++))
[ $AI_ENDPOINT_OK -eq 0 ] && ((PASSED_CHECKS++))

echo "Checks passed: $PASSED_CHECKS/$TOTAL_CHECKS"
echo ""

if [ $PASSED_CHECKS -eq $TOTAL_CHECKS ]; then
    echo -e "${GREEN}✓ All checks passed! AI Assistant is ready to use real data.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Open http://localhost:5173/ai-assistant"
    echo "  2. Ask: 'How many assets do we have?'"
    echo "  3. You should see real numbers from your catalog"
    exit 0
else
    echo -e "${YELLOW}⚠ Some checks failed. Please review the issues above.${NC}"
    echo ""
    echo "Common fixes:"
    if [ $DATA_SERVICE -ne 0 ]; then
        echo "  • Start Data Service: cd backend/data-service && npm run dev"
    fi
    if [ $AI_SERVICE -ne 0 ]; then
        echo "  • Start AI Service: cd backend/ai-service && npm run dev"
    fi
    if [ $API_GATEWAY -ne 0 ]; then
        echo "  • Start API Gateway: cd backend/api-gateway && npm run dev"
    fi
    if [ $FRONTEND -ne 0 ]; then
        echo "  • Start Frontend: cd frontend && npm run dev"
    fi
    if [ $AI_CONFIG -ne 0 ] || [ $BACKEND_ENABLED -ne 0 ] || [ $MOCK_DISABLED -ne 0 ]; then
        echo "  • Check environment files (.env) have correct values"
        echo "  • Restart services after changing .env files"
    fi
    exit 1
fi
