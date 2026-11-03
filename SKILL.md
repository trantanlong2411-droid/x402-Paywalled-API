---
name: pharos-x402-paywalled-api
description: Run a self-hosted x402 v2 exact EIP-3009 facilitator and paid API on Pharos Atlantic Testnet.
---
# x402 Paywalled API agent instructions

- Use only Atlantic testnet `eip155:688689` with an on-chain EIP-3009-compatible six-decimal test USDC, not Pacific Mainnet.
- Implement exactly two priced endpoints and one free endpoint. Return HTTP 402 and a base64 PAYMENT-REQUIRED challenge on every unpaid call.
- Offer `/supported`, `/verify` and `/settle` from the project itself. Never delegate to an unidentified facilitator or return mocked settlement results.
- Validate the payload against the exact route's network, asset, recipient, amount, expiry, EIP-712 signature, token DOMAIN_SEPARATOR, authorizationState, balance and eth_call simulation.
- Atomic replay lock via a Durable Object, then sign and broadcast `transferWithAuthorization` using a dedicated funded **Atlantic testnet relayer private key** stored ONLY in a Cloudflare secret, never in code or prompts.
- Wait for a successful on-chain receipt with exact Transfer event; only then return HTTP 200 and PAYMENT-RESPONSE with the real transaction hash. Invalid or underpaid means another 402.
- Client browser must request wallet permission and user signature via EIP-1193 only on explicit click; a CLI client can use an environment-variable test wallet key.
- Do not store or print keys, full signed authorizations or secrets in proof artifacts. Never claim a signed payment was successful without a Pharos Atlantic explorer transaction.
- Revalidate an EIP-3009 token before production. The 0xE0BE... example token failed authorizationState; the 0xcfC833... token passed name/decimals/authorizationState/DOMAIN_SEPARATOR version 2 checks in an actual Atlantic RPC audit.
- Use the homepage as Proof Link; separate GitHub Actions and an explorer tx provide technical evidence. Only claim complete after a real 402 → signed → 200 path is documented.
