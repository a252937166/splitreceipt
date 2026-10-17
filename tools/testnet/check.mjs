#!/usr/bin/env node
/** Read-only verification against the official public Arc Testnet RPC. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createPublicClient, http, keccak256, parseAbi, decodeEventLog, toHex } from 'viem';

const CHAIN_ID = 5042002;
const RPC = 'https://rpc.testnet.arc.io';
const deployment = JSON.parse(await fs.readFile(new URL('../../deployments/arc-testnet.json', import.meta.url), 'utf8'));
assert.equal(deployment.chainId, CHAIN_ID);
assert.equal(deployment.rpc, RPC);
const client = createPublicClient({ transport: http(RPC, { retryCount: 1, timeout: 20_000 }) });
assert.equal(await client.getChainId(), CHAIN_ID, 'RPC chain mismatch; stop without any signing.');
const head = await client.getBlockNumber();
const abi = parseAbi([
  'function getBill(uint256 billId) view returns (string title, address recipient, address[] payers, uint256 share, bool[] paidStates)',
  'event SharePaid(uint256 indexed billId, address indexed payer, uint256 amount)',
]);
const bill = deployment.exampleBill;
const [code, state, receipt, payments, source] = await Promise.all([
  client.getCode({ address: deployment.contract, blockNumber: head }),
  client.readContract({ address: deployment.contract, abi, functionName: 'getBill', args: [BigInt(bill.id)], blockNumber: head }),
  client.getTransactionReceipt({ hash: deployment.deploymentHash }),
  Promise.all(bill.payments.map(payment => client.getTransactionReceipt({ hash: payment.hash }))),
  fs.readFile(new URL('../../contracts/SplitReceipt.sol', import.meta.url)),
]);
assert(code && code !== '0x', 'Contract bytecode is missing.');
assert.equal(keccak256(code), deployment.runtimeCodeHash, 'Historical deployment runtime hash changed.');
assert.equal(keccak256(toHex(source)), deployment.sourceHash, 'The checked-in contract differs from the deployed source.');
assert.equal(receipt.status, 'success');
assert.equal(receipt.contractAddress.toLowerCase(), deployment.contract.toLowerCase());
assert.equal(receipt.blockNumber, BigInt(deployment.deploymentBlock));
assert.equal(state[0], bill.title);
assert.equal(state[1].toLowerCase(), bill.recipient.toLowerCase());
assert.equal(state[3], BigInt(bill.shareNativeAtomic));
assert.deepEqual(state[4], [true, true]);
const proof = payments.map((paymentReceipt, index) => {
  assert.equal(paymentReceipt.status, 'success');
  assert.equal(paymentReceipt.transactionHash, bill.payments[index].hash);
  const events = paymentReceipt.logs.filter(log => log.address.toLowerCase() === deployment.contract.toLowerCase())
    .flatMap(log => {
      try { const decoded = decodeEventLog({ abi, topics: log.topics, data: log.data, strict: true }); return decoded.eventName === 'SharePaid' ? [decoded.args] : []; }
      catch { return []; }
    });
  assert.equal(events.length, 1);
  assert.equal(events[0].billId, BigInt(bill.id));
  assert.equal(events[0].payer.toLowerCase(), bill.payments[index].payer.toLowerCase());
  assert.equal(events[0].amount, BigInt(bill.shareNativeAtomic));
  return { payer: events[0].payer, transactionHash: paymentReceipt.transactionHash, blockNumber: paymentReceipt.blockNumber };
});
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), readOnly: true, chainId: CHAIN_ID, rpc: RPC,
  head, contract: deployment.contract, runtimeCodeHash: keccak256(code), deploymentHash: receipt.transactionHash,
  billId: bill.id, paidStates: state[4], payments: proof }, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
