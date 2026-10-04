import { useConnection, useChainId, useReadContracts } from 'wagmi'
import { useReadSupplyChainNextBatchId, consumerGatewayAbi } from '../generated'
import { addresses } from '../addresses'

export function useMyBatches() {
  const { address } = useConnection()
  const chainId = useChainId()
  const consumerGateway = addresses[chainId as keyof typeof addresses]?.ConsumerGateway
  const supplyChain = addresses[chainId as keyof typeof addresses]?.SupplyChain

  const { data: nextBatchId } = useReadSupplyChainNextBatchId({ address: supplyChain })
  const ids = nextBatchId ? Array.from({ length: Number(nextBatchId) - 1 }, (_, i) => BigInt(i + 1)) : []

  const { data, isLoading } = useReadContracts({
    contracts: ids.map((id) => ({
      address: consumerGateway,
      abi: consumerGatewayAbi,
      functionName: 'getBatchData',
      args: [id],
    })),
    query: { enabled: Boolean(consumerGateway && ids.length > 0) },
  })

  const asBeekeeper: number[] = []
  const asHolder: number[] = []

  data?.forEach((entry, i) => {
    if (entry.status !== 'success' || !address) return
    const [batch, holder] = entry.result as readonly [{ beekeeper: `0x${string}` }, `0x${string}`]
    const id = Number(ids[i])
    if (batch.beekeeper.toLowerCase() === address.toLowerCase()) asBeekeeper.push(id)
    if (holder.toLowerCase() === address.toLowerCase()) asHolder.push(id)
  })

  return { asBeekeeper, asHolder, isLoading }
}
