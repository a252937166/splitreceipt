/** A network change is a full page navigation and never a wallet operation. */
export function buildNetworkNavigationUrl(href: string, key: 'testnet' | 'mainnet'): string {
  const url = new URL(href)
  url.searchParams.set('network', key)
  url.searchParams.set('chainId', key === 'mainnet' ? '5042' : '5042002')
  for (const name of ['contract', 'bill', 'receipts']) url.searchParams.delete(name)
  url.hash = ''
  return url.toString()
}
