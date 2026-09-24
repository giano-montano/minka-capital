# Minka Capital MVP specification

## Goal

Build a Stellar Testnet prototype for a regulated-platform-style primary offering: approved demo investors buy simulated startup revenue-share notes with USDC, revenue events create claimable distributions, and investors claim USDC.

## Required demo path

1. The administrator creates the `LUMI-RSN` offering for the fictional Peruvian startup LumiSolar Perú.
2. Only allowlisted wallets can invest.
3. An investor invests USDC Testnet and receives a simulated ownership balance.
4. A signed revenue event with an idempotency nonce is submitted.
5. The dashboard receives an on-chain event and refreshes its claimable-return view.
6. The investor claims their USDC Testnet return.

## Non-goals and safety boundary

- Testnet assets and fictional data only; no real money, KYC, custody, or securities offering.
- No secondary trading or order book in the MVP.
- The product copy must say it is a testnet prototype and not an investment offer.

## Technical constraints

- Use Stellar Scaffold with the React template.
- Use Rust/Soroban for contract code and TypeScript/React for the frontend.
- Use Stellar Testnet, a Stellar Asset Contract (SAC) for USDC, and Stellar RPC events.
- Keep oracle keys out of the frontend; the demo starts with an administrator-authorized revenue submission and documents the production signed-oracle boundary.
- Every state-changing contract method must emit an event that the UI can index.

## Acceptance criteria

- Rust unit tests cover allowlist rejection, investment accounting, duplicate revenue rejection, pro-rata distribution, and claim accounting.
- The README provides reproducible Testnet commands, contract IDs, demo wallets placeholders, and the five-step demo path.
- The interface visibly shows offering state, investor ownership, claimable USDC, revenue-event history, and Testnet-only disclaimer.
