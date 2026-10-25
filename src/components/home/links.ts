/**
 * Every outside link on the homepage, in one place. The Mainnet addresses are derived from the reviewed
 * deployment in `networks.ts`, so the page cannot drift from the contract the app accepts. The payment is the
 * existing Bill 1 payer-2 transaction; no new transaction is implied.
 */
import { MAINNET, defaultDeployment, explorerAddressUrl, explorerTxUrl } from '../../networks.ts'

export const GITHUB_URL = 'https://github.com/a252937166/splitreceipt'
export const VIDEO_URL = 'https://youtu.be/Uza-SlbEFNo'
export const STUDIO_URL = 'https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62'
export const EXAMPLE_PAYMENT_HASH = '0xf246c9ed15463fd871c96e9da353ffd183b6ff31c0b1b940982c86d09f56d5e5'

export const CONTRACT_EXPLORER_URL = explorerAddressUrl(MAINNET, defaultDeployment(MAINNET).address)
export const PAYMENT_EXPLORER_URL = explorerTxUrl(MAINNET, EXAMPLE_PAYMENT_HASH)
