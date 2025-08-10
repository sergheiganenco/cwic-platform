#!/usr/bin/env bash
set -euo pipefail

log() { printf "\n\033[1;34m%s\033[0m\n" "➡ $*"; }
ok()  { printf "\033[1;32m%s\033[0m\n" "✅ $*"; }
warn(){ printf "\033[1;33m%s\033[0m\n" "⚠ $*"; }
err() { printf "\033[1;31m%s\033[0m\n" "✖ $*"; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "🚀 Initializing CWIC Platform..."

# 0) Ensure .env files exist
if [[ -f ".env.example" && ! -f ".env" ]]; then cp .env.example .env || true; fi
if [[ -f "frontend/.env.example" && ! -f "frontend/.env" ]]; then cp frontend/.env.example frontend/.env || true; fi

# 1) Frontend deps with pinned versions
if [[ -d "frontend" ]]; then
  log "Installing frontend dependencies with pinned ESLint/@typescript-eslint versions…"
  pushd frontend >/dev/null

  # Remove accidental meta package if present
  npm uninstall typescript-eslint >/dev/null 2>&1 || true

  # Force compatible versions directly in package.json (requires npm v8+)
  npm pkg set devDependencies.eslint="^8.57.0" \
               devDependencies.@typescript-eslint/eslint-plugin="^6.21.0" \
               devDependencies.@typescript-eslint/parser="^6.21.0"

  # Clean install
  rm -rf node_modules package-lock.json
  npm install

  ok "Frontend dependencies installed."
  popd >/dev/null
else
  warn "frontend/ not found. Skipping frontend install."
fi

# 2) Backend services (only the ones that exist)
log "Installing backend service dependencies (only those present)…"
SERVICES=(auth-service data-service ai-service pipeline-service)
for svc in "${SERVICES[@]}"; do
  if [[ -d "backend/$svc" ]]; then
    log "→ $svc"
    pushd "backend/$svc" >/dev/null
    rm -rf node_modules package-lock.json
    npm install
    popd >/dev/null
  else
    warn "backend/$svc not found. Skipping."
  fi
done
ok "Backend dependency step completed."

# 3) Optional: bring up DB/cache infra if Docker is available
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    if command -v docker-compose >/dev/null 2>&1; then
      DC="docker-compose"
    else
      DC="docker compose"
    fi
    log "Starting postgres + redis with $DC (if defined in compose)…"
    $DC up -d postgres redis || warn "Could not start postgres/redis (check compose file or Docker Desktop)."
    # Run DB setup script if present
    if [[ -x "scripts/setup/setup-database.sh" ]]; then
      log "Running database setup script…"
      ./scripts/setup/setup-database.sh || warn "Database setup script failed or missing prerequisites."
    else
      warn "scripts/setup/setup-database.sh not found; skipping DB init."
    fi
  else
    warn "Docker is installed but not running. Skipping DB bring-up."
  fi
else
  warn "Docker not found. Skipping DB bring-up."
fi

# 4) Optional: build images (safe to skip if Docker not running)
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  if command -v docker-compose >/dev/null 2>&1; then
    DC="docker-compose"
  else
    DC="docker compose"
  fi
  log "Building docker images (optional)…"
  $DC build || warn "Docker build failed (this is optional for now)."
else
  warn "Skipping docker image build."
fi

ok "CWIC Platform initialized successfully!"
echo "--> Start dev environment: npm run dev (from repo root, in Git Bash)"
