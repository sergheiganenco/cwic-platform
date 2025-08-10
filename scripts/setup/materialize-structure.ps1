# materialize-structure.ps1
# Run from repo root: powershell -ExecutionPolicy Bypass -File .\scripts\setup\materialize-structure.ps1

$ErrorActionPreference = "Stop"

function Ensure-Dir {
  param([string]$Path)
  New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

function Ensure-File {
  param([string]$Path, [string]$Content = $null)
  if (-not (Test-Path $Path)) {
    New-Item -ItemType File -Force -Path $Path | Out-Null
  }
  if ($Content -ne $null) {
    $Content | Out-File -FilePath $Path -Encoding utf8 -Force
  }
}

Write-Host "=== Creating database folders & files ==="

# Database folders
Ensure-Dir ".\database\migrations"
Ensure-Dir ".\database\seeds"
Ensure-Dir ".\database\schemas"
Ensure-Dir ".\database\scripts"

# Database migration files
Ensure-File ".\database\migrations\001_initial_schema.sql" "-- -- initial schema"
Ensure-File ".\database\migrations\002_add_data_sources.sql" "-- -- add data sources"
Ensure-File ".\database\migrations\003_add_quality_rules.sql" "-- -- add quality rules"
Ensure-File ".\database\migrations\004_add_pipelines.sql" "-- -- add pipelines"

# Seed files
Ensure-File ".\database\seeds\users.sql" "-- -- seed users"
Ensure-File ".\database\seeds\data_sources.sql" "-- -- seed data sources"
Ensure-File ".\database\seeds\quality_rules.sql" "-- -- seed quality rules"

# Optional helper to create multiple DBs in Postgres container (used by docker-compose)
Ensure-File ".\database\scripts\create-multiple-databases.sh" @'
#!/bin/bash
set -e
if [ -n "$POSTGRES_MULTIPLE_DATABASES" ]; then
  echo "Creating multiple databases: $POSTGRES_MULTIPLE_DATABASES"
  for db in $(echo $POSTGRES_MULTIPLE_DATABASES | tr ',' ' '); do
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
      CREATE DATABASE "$db";
EOSQL
  done
fi
'@

Write-Host "=== Creating infrastructure folders ==="

# Infrastructure base
Ensure-Dir ".\infrastructure"
# Terraform
Ensure-Dir ".\infrastructure\terraform\environments\dev"
Ensure-Dir ".\infrastructure\terraform\environments\staging"
Ensure-Dir ".\infrastructure\terraform\environments\production"
Ensure-Dir ".\infrastructure\terraform\modules\networking"
Ensure-Dir ".\infrastructure\terraform\modules\compute"
Ensure-Dir ".\infrastructure\terraform\modules\storage"
Ensure-Dir ".\infrastructure\terraform\modules\database"
Ensure-Dir ".\infrastructure\terraform\modules\monitoring"

Ensure-File ".\infrastructure\terraform\main.tf" @'
# terraform main.tf (placeholder)
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.100"
    }
  }
}
provider "azurerm" { features {} }
'@

Ensure-File ".\infrastructure\terraform\variables.tf" "# variables placeholder"
Ensure-File ".\infrastructure\terraform\outputs.tf" "# outputs placeholder"
Ensure-File ".\infrastructure\terraform\terraform.tfvars.example" "# example tfvars"

# Kubernetes
Ensure-Dir ".\infrastructure\kubernetes\namespaces"
Ensure-Dir ".\infrastructure\kubernetes\deployments"
Ensure-Dir ".\infrastructure\kubernetes\services"
Ensure-Dir ".\infrastructure\kubernetes\ingress"
Ensure-Dir ".\infrastructure\kubernetes\configmaps"
Ensure-Dir ".\infrastructure\kubernetes\secrets"
Ensure-Dir ".\infrastructure\kubernetes\monitoring"

# Helm
Ensure-Dir ".\infrastructure\helm-charts\cwic-platform\templates"
Ensure-File ".\infrastructure\helm-charts\cwic-platform\Chart.yaml" @'
apiVersion: v2
name: cwic-platform
version: 0.1.0
type: application
'@
Ensure-File ".\infrastructure\helm-charts\cwic-platform\values.yaml" "# values placeholder"
Ensure-Dir ".\infrastructure\helm-charts\dependencies"

# Docker compose directory
Ensure-Dir ".\infrastructure\docker-compose"
Ensure-File ".\infrastructure\docker-compose\docker-compose.dev.yml" ""
Ensure-File ".\infrastructure\docker-compose\docker-compose.staging.yml" ""
Ensure-File ".\infrastructure\docker-compose\docker-compose.prod.yml" ""
Ensure-File ".\infrastructure\docker-compose\docker-compose.override.yml" ""

Write-Host "=== Creating top-level docker-compose.yml if missing (with your stack) ==="
$composePath = ".\docker-compose.yml"
if (-not (Test-Path $composePath)) {
  @'
version: "3.8"
services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports: ["3000:3000"]
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - VITE_API_URL=http://localhost:8000
      - VITE_WS_URL=ws://localhost:8000
    depends_on: [api-gateway]

  api-gateway:
    build:
      context: ./backend/api-gateway
    ports: ["8000:8000"]
    volumes:
      - ./backend/api-gateway:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - PORT=8000
      - AUTH_SERVICE_URL=http://auth-service:3001
      - DATA_SERVICE_URL=http://data-service:3002
      - AI_SERVICE_URL=http://ai-service:3003
      - PIPELINE_SERVICE_URL=http://pipeline-service:3004
    depends_on: [auth-service, data-service, ai-service, pipeline-service]

  auth-service:
    build:
      context: ./backend/auth-service
    ports: ["3001:3001"]
    environment:
      - NODE_ENV=development
      - PORT=3001
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/cwic_auth
      - JWT_SECRET=your-super-secret-jwt-key
      - JWT_EXPIRES_IN=24h
    depends_on: [postgres, redis]

  data-service:
    build:
      context: ./backend/data-service
    ports: ["3002:3002"]
    environment:
      - NODE_ENV=development
      - PORT=3002
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/cwic_data
      - REDIS_URL=redis://redis:6379
    depends_on: [postgres, redis]

  ai-service:
    build:
      context: ./backend/ai-service
    ports: ["3003:3003"]
    environment:
      - NODE_ENV=development
      - PORT=3003
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - AZURE_OPENAI_ENDPOINT=${AZURE_OPENAI_ENDPOINT}
      - AZURE_OPENAI_API_KEY=${AZURE_OPENAI_API_KEY}
    depends_on: [redis]

  pipeline-service:
    build:
      context: ./backend/pipeline-service
    ports: ["3004:3004"]
    environment:
      - NODE_ENV=development
      - PORT=3004
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/cwic_pipelines
      - GITHUB_TOKEN=${GITHUB_TOKEN}
      - AZURE_DEVOPS_TOKEN=${AZURE_DEVOPS_TOKEN}
    depends_on: [postgres]

  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    ports: ["5432:5432"]
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_MULTIPLE_DATABASES=cwic_auth,cwic_data,cwic_pipelines,cwic_notifications
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/scripts/create-multiple-databases.sh:/docker-entrypoint-initdb.d/create-multiple-databases.sh
      - ./database/migrations:/docker-entrypoint-initdb.d/migrations

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports: ["6379:6379"]
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  minio:
    image: minio/minio:latest
    restart: unless-stopped
    ports: ["9000:9000", "9001:9001"]
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin123
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.9.0
    restart: unless-stopped
    ports: ["9200:9200"]
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - ES_JAVA_OPTS=-Xms512m -Xmx512m
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    restart: unless-stopped
    ports: ["2181:2181"]
    environment:
      - ZOOKEEPER_CLIENT_PORT=2181
      - ZOOKEEPER_TICK_TIME=2000

  kafka:
    image: confluentinc/cp-kafka:latest
    restart: unless-stopped
    ports: ["9092:9092"]
    environment:
      - KAFKA_BROKER_ID=1
      - KAFKA_ZOOKEEPER_CONNECT=zookeeper:2181
      - KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092
      - KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1
    depends_on: [zookeeper]

volumes:
  postgres_data:
  redis_data:
  minio_data:
  elasticsearch_data:
'@ | Out-File -FilePath $composePath -Encoding utf8 -Force
} else {
  Write-Host "docker-compose.yml already exists - leaving as is."
}

Write-Host "=== VS Code workspace config ==="
Ensure-Dir ".\.vscode"

Ensure-File ".\.vscode\settings.json" @'
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "eslint.workingDirectories": [
    "./frontend",
    "./backend/auth-service",
    "./backend/data-service",
    "./backend/ai-service",
    "./backend/pipeline-service"
  ],
  "files.associations": {
    "*.env.*": "dotenv"
  },
  "emmet.includeLanguages": {
    "javascript": "javascriptreact",
    "typescript": "typescriptreact"
  },
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  },
  "tailwindCSS.experimental.classRegex": [
    ["clsx\\(([^)]*)\\)", "(?:'|\\\"|`)([^']*)(?:'|\\\"|`)"],
    ["classnames\\(([^)]*)\\)", "(?:'|\\\"|`)([^']*)(?:'|\\\"|`)"],
    ["cn\\(([^)]*)\\)", "(?:'|\\\"|`)([^']*)(?:'|\\\"|`)"]
  ]
}
'@

Ensure-File ".\.vscode\extensions.json" @'
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-python.python",
    "ms-vscode.vscode-docker",
    "hashicorp.terraform",
    "ms-kubernetes-tools.vscode-kubernetes-tools",
    "GitHub.copilot",
    "ms-vscode.vscode-thunder-client",
    "humao.rest-client",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense"
  ]
}
'@

Ensure-File ".\.vscode\launch.json" @'
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Frontend",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}/frontend",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"]
    },
    {
      "name": "Debug Auth Service",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/backend/auth-service/src/app.ts",
      "cwd": "${workspaceFolder}/backend/auth-service",
      "runtimeArgs": ["--loader", "ts-node/esm"],
      "env": { "NODE_ENV": "development" }
    },
    {
      "name": "Debug Data Service",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/backend/data-service/src/app.ts",
      "cwd": "${workspaceFolder}/backend/data-service",
      "runtimeArgs": ["--loader", "ts-node/esm"],
      "env": { "NODE_ENV": "development" }
    }
  ]
}
'@

Ensure-File ".\.vscode\tasks.json" @'
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start Development Environment",
      "type": "shell",
      "command": "docker-compose up -d",
      "group": "build",
      "presentation": { "echo": true, "reveal": "always", "panel": "shared" }
    },
    {
      "label": "Stop Development Environment",
      "type": "shell",
      "command": "docker-compose down",
      "group": "build"
    },
    {
      "label": "Build Frontend",
      "type": "shell",
      "command": "npm run build",
      "group": "build",
      "options": { "cwd": "${workspaceFolder}/frontend" }
    },
    {
      "label": "Test Frontend",
      "type": "shell",
      "command": "npm test",
      "group": "test",
      "options": { "cwd": "${workspaceFolder}/frontend" }
    },
    {
      "label": "Lint All",
      "type": "shell",
      "command": "./scripts/development/lint.sh",
      "group": "build"
    }
  ]
}
'@

Write-Host "✅ Done. Database files, infrastructure folders, Docker Compose placeholders, and VS Code configs are in place."
Write-Host "Next: fill your SQL files, compose files as needed, then run:  docker-compose up -d"
