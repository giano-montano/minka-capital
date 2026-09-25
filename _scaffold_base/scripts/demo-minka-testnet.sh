#!/usr/bin/env bash
# Runs the full Minka Capital demo on Stellar Testnet from Linux/macOS:
# fresh identities, real Circle Testnet USDC bought on the DEX, contract
# deployment and the complete issuer -> investor -> revenue -> claim flow.
#
# Usage:
#   ./scripts/demo-minka-testnet.sh            # deploy a new contract + full demo
#   MINKA_MARKET_ID=C... ./scripts/demo-minka-testnet.sh   # reuse a deployed contract
#
# Every setting below can be overridden from the environment, e.g. to settle
# in another Testnet asset: USDC_ISSUER=G... USDC_SAC_ID=C... ./scripts/...
# or to use other Stellar CLI identities: ADMIN=alice ISSUER=bob ...
#
# Testnet only. Identities are Stellar CLI keys (~/.config/stellar); no secret
# is printed or written to the repository. Transaction hashes are appended to
# demo-testnet.log in the current directory.
set -euo pipefail

NETWORK=testnet
# Circle's USDC on Testnet and its Stellar Asset Contract.
USDC_CODE="${USDC_CODE:-USDC}"
USDC_ISSUER="${USDC_ISSUER:-GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5}"
USDC_SAC_ID="${USDC_SAC_ID:-CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA}"
USDC_ASSET="${USDC_CODE}:${USDC_ISSUER}"
USDC=10000000 # 1 USDC in stroops (7 decimals)

ADMIN="${ADMIN:-minka-admin}"
ISSUER="${ISSUER:-lumisolar}"
ANA="${ANA:-ana}"
LUIS="${LUIS:-luis}"

UNIT_PRICE=$(( ${UNIT_PRICE_USDC:-10} * USDC ))
TARGET_UNITS="${TARGET_UNITS:-1000}"
ANA_UNITS="${ANA_UNITS:-6}"
LUIS_UNITS="${LUIS_UNITS:-4}"
REVENUE=$(( ${REVENUE_USDC:-20} * USDC ))
REVENUE_EVENT_ID="${REVENUE_EVENT_ID:-1}"

LOG="${LOG:-demo-testnet.log}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

command -v stellar >/dev/null || { echo "Stellar CLI not found in PATH" >&2; exit 1; }

# Runs a Stellar CLI command, prints its stdout and records the tx hash.
tx() {
  local label="$1"; shift
  local err out hash
  err="$(mktemp)"
  if ! out="$("$@" 2>"$err")"; then
    cat "$err" >&2; rm -f "$err"
    echo "FAILED: $label" >&2
    exit 1
  fi
  hash="$(grep -oE 'Signing transaction: [0-9a-f]{64}' "$err" | tail -1 | awk '{print $3}' || true)"
  rm -f "$err"
  echo "$label | ${hash:-n/a}" | tee -a "$LOG" >&2
  [ -n "$out" ] && echo "$out"
  return 0
}

identity() {
  local name="$1"
  if ! stellar keys address "$name" >/dev/null 2>&1; then
    stellar keys generate "$name" --network "$NETWORK" --fund >/dev/null 2>&1
  fi
  stellar keys address "$name"
}

buy_usdc() {
  local name="$1" amount="$2"
  tx "trustline USDC $name" stellar tx new change-trust \
    --source-account "$name" --network "$NETWORK" --line "$USDC_ASSET" >/dev/null
  tx "buy $((amount / USDC)) USDC $name" stellar tx new path-payment-strict-receive \
    --source-account "$name" --network "$NETWORK" \
    --send-asset native --send-max $((1000 * USDC)) \
    --destination "$(stellar keys address "$name")" \
    --dest-asset "$USDC_ASSET" --dest-amount "$amount" >/dev/null
}

invoke() {
  local label="$1" source="$2"; shift 2
  tx "$label" stellar contract invoke --network "$NETWORK" \
    --source-account "$source" --id "$MINKA_MARKET_ID" -- "$@"
}

echo "== Identities"
for name in "$ADMIN" "$ISSUER" "$ANA" "$LUIS"; do
  printf '%-12s %s\n' "$name" "$(identity "$name")"
done

echo "== Circle Testnet USDC (XLM -> USDC on the DEX)"
# Each account buys exactly what the demo spends.
buy_usdc "$ISSUER" "$REVENUE"
buy_usdc "$ANA" $((ANA_UNITS * UNIT_PRICE))
buy_usdc "$LUIS" $((LUIS_UNITS * UNIT_PRICE))

if [ -z "${MINKA_MARKET_ID:-}" ]; then
  echo "== Build + deploy (constructor runs in the deploy transaction)"
  (cd "$PROJECT_ROOT" && stellar contract build --package minka-market >/dev/null)
  MINKA_MARKET_ID="$(tx "deploy + constructor" stellar contract deploy \
    --wasm "$PROJECT_ROOT/target/wasm32v1-none/release/minka_market.wasm" \
    --source-account "$ADMIN" --network "$NETWORK" --alias minka-market-testnet \
    -- --admin "$ADMIN" --usdc "$USDC_SAC_ID" | tail -1)"
fi
echo "MINKA_MARKET_ID=$MINKA_MARKET_ID" | tee -a "$LOG"

echo "== Minka approves the issuer and investors"
invoke "approve issuer $ISSUER" "$ADMIN" set_issuer_status --admin "$ADMIN" --issuer "$ISSUER" --approved true
invoke "approve investor $ANA" "$ADMIN" set_investor_status --admin "$ADMIN" --investor "$ANA" --approved true
invoke "approve investor $LUIS" "$ADMIN" set_investor_status --admin "$ADMIN" --investor "$LUIS" --approved true

echo "== LumiSolar publishes LUMI-RSN"
OFFERING_ID="$(invoke "create_offering LUMI-RSN" "$ISSUER" create_offering --issuer "$ISSUER" \
  --name "LumiSolar Peru - Nota de participacion en ingresos" --symbol LUMI-RSN \
  --unit_price "$UNIT_PRICE" --target_units "$TARGET_UNITS" | tail -1)"
echo "offering_id=$OFFERING_ID"

echo "== Investments"
invoke "invest $ANA $ANA_UNITS units" "$ANA" invest --investor "$ANA" --offering_id "$OFFERING_ID" --units "$ANA_UNITS"
invoke "invest $LUIS $LUIS_UNITS units" "$LUIS" invest --investor "$LUIS" --offering_id "$OFFERING_ID" --units "$LUIS_UNITS"

echo "== Funding + revenue"
invoke "fund_distributions" "$ISSUER" fund_distributions --issuer "$ISSUER" --offering_id "$OFFERING_ID" --amount "$REVENUE"
invoke "record_revenue event $REVENUE_EVENT_ID" "$ISSUER" record_revenue --issuer "$ISSUER" \
  --offering_id "$OFFERING_ID" --event_id "$REVENUE_EVENT_ID" --amount "$REVENUE"

echo "== Ana claims her pro-rata share"
CLAIMED="$(invoke "claim $ANA" "$ANA" claim --investor "$ANA" --offering_id "$OFFERING_ID" | tail -1)"
echo "Ana claimed: $CLAIMED stroops"

echo "== Final state"
stellar contract invoke --network "$NETWORK" --source-account "$ADMIN" --id "$MINKA_MARKET_ID" \
  --send=no -- get_offering --offering_id "$OFFERING_ID"
