# Deploy and verify x402 Paywalled API on Cloudflare

The repository is complete, but a **signed testnet payment must be verified before submission**. Cloudflare Git connection and the testnet relayer signing secret are separate concerns.

## Worker deployment

Open Cloudflare Dashboard → Workers & Pages → existing x402 Paywalled API → Settings → Builds.

- Repository: `trantanlong2411-droid/x402-Paywalled-API`
- Production branch: `main`
- Root: `/`
- Worker name in `wrangler.jsonc`: `x402-paywalled-api`
- Deployment command: `npx wrangler deploy`; never use the `npm run build` dry-run for deployment
- SQLite Durable Object binding `PAYMENT_LEDGER` and migration for `PaymentLedger` are committed; Wrangler creates this, no D1 setup.

## Private configuration — Cloudflare Settings → Variables and Secrets

- `FACILITATOR_PRIVATE_KEY` **encrypted secret**: dedicated Atlantic Testnet relayer EVM key, starting `0x`. Do not paste it into GitHub or ChatGPT.
- `PAY_TO_ADDRESS` **public environment variable**: public recipient 0x wallet on Atlantic. Optional; if omitted, the facilitator key address is used, but a separate recipient is safer.
- `TEST_USDC_ADDRESS` **public variable**: default `0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B` (actual Circle Atlantic Testnet USDC, 6 decimals, EIP-3009).
- `USDC_DOMAIN_NAME=USDC`, `USDC_DOMAIN_VERSION=2`, confirmed against token DOMAIN_SEPARATOR in direct RPC audit.
- `ATLANTIC_RPC_URL=https://atlantic.dplabs-internal.com`.

**Fund two separate testnet wallets:**

1. Facilitator/relayer address needs PHRS to broadcast settlement transactions. Example faucet: https://pharos.faucetme.pro/
2. Client wallet needs Circle test USDC from https://faucet.circle.com/ — choose **Pharos Testnet**. The exact 0xcfC833... token must be funded. The wallet signs EIP-712; it does not need to broadcast its own transfer.

These are free testnet tokens. No mainnet keys or valuable funds should be used.

## Demo and evidence

1. Open the exact public Cloudflare Worker URL shown in the dashboard.
2. `GET /health` should show `configured:true`, chain 688689 and correct asset; `GET /supported` must list `eip155:688689`, `exact`, version 2.
3. Call `/api/insights` and `/api/report` without payment. Both must return 402, but with different amount requirements `1000` and `3000`.
4. Connect client wallet on Atlantic, click **Pay & get insights**, confirm the signature. The facilitator must submit a PHRS-funded USDC settlement.
5. Only a successful onchain receipt permits HTTP 200 with `PAYMENT-RESPONSE`. Save the actual hash URL `https://atlantic.pharosscan.xyz/tx/<hash>`.
6. Try an invalid or underpaid signed payment and verify a fresh HTTP 402.
7. Verify GitHub Actions:
   - [Unit/build](https://github.com/trantanlong2411-droid/x402-Paywalled-API/actions/workflows/verify.yml)
   - [Atlantic test token audit](https://github.com/trantanlong2411-droid/x402-Paywalled-API/actions/workflows/verify-atlantic.yml)
   - [Manual deployed HTTP gate verification](https://github.com/trantanlong2411-droid/x402-Paywalled-API/actions/workflows/verify-deployed.yml)

A successful Worker build or wallet signature alone is **not** settlement proof. A real HTTP 200 response with onchain transaction hash is essential for the full rubric.

Do not submit a fake receipt. Do not share your keys or a screenshot of raw secret values.
