/**
 * SplitReceipt contract config.
 * Defaults point to the verified public Arc Testnet deployment.
 * The ABI is hand-matched to contracts/SplitReceipt.sol — update if the source changes.
 */

export const SPLIT_RECEIPT_ABI = [
  // createBill
  {
    type: 'function',
    name: 'createBill',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'title', type: 'string' },
      { name: 'recipient', type: 'address' },
      { name: 'payers', type: 'address[]' },
      { name: 'share', type: 'uint256' },
    ],
    outputs: [{ name: 'billId', type: 'uint256' }],
  },
  // payShare
  {
    type: 'function',
    name: 'payShare',
    stateMutability: 'payable',
    inputs: [{ name: 'billId', type: 'uint256' }],
    outputs: [],
  },
  // getBill
  {
    type: 'function',
    name: 'getBill',
    stateMutability: 'view',
    inputs: [{ name: 'billId', type: 'uint256' }],
    outputs: [
      { name: 'title', type: 'string' },
      { name: 'recipient', type: 'address' },
      { name: 'payers', type: 'address[]' },
      { name: 'share', type: 'uint256' },
      { name: 'paidStates', type: 'bool[]' },
    ],
  },
  // billCount
  {
    type: 'function',
    name: 'billCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Events
  {
    type: 'event',
    name: 'BillCreated',
    inputs: [
      { name: 'billId', type: 'uint256', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'share', type: 'uint256', indexed: false },
      { name: 'payers', type: 'address[]', indexed: false },
      { name: 'title', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SharePaid',
    inputs: [
      { name: 'billId', type: 'uint256', indexed: true },
      { name: 'payer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  // Custom errors
  { type: 'error', name: 'TitleTooLong', inputs: [] },
  { type: 'error', name: 'ZeroRecipient', inputs: [] },
  { type: 'error', name: 'InvalidPayerCount', inputs: [] },
  { type: 'error', name: 'ZeroPayer', inputs: [] },
  { type: 'error', name: 'DuplicatePayer', inputs: [] },
  { type: 'error', name: 'ZeroShare', inputs: [] },
  { type: 'error', name: 'InvalidBillId', inputs: [] },
  { type: 'error', name: 'NotAPayer', inputs: [] },
  { type: 'error', name: 'AlreadyPaid', inputs: [] },
  { type: 'error', name: 'WrongAmount', inputs: [] },
  { type: 'error', name: 'ForwardFailed', inputs: [] },
] as const;

/** Public testnet deployment; optional override is still used only on Arc Testnet. */
export const SPLIT_RECEIPT_ADDRESS = (
  import.meta.env.VITE_SPLIT_RECEIPT_ADDRESS ?? '0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26'
) as `0x${string}`;

/**
 * The block number at which SplitReceipt was deployed, used as the
 * floor for historical SharePaid log queries.
 *
 * Set VITE_SPLIT_RECEIPT_DEPLOY_BLOCK=<number> in .env after deployment.
 * When absent (null), resumable history queries start at the newest block
 * and can continue backwards to genesis without claiming unfinished history is complete.
 */
const _deployBlockRaw: string =
  String(import.meta.env.VITE_SPLIT_RECEIPT_DEPLOY_BLOCK ?? '67660831')
export const SPLIT_RECEIPT_DEPLOY_BLOCK: bigint | null =
  _deployBlockRaw && /^\d+$/.test(_deployBlockRaw)
    ? BigInt(_deployBlockRaw)
    : null

export const ARC_TESTNET_CHAIN_ID = 5042002;
