# USDC Settlement and Local Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Minka Market's simulated accounting into a contract that escrows a configured SAC asset for investments and transfers claimable distributions to approved investors.

**Architecture:** `MinkaMarket` persists the SAC address and the price per unit at initialization. `invest` transfers the exact USDC amount from the authenticated investor to the contract; `record_revenue` keeps the existing proportional accounting; `fund_distributions` transfers Testnet USDC from the administrator into the contract; `claim` transfers the settled amount from the contract to the investor. Tests use Soroban's in-memory Stellar Asset Contract rather than a real key or network.

**Tech Stack:** Rust 1.93, Soroban SDK 26.1, Stellar Asset Contract (SEP-41), Stellar CLI, React/Vite.

**Spec:** `docs/specs/minka-capital-mvp.md`

## Global Constraints

- Stellar Testnet assets and fictitious data only; do not embed, request, or save a secret key.
- No secondary trading, KYC, custody, or real-world securities offering.
- USDC settlement must use the SAC address supplied at deployment; tests may use an in-memory SAC.
- All state-changing Minka methods must publish an audit event.
- The dashboard must continue to label itself a Testnet prototype, not an investment offer.

---

### Task 1: Add asset and pricing state to the contract

**Files:**
- Modify: `_scaffold_base/contracts/minka-market/src/lib.rs`
- Modify: `_scaffold_base/contracts/minka-market/src/test.rs`

**Interfaces:**
- Consumes: `initialize(env, admin, target_units)`.
- Produces: `initialize(env, admin, usdc, unit_price, target_units)`, `get_usdc(env) -> Address`, and `get_unit_price(env) -> i128`.

- [ ] **Step 1: Write the constructor test**

```rust
let asset = env.register_stellar_asset_contract_v2(admin.clone());
client.initialize(&admin, &asset.address(), &100, &100);
assert_eq!(client.get_usdc(), asset.address());
assert_eq!(client.get_unit_price(), 100);
```

- [ ] **Step 2: Run the focused test to verify the old signature fails**

Run: `cargo test -p minka-market initializes_asset_configuration`

Expected: compile failure because `initialize` does not yet accept `usdc` and `unit_price`.

- [ ] **Step 3: Store and validate the asset configuration**

Add `DataKey::Usdc` and `DataKey::UnitPrice`. Reject a non-positive `unit_price`, write the two keys in `initialize`, and expose the two getters.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `cargo test -p minka-market initializes_asset_configuration`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add _scaffold_base/contracts/minka-market/src/lib.rs _scaffold_base/contracts/minka-market/src/test.rs
git commit -m "feat: configure SAC settlement asset"
```

### Task 2: Escrow the investment payment

**Files:**
- Modify: `_scaffold_base/contracts/minka-market/src/lib.rs`
- Modify: `_scaffold_base/contracts/minka-market/src/test.rs`

**Interfaces:**
- Consumes: `invest(env, investor, units)`, `TokenClient::transfer(from, to, amount)`.
- Produces: an investment that transfers `units * unit_price` from `investor` to `env.current_contract_address()` and emits the existing `InvestmentRecorded` event.

- [ ] **Step 1: Write the escrow test**

```rust
let token = token::TokenClient::new(&env, &asset.address());
let issuer = token::StellarAssetClient::new(&env, &asset.address());
issuer.mint(&alice, &10_000);
client.invest(&alice, &60);
assert_eq!(token.balance(&alice), 4_000);
assert_eq!(token.balance(&contract_id), 6_000);
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `cargo test -p minka-market escrows_investment_usdc`

Expected: FAIL because `invest` only updates accounting.

- [ ] **Step 3: Transfer the asset after validation and before saving the position**

Use `TokenClient::new(&env, &Self::usdc(&env))` and call:

```rust
token.transfer(
    &investor,
    &MuxedAddress::from(env.current_contract_address()),
    &(units * Self::unit_price(&env)),
);
```

Keep `investor.require_auth()`, reject arithmetic overflow with `checked_mul(...).expect(...)`, and retain the oversubscription guard before the transfer.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `cargo test -p minka-market escrows_investment_usdc`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add _scaffold_base/contracts/minka-market/src/lib.rs _scaffold_base/contracts/minka-market/src/test.rs
git commit -m "feat: escrow SAC payments on investment"
```

### Task 3: Fund distributions and transfer claims

**Files:**
- Modify: `_scaffold_base/contracts/minka-market/src/lib.rs`
- Modify: `_scaffold_base/contracts/minka-market/src/test.rs`

**Interfaces:**
- Consumes: `record_revenue(admin, event_id, amount)` and the contract's escrowed SAC balance.
- Produces: `fund_distributions(env, admin, amount)`, `claim(env, investor) -> i128`, and `DistributionFunded` event.

- [ ] **Step 1: Write the transfer-on-claim test**

```rust
issuer.mint(&admin, &1_000);
client.fund_distributions(&admin, &1_000);
client.record_revenue(&admin, &1, &1_000);
assert_eq!(client.claim(&alice), 600);
assert_eq!(token.balance(&alice), 4_600);
assert_eq!(token.balance(&contract_id), 10_400);
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `cargo test -p minka-market transfers_claimable_usdc`

Expected: compile failure because `fund_distributions` is absent, then failure because `claim` does not transfer assets.

- [ ] **Step 3: Implement treasury funding and claim transfer**

`fund_distributions` must call `Self::admin`, require `amount > 0`, and transfer the amount from the admin to `env.current_contract_address()`. In `claim`, settle the position, set `claimable` to zero, save it, then transfer `amount` to `MuxedAddress::from(investor.clone())` only when the amount is positive. Publish `DistributionFunded` and retain `ClaimRecorded`.

- [ ] **Step 4: Add insufficient-treasury behavior to the test suite**

```rust
#[test]
#[should_panic(expected = "distribution treasury insufficient")]
fn rejects_revenue_when_treasury_is_not_funded() {
    // invest, omit fund_distributions, then record_revenue
}
```

Run: `cargo test -p minka-market rejects_claim_when_treasury_is_not_funded`

Expected: PASS because `record_revenue` cannot allocate an unfunded distribution.

- [ ] **Step 5: Run all contract tests and commit**

Run: `cargo test -p minka-market`

Expected: PASS.

```bash
git add _scaffold_base/contracts/minka-market/src/lib.rs _scaffold_base/contracts/minka-market/src/test.rs
git commit -m "feat: settle Minka claims through SAC"
```

### Task 4: Add non-secret local/Testnet configuration

**Files:**
- Create: `_scaffold_base/.env.example`
- Create: `_scaffold_base/scripts/deploy-minka-testnet.ps1`
- Modify: `_scaffold_base/environments.toml`
- Modify: `README.md`

**Interfaces:**
- Consumes: environment variables `ADMIN_ALIAS`, `USDC_SAC_ID`, `UNIT_PRICE`, and `TARGET_UNITS`.
- Produces: a PowerShell deployment command that refuses empty values and prints the deployed Minka contract ID.

- [ ] **Step 1: Add the environment template**

```dotenv
STELLAR_NETWORK=testnet
ADMIN_ALIAS=admin
USDC_SAC_ID=
UNIT_PRICE=10000000
TARGET_UNITS=1000
MINKA_MARKET_ID=
```

- [ ] **Step 2: Add a contract entry for `minka_market` in the staging environment**

Use `client = true` and constructor arguments that take their values from the deployment script; do not place an asset ID or account key in `environments.toml`.

- [ ] **Step 3: Implement the deployment script precondition checks**

The script must throw when `USDC_SAC_ID` is blank or does not begin with `C`, or when `ADMIN_ALIAS` is blank. It must run `stellar contract build`, deploy to `--network testnet`, invoke `initialize`, and print the contract address. It must never generate or persist a secret.

- [ ] **Step 4: Validate the PowerShell help and static configuration**

Run: `powershell -ExecutionPolicy Bypass -File scripts/deploy-minka-testnet.ps1 -?`

Expected: usage output without a network request.

- [ ] **Step 5: Document the required Testnet evidence and commit**

Update the contract-id table and README demo checklist, then:

```bash
git add README.md _scaffold_base/.env.example _scaffold_base/environments.toml _scaffold_base/scripts/deploy-minka-testnet.ps1
git commit -m "docs: add Testnet settlement deployment guide"
```
