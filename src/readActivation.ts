import { createContext, useContext } from 'react'

/**
 * A small, read-only activation signal for views that stay mounted across a visit to the homepage.
 *
 * `Entry` keeps an opened app mounted but hidden while the homepage shows, so that a held submission lock and
 * any form state survive. Each navigation (including Home and the return) bumps the page epoch, which
 * correctly marks every read that was in flight as stale. But a mounted view whose own dependencies did not
 * change would never start those reads again, and would sit in "verifying" forever.
 *
 * The value is the page-epoch number at the latest navigation. Read hooks (receipt proofs, the creation proof)
 * list it as an effect dependency, so they restart under the CURRENT page epoch after every navigation. It
 * starts no transaction, touches no wallet, remounts nothing and relaxes no staleness check: an old read is
 * still discarded, and a new one begins.
 */
export const ReadActivationContext = createContext<number>(0)

export function useReadActivation(): number {
  return useContext(ReadActivationContext)
}
