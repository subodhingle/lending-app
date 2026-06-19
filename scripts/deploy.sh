#!/usr/bin/env bash
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[deploy]${NC} $1" >&2; }
success() { echo -e "${GREEN}[✓]${NC} $1" >&2; }
warn() { echo -e "${YELLOW}[!]${NC} $1" >&2; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; exit 1; }

retry() {
  local n=1
  local max=5
  local delay=5
  while true; do
    if "$@"; then
      break
    else
      if (( n < max )); then
        ((n++))
        warn "Command failed. Retrying ($n/$max) in ${delay}s..."
        sleep $delay
      else
        error "Command failed permanently after $n attempts."
      fi
    fi
  done
}

NETWORK="testnet"
RPC_URL="https://soroban-testnet.stellar.org"
KEY_NAME="deployer"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

log "Project root: $PROJECT_ROOT"

# ── Step 1: Deployer keypair ──────────────────────────────────────────────────
log "Step 1: Setting up deployer keypair..."
if stellar keys address "$KEY_NAME" &>/dev/null 2>&1; then
  warn "Key '$KEY_NAME' already exists, reusing it."
  EXISTING_ADDR=$(stellar keys address "$KEY_NAME")
  curl -s "https://friendbot.stellar.org?addr=${EXISTING_ADDR}" > /dev/null && true
else
  retry stellar keys generate "$KEY_NAME" --network "$NETWORK" --fund
fi
DEPLOYER_ADDRESS=$(stellar keys address "$KEY_NAME")
success "Deployer: $DEPLOYER_ADDRESS"

# ── Step 2: Native XLM SAC address ───────────────────────────────────────────
log "Step 2: Resolving native XLM Stellar Asset Contract..."
COLLATERAL_TOKEN_ID=$(retry stellar contract id asset --asset native --network "$NETWORK" 2>&1 | grep -oE 'C[A-Z2-7]{55}' | head -n 1)
success "Native XLM SAC: $COLLATERAL_TOKEN_ID"

# ── Step 3: Build contracts ───────────────────────────────────────────────────
log "Step 3: Building contracts..."
(cd "$PROJECT_ROOT" && stellar contract build)
success "Contracts built."

WASM_DIR="$PROJECT_ROOT/target/wasm32v1-none/release"

# ── Step 4: Deploy debt_token ─────────────────────────────────────────────────
log "Step 4: Deploying debt_token..."
DEBT_TOKEN_ID=$(retry stellar contract deploy \
  --wasm "$WASM_DIR/debt_token.wasm" \
  --source "$KEY_NAME" \
  --network "$NETWORK" \
  2>&1 | grep -oE 'C[A-Z2-7]{55}' | head -n 1)
success "debt_token: $DEBT_TOKEN_ID"

# ── Step 5: Initialize debt_token ────────────────────────────────────────────
log "Step 5: Initializing debt_token..."
retry stellar contract invoke \
  --id "$DEBT_TOKEN_ID" \
  --source "$KEY_NAME" \
  --network "$NETWORK" \
  -- initialize \
  --admin "$DEPLOYER_ADDRESS" \
  --name "Debt Token" \
  --symbol "dTOKEN" \
  --decimals 7
success "debt_token initialized."

# ── Step 6: Deploy lending_pool ───────────────────────────────────────────────
log "Step 6: Deploying lending_pool..."
LENDING_POOL_ID=$(retry stellar contract deploy \
  --wasm "$WASM_DIR/lending_pool.wasm" \
  --source "$KEY_NAME" \
  --network "$NETWORK" \
  2>&1 | grep -oE 'C[A-Z2-7]{55}' | head -n 1)
success "lending_pool: $LENDING_POOL_ID"

# ── Step 7: Initialize lending_pool ──────────────────────────────────────────
log "Step 7: Initializing lending_pool (collateral = native XLM)..."
retry stellar contract invoke \
  --id "$LENDING_POOL_ID" \
  --source "$KEY_NAME" \
  --network "$NETWORK" \
  -- initialize \
  --admin "$DEPLOYER_ADDRESS" \
  --collateral_token "$COLLATERAL_TOKEN_ID" \
  --debt_token "$DEBT_TOKEN_ID" \
  --collateral_ratio 150 \
  --liquidation_threshold 120 \
  --liquidation_bonus 5 \
  --interest_rate_bps 500 \
  --xlm_price_usd 1200000
success "lending_pool initialized."

# ── Step 8: Set lending_pool as authorized minter on debt_token ───────────────
log "Step 8: Setting lending_pool as minter on debt_token..."
retry stellar contract invoke \
  --id "$DEBT_TOKEN_ID" \
  --source "$KEY_NAME" \
  --network "$NETWORK" \
  -- set_minter \
  --minter "$LENDING_POOL_ID"
success "Minter set."

# ── Step 8b: Deploy lending_pool_v2 ───────────────────────────────────────────
log "Step 8b: Deploying lending_pool_v2..."
LENDING_POOL_V2_ID=$(retry stellar contract deploy \
  --wasm "$WASM_DIR/lending_pool_v2.wasm" \
  --source "$KEY_NAME" \
  --network "$NETWORK" \
  2>&1 | grep -oE 'C[A-Z2-7]{55}' | head -n 1)
success "lending_pool_v2: $LENDING_POOL_V2_ID"

# ── Step 8c: Initialize lending_pool_v2 ────────────────────────────────────────
log "Step 8c: Initializing lending_pool_v2..."
retry stellar contract invoke \
  --id "$LENDING_POOL_V2_ID" \
  --source "$KEY_NAME" \
  --network "$NETWORK" \
  -- initialize \
  --admin "$DEPLOYER_ADDRESS" \
  --collateral_token "$COLLATERAL_TOKEN_ID" \
  --debt_token "$DEBT_TOKEN_ID" \
  --collateral_ratio 150 \
  --liquidation_threshold 120 \
  --liquidation_bonus 5 \
  --interest_rate_bps 500 \
  --xlm_price_usd 1200000
success "lending_pool_v2 initialized."

# ── Step 8d: Set lending_pool_v2 as authorized minter on debt_token ───────────
log "Step 8d: Setting lending_pool_v2 as minter on debt_token..."
retry stellar contract invoke \
  --id "$DEBT_TOKEN_ID" \
  --source "$KEY_NAME" \
  --network "$NETWORK" \
  -- set_minter \
  --minter "$LENDING_POOL_V2_ID"
success "Minter set to lending_pool_v2."

# ── Step 8e: Deploy flash_loan_pool ───────────────────────────────────────────
log "Step 8e: Deploying flash_loan_pool..."
FLASH_LOAN_POOL_ID=$(retry stellar contract deploy \
  --wasm "$WASM_DIR/flash_loan_pool.wasm" \
  --source "$KEY_NAME" \
  --network "$NETWORK" \
  2>&1 | grep -oE 'C[A-Z2-7]{55}' | head -n 1)
success "flash_loan_pool: $FLASH_LOAN_POOL_ID"

# ── Step 8f: Initialize flash_loan_pool ───────────────────────────────────────
log "Step 8f: Initializing flash_loan_pool..."
retry stellar contract invoke \
  --id "$FLASH_LOAN_POOL_ID" \
  --source "$KEY_NAME" \
  --network "$NETWORK" \
  -- initialize \
  --token "$DEBT_TOKEN_ID"
success "flash_loan_pool initialized."

# ── Step 8g: Deploy flash_liquidator ──────────────────────────────────────────
log "Step 8g: Deploying flash_liquidator..."
FLASH_LIQUIDATOR_ID=$(retry stellar contract deploy \
  --wasm "$WASM_DIR/flash_liquidator.wasm" \
  --source "$KEY_NAME" \
  --network "$NETWORK" \
  2>&1 | grep -oE 'C[A-Z2-7]{55}' | head -n 1)
success "flash_liquidator: $FLASH_LIQUIDATOR_ID"

# ── Step 9: Save .env files ───────────────────────────────────────────────────
log "Step 9: Saving contract IDs..."

ENV_CONTENT="VITE_COLLATERAL_TOKEN_ID=$COLLATERAL_TOKEN_ID
VITE_DEBT_TOKEN_ID=$DEBT_TOKEN_ID
VITE_LENDING_POOL_ID=$LENDING_POOL_ID
VITE_LENDING_POOL_V2_ID=$LENDING_POOL_V2_ID
VITE_FLASH_LOAN_POOL_ID=$FLASH_LOAN_POOL_ID
VITE_FLASH_LIQUIDATOR_ID=$FLASH_LIQUIDATOR_ID
VITE_NETWORK=$NETWORK
VITE_RPC_URL=$RPC_URL"

echo "$ENV_CONTENT" > "$PROJECT_ROOT/.env"
echo "$ENV_CONTENT" > "$PROJECT_ROOT/frontend/.env"
success "Saved to .env and frontend/.env"

echo "" >&2
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" >&2
echo -e "${GREEN}  DEPLOYMENT COMPLETE${NC}" >&2
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" >&2
echo "" >&2
echo "  Deployer:         $DEPLOYER_ADDRESS" >&2
echo "  Collateral (XLM): $COLLATERAL_TOKEN_ID" >&2
echo "  Debt Token:       $DEBT_TOKEN_ID" >&2
echo "  Lending Pool V1:  $LENDING_POOL_ID" >&2
echo "  Lending Pool V2:  $LENDING_POOL_V2_ID" >&2
echo "  Flash Loan Pool:  $FLASH_LOAN_POOL_ID" >&2
echo "  Flash Liquidator: $FLASH_LIQUIDATOR_ID" >&2
echo "  Network:          $NETWORK" >&2
echo "" >&2
echo -e "  Explorer: ${BLUE}https://stellar.expert/explorer/testnet${NC}" >&2
echo "" >&2
echo "  Users deposit native XLM as collateral." >&2
echo "  No faucet needed — Freighter testnet wallets already have XLM." >&2
echo "" >&2

# Output the environment details cleanly to stdout for pipeline references
echo "$ENV_CONTENT"
