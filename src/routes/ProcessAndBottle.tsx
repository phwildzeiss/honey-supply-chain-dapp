import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useChainId, useConnection, useWaitForTransactionReceipt } from 'wagmi'
import { useReadConsumerGatewayGetBatchData, useWriteSupplyChainProcessAndBottle } from '../generated'
import { addresses } from '../addresses'
import { useMyRoles } from '../hooks/useMyRoles'
import { recordStep, recordError, errorMessage } from '../measurements'
import { useTxTiming } from '../hooks/useTxTiming'

const JAR_SIZE_GRAMS = 500

function ProcessAndBottle() {
  const { batchId } = useParams()
  const chainId = useChainId()
  const { address } = useConnection()
  const consumerGateway = addresses[chainId as keyof typeof addresses]?.ConsumerGateway
  const supplyChain = addresses[chainId as keyof typeof addresses]?.SupplyChain
  const id = batchId ? BigInt(batchId) : undefined
  const roles = useMyRoles()

  const { data: batchData } = useReadConsumerGatewayGetBatchData({
    address: consumerGateway,
    args: id !== undefined ? [id] : undefined,
    query: { enabled: Boolean(consumerGateway && id !== undefined) },
  })

  const [count, setCount] = useState('')
  const errorRecorded = useRef(false)

  const process = useWriteSupplyChainProcessAndBottle()
  const receipt = useWaitForTransactionReceipt({ hash: process.data })
  const timing = useTxTiming(process.data)

  useEffect(() => {
    if (process.isError && !errorRecorded.current) {
      errorRecorded.current = true
      recordError({
        chainId, batchId: id, step: 'processAndBottle', actor: 'bottler', address,
        message: errorMessage(process.error),
      })
    }
  }, [process.isError])

  useEffect(() => {
    if (!receipt.isSuccess || !receipt.data || id === undefined) return
    if (receipt.data.status === 'reverted') {
      recordError({
        chainId, batchId: id, step: 'processAndBottle', actor: 'bottler', address,
        message: 'Transaktion wurde on-chain zurückgewiesen (reverted).',
      })
      return
    }
    const { walletConfirmMs, miningMs, totalMs } = timing.split()
    void recordStep({
      chainId, batchId: id, step: 'processAndBottle', actor: 'bottler', address,
      txHash: receipt.data.transactionHash, gasUsed: receipt.data.gasUsed, gasPriceWei: receipt.data.effectiveGasPrice,
      durationMs: totalMs, walletTiming: { walletConfirmMs, miningMs },
    })
  }, [receipt.isSuccess])

  if (!batchData) {
    return <p>Lädt...</p>
  }

  const [batch, holder] = batchData
  const isBottlerAndHolder = roles.bottler && address?.toLowerCase() === holder.toLowerCase()

  if (!isBottlerAndHolder) {
    return <p>Du bist nicht berechtigt, diese Charge abzufüllen.</p>
  }

  const totalGrams = (Number(count) || 0) * JAR_SIZE_GRAMS
  const remaining = Number(batch.quantity) - totalGrams

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    if (!id || !supplyChain) return
    if (totalGrams > Number(batch.quantity)) {
      alert('Die Gläser übersteigen die verfügbare Menge.')
      return
    }
    errorRecorded.current = false
    timing.markSubmitted()
    process.mutate({ address: supplyChain, args: [id, [JAR_SIZE_GRAMS], [BigInt(count || '0')]] })
  }

  if (receipt.isSuccess) {
    return (
      <div>
        <p>Charge wurde abgefüllt.</p>
        <Link to={`/batches/${batchId}`} className="tile">Zur Charge</Link>
      </div>
    )
  }

  return (
    <div>
      <h1>Abfüllen — Charge #{batchId}</h1>
      <p>Verfügbare Menge: {(Number(batch.quantity) / 1000).toFixed(1)} kg</p>

      <form onSubmit={handleSubmit}>
        <label>
          Anzahl 500-g-Gläser
          <input type="number" value={count} onChange={(e) => setCount(e.target.value)} required min="0" step="1" />
        </label>

        <p>Verbleibend: {(remaining / 1000).toFixed(1)} kg</p>

        <button type="submit" disabled={remaining < 0 || process.isPending || receipt.isLoading}>
          {process.isPending || receipt.isLoading ? 'Wird abgefüllt...' : 'Abfüllen'}
        </button>
      </form>
    </div>
  )
}

export default ProcessAndBottle
