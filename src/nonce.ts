import { getTransactionCount } from 'wagmi/actions'
import { config } from './wagmi'

// MetaMasks eigene Nonce-Verfolgung hinkt manchmal einen Schritt hinterher, besonders wenn schon
// mehrere Transaktionen in derselben Session liefen (siehe docs/Projektstand.md, "Nonce too low") —
// frisch direkt vom Node geholt statt dem Wallet-Cache überlassen, umgeht das zuverlässig.
export async function getFreshNonce(address: `0x${string}` | undefined): Promise<number | undefined> {
  if (!address) return undefined
  return getTransactionCount(config, { address, blockTag: 'pending' })
}
