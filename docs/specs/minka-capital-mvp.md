# Minka Capital MVP specification

## Goal

Build a Stellar Testnet prototype for a regulated-platform-style primary market: the platform (Minka) approves issuers and investors, approved issuers publish simulated revenue-share offerings, approved investors buy them with USDC, funded revenue events create claimable distributions, and investors claim USDC.

> Updated 2026-09-25: the MVP evolved from a single admin-run offering into a multi-offering platform with three roles (platform admin, issuer, investor). This spec reflects what is implemented.

## Required demo path

1. The platform admin approves the fictional Peruvian startup LumiSolar Perú as an issuer and approves investor wallets (global demo-KYC allowlist).
2. LumiSolar publishes the `LUMI-RSN` offering with its own unit price and target units.
3. Only allowlisted wallets can invest; an investor pays USDC Testnet and receives a simulated ownership position.
4. The issuer funds distributions and submits a revenue event, signed by the issuer wallet, with an idempotency key (`event_id`).
5. The dashboard receives the on-chain event and refreshes its claimable-return view.
6. The investor claims their USDC Testnet return.

## Non-goals and safety boundary

- Testnet assets and fictional data only; no real money, KYC, custody, or securities offering.
- No secondary trading or order book in the MVP.
- No independent revenue oracle in the MVP: the issuer records its own revenue. A signed oracle connected to POS or invoicing is the next step (see the architecture doc, section 7).
- The product copy must say it is a testnet prototype and not an investment offer.

## Technical constraints

- Use Stellar Scaffold with the React template.
- Use Rust/Soroban for contract code and TypeScript/React for the frontend.
- Use Stellar Testnet, a Stellar Asset Contract (SAC) for USDC, and Stellar RPC events.
- Keep oracle keys out of the frontend; the demo uses an issuer-authorized revenue submission and documents the production signed-oracle boundary.
- Every state-changing contract method must emit an event that the UI can index.

## Acceptance criteria

- Rust unit tests cover allowlist rejection, role checks, investment accounting, duplicate revenue rejection, pro-rata distribution, segregated treasury, and claim accounting (27 tests).
- The README provides reproducible Testnet commands, contract IDs, demo wallet addresses, and the demo path with transaction hashes.
- The interface visibly shows offering state, investor ownership, claimable USDC, revenue-event history, and Testnet-only disclaimer.
