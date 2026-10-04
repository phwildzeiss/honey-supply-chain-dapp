import { useEffect, useState, type SubmitEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useChainId, useConnection, useWaitForTransactionReceipt } from 'wagmi'
import {
  useReadActorRegistryGetAllActors,
  useReadConsumerGatewayGetBatchData,
  useReadHoneyTokenIsApprovedForAll,
  useWriteHoneyTokenSetApprovalForAll,
  useWriteSupplyChainTransferCustody,
} from '../generated'
import { addresses } from '../addresses'

function TransferCustody() {
  const { batchId } = useParams()
  const chainId = useChainId()
  const { address } = useConnection()
  const consumerGateway = addresses[chainId as keyof typeof addresses]?.ConsumerGateway
  const actorRegistry = addresses[chainId as keyof typeof addresses]?.ActorRegistry
  const honeyToken = addresses[chainId as keyof typeof addresses]?.HoneyToken
  const supplyChain = addresses[chainId as keyof typeof addresses]?.SupplyChain
  const id = batchId ? BigInt(batchId) : undefined

  const { data: batchData } = useReadConsumerGatewayGetBatchData({
    address: consumerGateway,
    args: id !== undefined ? [id] : undefined,
    query: { enabled: Boolean(consumerGateway && id !== undefined) },
  })
  const { data: actorsData } = useReadActorRegistryGetAllActors({ address: actorRegistry })
  const { data: isApproved, refetch: refetchApproval } = useReadHoneyTokenIsApprovedForAll({
    address: honeyToken,
    args: address && supplyChain ? [address, supplyChain] : undefined,
    query: { enabled: Boolean(honeyToken && address && supplyChain) },
  })

  const [selected, setSelected] = useState('')

  const approve = useWriteHoneyTokenSetApprovalForAll()
  const approveReceipt = useWaitForTransactionReceipt({ hash: approve.data })
  const transfer = useWriteSupplyChainTransferCustody()
  const transferReceipt = useWaitForTransactionReceipt({ hash: transfer.data })

  useEffect(() => {
    if (approveReceipt.isSuccess) {
      refetchApproval()
    }
  }, [approveReceipt.isSuccess])

  if (!batchData || !actorsData) {
    return <p>Lädt...</p>
  }

  const [, holder] = batchData
  const [actorAddresses, actorList] = actorsData
  const options = actorAddresses
    .map((addr, i) => ({ address: addr, name: actorList[i].name }))
    .filter((actor) => actor.address.toLowerCase() !== holder.toLowerCase())

  function handleApprove() {
    if (!supplyChain) return
    approve.mutate({ address: honeyToken, args: [supplyChain, true] })
  }

  function handleTransfer(event: SubmitEvent) {
    event.preventDefault()
    if (!id || !supplyChain || !selected) return
    transfer.mutate({ address: supplyChain, args: [id, selected as `0x${string}`] })
  }

  if (transferReceipt.isSuccess) {
    return (
      <div>
        <p>Charge übergeben.</p>
        <Link to={`/batches/${batchId}`} className="tile">Zur Charge</Link>
      </div>
    )
  }

  return (
    <div>
      <h1>Charge übergeben — #{batchId}</h1>

      {!isApproved ? (
        <div>
          <p>Bevor du Chargen übergeben kannst, muss SupplyChain einmalig für dein Konto freigegeben werden.</p>
          <button type="button" onClick={handleApprove} disabled={approve.isPending || approveReceipt.isLoading}>
            {approve.isPending || approveReceipt.isLoading ? 'wird freigegeben...' : 'Freigabe erteilen'}
          </button>
        </div>
      ) : (
        <form onSubmit={handleTransfer}>
          <label>
            Empfänger
            <select value={selected} onChange={(e) => setSelected(e.target.value)} required>
              <option value="" disabled>bitte wählen</option>
              {options.map((actor) => (
                <option key={actor.address} value={actor.address}>
                  {actor.name} ({actor.address.slice(0, 6)}…{actor.address.slice(-4)})
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={transfer.isPending || transferReceipt.isLoading}>
            {transfer.isPending || transferReceipt.isLoading ? 'wird übergeben...' : 'Übergeben'}
          </button>
        </form>
      )}
    </div>
  )
}

export default TransferCustody
