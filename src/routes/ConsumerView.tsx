import { useState, type SubmitEvent } from 'react'
import { useChainId } from 'wagmi'
import {
  useReadConsumerGatewayGetBatchData,
  useReadConsumerGatewayGetQualityData,
  useReadConsumerGatewayGetPrice,
  useReadSupplyChainRetailReceiptTimestamp,
} from '../generated'
import { addresses } from '../addresses'
import ActorLabel from '../components/ActorLabel'
import { BatchDocuments } from './BatchDetail'
import { useJarCount } from '../hooks/useJarCount'

const REASON_LABELS: Record<number, string> = {
  1: 'Wassergehalt überschritten',
  2: 'Kühlkettenverletzung',
}

function ConsumerView() {
  const chainId = useChainId()
  const [inputId, setInputId] = useState('')
  const [batchId, setBatchId] = useState<bigint | undefined>(undefined)

  const consumerGateway = addresses[chainId as keyof typeof addresses]?.ConsumerGateway
  const qualityIndex = addresses[chainId as keyof typeof addresses]?.QualityIndex
  const actorRegistry = addresses[chainId as keyof typeof addresses]?.ActorRegistry
  const supplyChain = addresses[chainId as keyof typeof addresses]?.SupplyChain
  const enabled = Boolean(consumerGateway && batchId !== undefined)

  const retailReceiptQuery = useReadSupplyChainRetailReceiptTimestamp({
    address: supplyChain,
    args: batchId !== undefined ? [batchId] : undefined,
    query: { enabled: Boolean(supplyChain && batchId !== undefined) },
  })
  const availableAtRetail = Boolean(retailReceiptQuery.data)

  const { data: batchData } = useReadConsumerGatewayGetBatchData({
    address: consumerGateway,
    args: batchId !== undefined ? [batchId] : undefined,
    query: { enabled: enabled && availableAtRetail },
  })
  const { data: qualityData } = useReadConsumerGatewayGetQualityData({
    address: consumerGateway,
    args: batchId !== undefined ? [batchId] : undefined,
    query: { enabled: enabled && availableAtRetail },
  })
  const priceQuery = useReadConsumerGatewayGetPrice({
    address: consumerGateway,
    args: batchId !== undefined ? [batchId, 500] : undefined,
    query: { enabled: enabled && availableAtRetail },
  })

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    if (!inputId) return
    setBatchId(BigInt(inputId))
  }

  return (
    <div>
      <h1>Honig-Herkunft prüfen</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Chargen-Nummer
          <input value={inputId} onChange={(e) => setInputId(e.target.value)} required />
        </label>
        <button type="submit">Anzeigen</button>
      </form>

      {batchId !== undefined && retailReceiptQuery.isLoading && <p>Lädt...</p>}

      {batchId !== undefined && !retailReceiptQuery.isLoading && !availableAtRetail && (
        <p>Diese Charge ist noch nicht im Handel erhältlich.</p>
      )}

      {batchId !== undefined && availableAtRetail && (!batchData || !qualityData) && <p>Lädt...</p>}

      {batchId !== undefined && availableAtRetail && batchData && qualityData && (
        <ConsumerBatchDetails
          batchId={batchId}
          batch={batchData[0]}
          holder={batchData[1]}
          qualityData={qualityData}
          priceQuery={priceQuery}
          qualityIndex={qualityIndex}
          actorRegistry={actorRegistry}
        />
      )}
    </div>
  )
}

function ConsumerBatchDetails({
  batchId,
  batch,
  holder,
  qualityData,
  priceQuery,
  qualityIndex,
  actorRegistry,
}: {
  batchId: bigint
  batch: { harvestYear: number; beekeeper: `0x${string}`; quantity: bigint }
  holder: `0x${string}`
  qualityData: readonly [bigint, bigint, bigint, bigint, number, number]
  priceQuery: { isError: boolean; data: bigint | undefined }
  qualityIndex: `0x${string}` | undefined
  actorRegistry: `0x${string}` | undefined
}) {
  const [si, phqi, mci, qi, state, reason] = qualityData
  const jarCount = useJarCount(batchId, holder)

  return (
    <div>
      <h2>Charge #{batchId.toString()}</h2>

      <h3>Grunddaten</h3>
      <p>Erntejahr: {batch.harvestYear}</p>
      <p>Imker: <ActorLabel address={batch.beekeeper} /></p>
      <p>Menge: {(Number(batch.quantity) / 1000).toFixed(1)} kg</p>
      <p>Aktueller Halter: <ActorLabel address={holder} /></p>

      <h3>Qualität</h3>
      <p>SI: {si.toString()}</p>
      <p>PHQI: {phqi.toString()}</p>
      <p>MCI: {mci.toString()}</p>
      <p>QI: {qi.toString()}</p>
      <p>
        Qualitätsstatus:{' '}
        {state === 0
          ? 'unauffällig'
          : state === 1
            ? `Erneute Prüfung angefordert (${REASON_LABELS[reason]})`
            : `Nicht verkäuflich (${REASON_LABELS[reason]})`}
      </p>

      <h3>Status</h3>
      <p>Abgefüllte Gläser (500 g): {jarCount !== undefined ? jarCount.toString() : '...'}</p>
      <p>
        Preis (500 g):{' '}
        {priceQuery.isError
          ? 'nicht verkäuflich'
          : priceQuery.data !== undefined
            ? `${(Number(priceQuery.data) / 100).toFixed(2)} €`
            : '...'}
      </p>

      <h3>Dokumente</h3>
      <BatchDocuments
        batchId={batchId}
        beekeeper={batch.beekeeper}
        qualityIndex={qualityIndex}
        actorRegistry={actorRegistry}
        isBeekeeperOfThisBatch={false}
        canRequestLab={false}
        onQualityChanged={() => {}}
        state={state}
      />
    </div>
  )
}

export default ConsumerView
