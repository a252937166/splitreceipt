# Mainnet cost study

**Analysis only. No mainnet deployment, no wallet connection, no transaction broadcast, no mainnet app configuration.**

This document estimates the USDC cost of deploying and running SplitReceipt on Arc mainnet, based on public documentation and historical testnet gas data. It is a planning reference, not a guarantee or a deployment instruction.

---

## Network references

- Connect to Arc: https://docs.arc.io/arc/references/connect-to-arc
  - Mainnet chain ID: 5042
  - Mainnet RPC: https://rpc.mainnet.arc.io
  - Native asset: USDC, 18 decimals
- Gas and fees: https://docs.arc.io/arc/references/gas-and-fees
  - 20 Gwei floor base fee; zero tip accepted
  - Account balance must cover `value + gasLimit × maxFeePerGas`
- Bridge fees: https://docs.arc.io/app-kit/concepts/bridge-fees
  - Additional funding or bridge fees may apply when moving USDC to Arc mainnet

---

## Fee snapshot (21 October 2026, 14:26 UTC, read-only)

| Field | Value |
|---|---|
| Chain | 5042 (Arc mainnet) |
| Suggested gas price | 20827001712 wei = 20.827001712 Gwei |
| Latest block base fee | 20 Gwei (floor) |

This is a single point-in-time observation. Actual fees vary. The 20 Gwei floor is a minimum; congestion can raise it. The exact fee for any future transaction depends on the gas limit used by that transaction, the base fee at the time it is included, and the `maxFeePerGas` set by the wallet.

---

## Historical testnet gas usage

From actual Arc Testnet (chain 5042002) transactions. Gas units (`gasUsed`) only; USDC cost depends on `effectiveGasPrice` at inclusion time. `gasLimit × maxFeePerGas` is the wallet balance-reserve ceiling, not the actual consumption.

| Operation | Gas used | Source transaction |
|---|---|---|
| Contract deployment | 766,484 | [0x7808b473…eccacac](https://explorer.testnet.arc.io/tx/0x7808b47303974a4b69f8b306e1fff0bdfbb408b6cd26de53790187d77eccacac) |
| `createBill` (first bill) | 208,538 | [0xc6c8fafd…122c80](https://explorer.testnet.arc.io/tx/0xc6c8fafd050738cd8c37321db5b7a8f9feae8ec36822f9dda0f445874f122c80) |
| `payShare` (first payment) | 68,472 | [0x4736c401…176b54](https://explorer.testnet.arc.io/tx/0x4736c401fc2a9757d21f6c09aa8de5550e8c9e76027475ce2fb63a7e3b176b54) |
| `payShare` (second payment) | 70,865 | [0xe1fba09d…598e25](https://explorer.testnet.arc.io/tx/0xe1fba09d727a8eae598de8f794ac11b4fdfbfa188355805d492ffb856b598e25) |

These are observed testnet values. Mainnet gas usage may differ; do not assume it is marginal or identical. Use as a planning estimate only.

---

## Cost formula

Arc's native asset is USDC with **18 decimals**. Actual native fee (atoms) = `gasUsed × effectiveGasPrice (wei)`.

```
USDC cost = gasUsed × gasPriceWei / 1e18
```

Equivalently, converting the price to Gwei first (1 Gwei = 1e9 wei):

```
USDC cost = gasUsed × gasPriceGwei / 1e9
```

Using the exact observed suggested price of **20827001712 wei (20.827001712 Gwei)**:

| Scenario | Gas | USDC gas cost (exact) | USDC gas cost (9 dp) |
|---|---|---|---|
| Deploy + create + one payment (1/2 paid, not settled) | 1,043,494 | 0.021732851324461728 | 0.021732851 |
| Deploy + create + two payments (2/2 settled) | 1,114,359 | 0.023208756800782608 | 0.023208757 |

Verification: 1,043,494 × 20827001712 / 1e18 = 0.021732851324461728; 1,114,359 × 20827001712 / 1e18 = 0.023208756800782608.

At **20 Gwei floor** (conditional gas model — not a guaranteed minimum; congestion can raise the base fee):

| Scenario | Gas | USDC gas cost |
|---|---|---|
| Deploy + create + one payment | 1,043,494 | 0.02086988 |
| Deploy + create + two payments | 1,114,359 | 0.02228718 |

---

## Minimum share totals (principal + gas)

The app enforces a minimum per-payer share of 0.000001 USDC (6 decimal places). The contract theoretically accepts 1 native atom (1e-18 USDC), but the app input does not permit this. At the minimum app share (gas at 20.827001712 Gwei):

| Scenario | Gas cost (exact) | Principal | Total (exact) | Total (9 dp) |
|---|---|---|---|---|
| One payment at min share | 0.021732851324461728 | 0.000001 | 0.021733851324461728 | 0.021733851 |
| Two payments at min share | 0.023208756800782608 | 0.000002 | 0.023210756800782608 | 0.023210757 |

At 0.001 USDC per share (bill 3 amount):

| Scenario | Gas cost (exact) | Principal | Total (exact) | Total (9 dp) |
|---|---|---|---|---|
| One payment at 0.001 share | 0.021732851324461728 | 0.001 | 0.022732851324461728 | 0.022732851 |
| Two payments at 0.001 share | 0.023208756800782608 | 0.002 | 0.025208756800782608 | 0.025208757 |

Principal transferred between owner-controlled accounts remains the owner's funds; only gas is consumed.

---

## Provisional budget

**0.05–0.10 USDC** is a provisional planning budget for the deploy-plus-demo cycle assuming current fee levels and that USDC is already available on Arc mainnet. This is not a deposit minimum or a guarantee.

The following are excluded from this estimate and may require additional funds:

- Gas price variation above the 20 Gwei floor
- Account setup and funding transfers
- USDC buy, bridge or withdrawal fees (see bridge fees reference above)
- Multiple failed transactions or retries
- Any change in contract gas usage on mainnet

---

## Not included

- No wallet balance has been checked.
- No mainnet wallet has been connected or funded.
- No mainnet app configuration has been prepared.
- No transaction has been broadcast.
- A reviewed unsigned mainnet deployment transaction can be estimated before deploying, once mainnet work is independently authorized. This study uses historical testnet gas values as a proxy; a final estimate should use a specific reviewed mainnet transaction.
- Exact gas prices are not guaranteed; obtain a fresh fee snapshot immediately before any mainnet transaction.
