import { getTransactionCount } from 'wagmi/actions'
import { config } from './wagmi'

export async function getFreshNonce(address: `0x${string}` | undefined): Promise<number | undefined> {
  if (!address) return undefined
  return getTransactionCount(config, { address, blockTag: 'pending' })
}
