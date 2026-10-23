/**
 * Human-readable ABI for the deployed SplitReceipt contract, used by the pure
 * verification modules (which must run under plain Node tests and so cannot
 * import the Vite-env based `splitReceiptContract.ts`).
 *
 * It mirrors contracts/SplitReceipt.sol exactly. Facts that matter to callers:
 *  - There is NO public `paid()` method. Paid status is the fifth return value
 *    of `getBill` (`paidStates`, index-aligned with `payers`).
 *  - `BillCreated` carries billId / recipient / share / payers / title. It has
 *    NO creator field; the creator is the canonical `tx.from` of the creating
 *    transaction.
 *  - `SharePaid` carries billId / payer / amount. It has NO recipient field;
 *    the recipient is the fixed `recipient` returned by `getBill`.
 *
 * tests/abi-parity.test.ts compares this file with the compiler ABI.
 */
import { parseAbi } from 'viem'

export const SPLIT_RECEIPT_HUMAN_ABI = parseAbi([
  'function createBill(string title, address recipient, address[] payers, uint256 share) returns (uint256 billId)',
  'function payShare(uint256 billId) payable',
  'function getBill(uint256 billId) view returns (string title, address recipient, address[] payers, uint256 share, bool[] paidStates)',
  'function billCount() view returns (uint256)',
  'event BillCreated(uint256 indexed billId, address indexed recipient, uint256 share, address[] payers, string title)',
  'event SharePaid(uint256 indexed billId, address indexed payer, uint256 amount)',
  'error TitleTooLong()',
  'error ZeroRecipient()',
  'error InvalidPayerCount()',
  'error ZeroPayer()',
  'error DuplicatePayer()',
  'error ZeroShare()',
  'error InvalidBillId()',
  'error NotAPayer()',
  'error AlreadyPaid()',
  'error WrongAmount()',
  'error ForwardFailed()',
  'error ReentrancyGuardReentrantCall()',
])

/** Index of `paidStates` in the `getBill` result tuple. */
export const GET_BILL_PAID_STATES_INDEX = 4
/** Index of `recipient` in the `getBill` result tuple. */
export const GET_BILL_RECIPIENT_INDEX = 1
