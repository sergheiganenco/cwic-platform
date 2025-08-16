#!/bin/bash
echo "🏥 CWIC Platform Health Check"
echo "=============================="

services=(
  "API Gateway:http://localhost:8000/health"
  "Auth Service:http://localhost:8001/health"
  "Data Service:http://localhost:8002/health"
  "AI Service:http://localhost:8003/health"
  "Integration Service:http://localhost:8004/health"
  "Notification Service:http://localhost:8005/health"
  "Pipeline Service:http://localhost:8006/health"
)

all_healthy=true
for service in "${services[@]}"; do
  name=$(echo $service | cut -d':' -f1)
  url=$(echo $service | cut -d':' -f2-)
  printf "%-20s " "$name:"
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url")
  if [ "$status" = "200" ]; then echo "✅ Healthy"; else echo "❌ $status"; all_healthy=false; fi
done

$all_healthy || exit 1
