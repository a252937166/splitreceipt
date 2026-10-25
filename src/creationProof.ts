/**
 * The read-only creation proof for a bill view, without React.
 *
 * It verifies a creation transaction named in the link (or in the reviewed hint list) against canonical chain
 * data. Starting it captures the CURRENT page epoch; a result that finishes after the page changed, or after the
 * view cancelled it, is discarded. The view restarts it after every navigation (see readActivation.ts), so a
 * view that stayed mounted across a visit to the homepage settles again instead of showing "checking" forever.
 * Nothing here sends a transaction or touches a wallet.
 */
import { verifyCreateBillTransaction, type CreateVerificationClient, type IntendedBill } from './createBillReceipt.ts'
import type { Address, Hash32 } from './networks.ts'

export type Creator =
  | { kind: 'unknown' }
  | { kind: 'checking' }
  | { kind: 'verified'; address: Address; hash: Hash32 }
  | { kind: 'unverified'; reason: string }

export interface CreationProofInput {
  client: CreateVerificationClient
  chainId: number
  contract: Address
  hash: Hash32
  billId: bigint
  intended: IntendedBill
  epochs: { page: { readonly value: number } }
  /** Receives 'checking' immediately and the settled state later, only while this run is current. */
  onState: (state: Creator) => void
}

/** Starts one proof under the current page epoch. Returns a canceller (for effect cleanup). */
export function startCreationProof(input: CreationProofInput): () => void {
  let live = true
  const pageEpoch = input.epochs.page.value
  const current = () => live && input.epochs.page.value === pageEpoch
  input.onState({ kind: 'checking' })
  void verifyCreateBillTransaction(input.client, {
    chainId: input.chainId,
    contract: input.contract,
    hash: input.hash,
    intended: input.intended,
  })
    .then((r) => {
      if (!current()) return
      if (r.ok && r.billId === input.billId) input.onState({ kind: 'verified', address: r.creator, hash: input.hash })
      else if (r.ok) input.onState({ kind: 'unverified', reason: 'The creation transaction is for a different bill.' })
      else input.onState({ kind: 'unverified', reason: r.reason })
    })
    .catch(() => {
      if (current()) input.onState({ kind: 'unverified', reason: 'The creation transaction could not be read. Try again later.' })
    })
  return () => {
    live = false
  }
}
