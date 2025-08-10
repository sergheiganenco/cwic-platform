#!/bin/bash

echo "🚀 Starting CWIC Development Environment..."

# Start infrastructure services
docker-compose up -d postgres redis minio elasticsearch kafka zookeeper

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 15

# Start backend services
echo "🔧 Starting backend services..."
docker-compose up -d auth-service data-service ai-service pipeline-service api-gateway

# Start frontend
echo "🎨 Starting frontend..."
cd frontend && npm run dev &

echo "✅ Development environment started!"
echo "Frontend: http://localhost:3000"
echo "API Gateway: http://localhost:8000"
echo "MinIO Console: http://localhost:9001"