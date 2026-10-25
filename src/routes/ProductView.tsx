import { useState, type SubmitEvent } from 'react'
import { useChainId } from 'wagmi'
import {
  useReadProductGatewayGetBatchData,
  useReadProductGatewayGetQualityData,
  useReadProductGatewayGetPrice,
  useReadSupplyChainRetailReceiptTimestamp,
  useReadPricingModelAlpha,
  useReadPricingModelFloorPrices,
} from '../generated'
import { addresses } from '../addresses'
import ActorLabel from '../components/ActorLabel'
import { BatchDocuments } from './BatchDetail'
import { useJarCount } from '../hooks/useJarCount'

const REASON_LABELS: Record<number, string> = {
  1: 'Wassergehalt überschritten',
  2: 'Kühlkettenverletzung',
}

const QI_WEIGHT_PHQI = 0.539
const QI_WEIGHT_MCI = 0.2972
const QI_WEIGHT_SI = 0.1638

function ProductView() {
  const chainId = useChainId()
  const [inputId, setInputId] = useState('')
  const [batchId, setBatchId] = useState<bigint | undefined>(undefined)

  const productGateway = addresses[chainId as keyof typeof addresses]?.ProductGateway
  const qualityIndex = addresses[chainId as keyof typeof addresses]?.QualityIndex
  const actorRegistry = addresses[chainId as keyof typeof addresses]?.ActorRegistry
  const supplyChain = addresses[chainId as keyof typeof addresses]?.SupplyChain
  const pricingModel = addresses[chainId as keyof typeof addresses]?.PricingModel
  const enabled = Boolean(productGateway && batchId !== undefined)

  const { data: alpha } = useReadPricingModelAlpha({ address: pricingModel, query: { enabled: Boolean(pricingModel) } })
  const { data: floorPrice } = useReadPricingModelFloorPrices({
    address: pricingModel,
    args: [500],
    query: { enabled: Boolean(pricingModel) },
  })

  const retailReceiptQuery = useReadSupplyChainRetailReceiptTimestamp({
    address: supplyChain,
    args: batchId !== undefined ? [batchId] : undefined,
    query: { enabled: Boolean(supplyChain && batchId !== undefined) },
  })
  const availableAtRetail = Boolean(retailReceiptQuery.data)

  const { data: batchData } = useReadProductGatewayGetBatchData({
    address: productGateway,
    args: batchId !== undefined ? [batchId] : undefined,
    query: { enabled: enabled && availableAtRetail },
  })
  const { data: qualityData } = useReadProductGatewayGetQualityData({
    address: productGateway,
    args: batchId !== undefined ? [batchId] : undefined,
    query: { enabled: enabled && availableAtRetail },
  })
  const priceQuery = useReadProductGatewayGetPrice({
    address: productGateway,
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
      <h1>Produktansicht</h1>
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
        <ProductBatchDetails
          batchId={batchId}
          batch={batchData[0]}
          holder={batchData[1]}
          qualityData={qualityData}
          priceQuery={priceQuery}
          qualityIndex={qualityIndex}
          actorRegistry={actorRegistry}
          alpha={alpha}
          floorPrice={floorPrice}
        />
      )}
    </div>
  )
}

function ProductBatchDetails({
  batchId,
  batch,
  holder,
  qualityData,
  priceQuery,
  qualityIndex,
  actorRegistry,
  alpha,
  floorPrice,
}: {
  batchId: bigint
  batch: { harvestYear: number; beekeeper: `0x${string}`; quantity: bigint }
  holder: `0x${string}`
  qualityData: readonly [bigint, bigint, bigint, bigint, number, number]
  priceQuery: { isError: boolean; data: bigint | undefined }
  qualityIndex: `0x${string}` | undefined
  actorRegistry: `0x${string}` | undefined
  alpha: bigint | undefined
  floorPrice: bigint | undefined
}) {
  const [si, phqi, mci, qi, state, reason] = qualityData
  const jarCount = useJarCount(batchId, holder)

  const siFraction = Number(si) / 10000
  const phqiFraction = Number(phqi) / 10000
  const mciFraction = Number(mci) / 10000
  const qiFraction = Number(qi) / 10000
  const alphaFraction = alpha !== undefined ? Number(alpha) / 10000 : undefined
  const floorEuro = floorPrice !== undefined ? Number(floorPrice) / 100 : undefined

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

      <h3>Preisbildungslogik</h3>
      <p>
        QI = PHQI × {(QI_WEIGHT_PHQI * 100).toFixed(2)} % + MCI × {(QI_WEIGHT_MCI * 100).toFixed(2)} % + SI ×{' '}
        {(QI_WEIGHT_SI * 100).toFixed(2)} %
        <br />
        = {phqiFraction.toFixed(4)} × {QI_WEIGHT_PHQI} + {mciFraction.toFixed(4)} × {QI_WEIGHT_MCI} +{' '}
        {siFraction.toFixed(4)} × {QI_WEIGHT_SI} = {qiFraction.toFixed(4)}
      </p>
      {!priceQuery.isError && alphaFraction !== undefined && floorEuro !== undefined && (
        <p>
          Preis = Grundpreis × (1 + alpha × QI)
          <br />
          = {floorEuro.toFixed(2)} € × (1 + {alphaFraction} × {qiFraction.toFixed(4)}) ={' '}
          {(floorEuro * (1 + alphaFraction * qiFraction)).toFixed(2)} €
        </p>
      )}

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

export default ProductView
