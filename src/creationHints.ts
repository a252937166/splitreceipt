/**
 * Public creation-transaction candidates for known bills.
 *
 * Like receipt hints these are NOT trusted. A candidate is only used to ask the
 * chain: `verifyCreateBillTransaction` re-reads the canonical receipt,
 * transaction, calldata, event and stored bill, and a mismatch shows as
 * "not verified". Keys are `chainId:lowercaseContract:billId`.
 */
import { receiptScopeKey, type ReceiptScope } from './receiptHistory.ts'

const CREATION_CANDIDATES: Readonly<Record<string, `0x${string}`>> = {
  // Arc Mainnet, reviewed contract, Bill 1.
  '5042:0x8522ea5a413c8402182ff6998bd7471bac886142:1':
    '0x389acbe376e7adb426efbd66095dbea24b764b21f6a9c214874d14546473eee9',
  // Arc Testnet, original deployment, Bill 3.
  '5042002:0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26:3':
    '0x0accd8568a0d9844bbd65228d21eb8431cfdb18957c5f6a87c3c1744338707d7',
}

export function catalogCreationHint(scope: ReceiptScope): `0x${string}` | null {
  return CREATION_CANDIDATES[receiptScopeKey(scope)] ?? null
}
