# Pharos x402 Paywalled API — evidence checklist

**Observed production status (4 Nov 2026 local / 3 Nov UTC):** Cloudflare Worker is deployed and the live [GitHub Actions HTTP health check](https://github.com/trantanlong2411-droid/x402-Paywalled-API/actions/runs/41702141474) matched the expected Worker code/version and Atlantic chain ID 688689, but returned `configured:false`. The job correctly failed because the required encrypted Cloudflare secret `FACILITATOR_PRIVATE_KEY` is not set. The API must not claim a 402 signed-payment success until this secret, relayer PHRS and client test USDC have been configured and a real explorer receipt exists. The [latest unit/build workflow](https://github.com/trantanlong2411-droid/x402-Paywalled-API/actions/runs/41702242148) passed **11/11** tests, including a full mocked relayer settlement and replay rejection.


**Challenge: Medium / Payments / x402 Paywalled API**

- Live homepage / intended proof: https://x402-paywalled-api.trantanlong2411.workers.dev/
- Repository: https://github.com/trantanlong2411-droid/x402-Paywalled-API
- [Unit tests and Worker build](https://github.com/trantanlong2411-droid/x402-Paywalled-API/actions/workflows/verify.yml)
- [Actual Atlantic USDC contract compatibility audit](https://github.com/trantanlong2411-droid/x402-Paywalled-API/actions/workflows/verify-atlantic.yml)
- [Deployed Worker HTTP 402 verification (manual after configuring secrets)](https://github.com/trantanlong2411-droid/x402-Paywalled-API/actions/workflows/verify-deployed.yml)

## Verified so far

1. Static and mocked unit tests cover distinct route prices, x402 v2 challenge, signed EIP-712 signature, invalid/underpaid/expired/replayed payments and exact receipt checks.
2. Wrangler bundles the Cloudflare Worker and SQLite Durable Object.
3. A read-only actual Atlantic RPC audit at block ~32266478 determined:
   - `0xE0BE08c77f415F577A1B3A9aD7a1Df1479564ec8`: ERC-20 USDC but **does NOT support required authorizationState**.
   - `0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B`: six-decimal USDC with **EIP-3009 authorizationState, name USDC and DOMAIN_SEPARATOR version 2**; selected as the default token.
   - `0xBd80E06F0325C4758e06d8a9522588363C4c75a4`: also compatible but a separate test USDC contract.

## Remaining proof for full 100-point rubric

- Put `FACILITATOR_PRIVATE_KEY` in an encrypted Cloudflare Worker secret and fund that *testnet-only* address with PHRS. Use a public `PAY_TO_ADDRESS` receiver.
- Fund a different client wallet with matching test USDC (the specific selected contract).
- Run the deployed 402-readiness workflow and verify it passes.
- In browser click Pay and approve the EIP-712 authorization, or run the CLI client locally with `CLIENT_PRIVATE_KEY` env var.
- Record actual HTTP 402, an authorized signature (without exposing secret or raw signature), HTTP 200, decoded PAYMENT-RESPONSE, and a real explorer transaction hash.
- Test an underpaid and an invalid signed payload, confirm another HTTP 402.

**No signed settlement has been proven yet** until an actual explorer hash exists. Never replace it with a fake or a mocked transaction. Do not expose client or facilitator keys in the proof.

Technical reference: [Pharos x402 skill](https://github.com/PharosNetwork/examples/tree/main/skills/x402-pharos) · [x402 exact spec](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_evm.md).
