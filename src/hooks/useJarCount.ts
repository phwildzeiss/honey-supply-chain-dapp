import { useChainId } from 'wagmi'
import { useReadHoneyTokenJarTokenId, useReadHoneyTokenBalanceOf } from '../generated'
import { addresses } from '../addresses'

const JAR_SIZE_GRAMS = 500

export function useJarCount(batchId: bigint | undefined, holder: `0x${string}` | undefined) {
  const chainId = useChainId()
  const honeyToken = addresses[chainId as keyof typeof addresses]?.HoneyToken

  const { data: jarTokenId } = useReadHoneyTokenJarTokenId({
    address: honeyToken,
    args: batchId !== undefined ? [batchId, JAR_SIZE_GRAMS] : undefined,
    query: { enabled: Boolean(honeyToken && batchId !== undefined) },
  })

  const { data: jarCount } = useReadHoneyTokenBalanceOf({
    address: honeyToken,
    args: holder && jarTokenId !== undefined ? [holder, jarTokenId] : undefined,
    query: { enabled: Boolean(honeyToken && holder && jarTokenId !== undefined) },
  })

  return jarCount
}
