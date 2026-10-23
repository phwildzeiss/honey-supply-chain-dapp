import { useConnection, useChainId, useReadContracts } from 'wagmi'
import { useReadSupplyChainNextBatchId, productGatewayAbi } from '../generated'
import { addresses } from '../addresses'

export function useMyBatches() {
  const { address } = useConnection()
  const chainId = useChainId()
  const productGateway = addresses[chainId as keyof typeof addresses]?.ProductGateway
  const supplyChain = addresses[chainId as keyof typeof addresses]?.SupplyChain

  const { data: nextBatchId } = useReadSupplyChainNextBatchId({ address: supplyChain })
  const ids = nextBatchId ? Array.from({ length: Number(nextBatchId) - 1 }, (_, i) => BigInt(i + 1)) : []

  const { data, isLoading } = useReadContracts({
    contracts: ids.map((id) => ({
      address: productGateway,
      abi: productGatewayAbi,
      functionName: 'getBatchData',
      args: [id],
    })),
    query: { enabled: Boolean(productGateway && ids.length > 0) },
  })

  const asBeekeeper: number[] = []
  const asHolder: number[] = []

  data?.forEach((entry, i) => {
    if (entry.status !== 'success' || !address) return
    const [batch, holder] = entry.result as unknown as readonly [{ beekeeper: `0x${string}` }, `0x${string}`]
    const id = Number(ids[i])
    if (batch.beekeeper.toLowerCase() === address.toLowerCase()) asBeekeeper.push(id)
    if (holder.toLowerCase() === address.toLowerCase()) asHolder.push(id)
  })

  return { asBeekeeper, asHolder, isLoading }
}
