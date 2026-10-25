/**
 * Routing for the homepage.
 *
 * The exact rule: ONLY an empty search string is the homepage. Every non-empty incoming search, whatever it
 * contains (unknown parameters, empty, duplicate or invalid values, `created`, `receipts`), goes unchanged to the
 * app and its page-context parser, which accepts it or shows the refusal page. Nothing here filters, normalizes or
 * ignores part of an incoming query to decide where it goes. Pure and free of browser and wallet code so it can be
 * tested in Node.
 */
import { MAINNET, buildContextSearch, defaultDeployment, parsePageContext } from './networks.ts'

export function isHomeSearch(search: string): boolean {
  return search === ''
}

/** The settled public bill the homepage links to: Arc Mainnet Bill 1 on the reviewed contract. Read-only. */
export const SETTLED_BILL_ID = 1n

export function settledBillSearch(): string {
  return buildContextSearch({ network: MAINNET, deployment: defaultDeployment(MAINNET) }, SETTLED_BILL_ID)
}

/** Where "Open app" goes the first time: the create form on the default network and reviewed contract. */
export function defaultCreateSearch(configuredAddress?: string): string {
  const parsed = parsePageContext('', configuredAddress)
  return parsed.ok ? buildContextSearch(parsed.context, null) : '?network=testnet'
}
