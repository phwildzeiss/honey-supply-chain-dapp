import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useChainId, useConnection, useWaitForTransactionReceipt } from 'wagmi'
import {
  useReadConsumerGatewayGetBatchData,
  useReadConsumerGatewayGetPrice,
  useReadConsumerGatewayGetQualityData,
  useReadQualityIndexPhqiReportCid,
  useReadQualityIndexAwardCertificateCid,
  useReadQualityIndexOriginCid,
  useReadActorRegistryCertifications,
  useWriteSupplyChainRecordTransportData,
  useWriteSupplyChainRecordWarehouseData,
} from '../generated'
import { addresses } from '../addresses'
import ActorLabel from '../components/ActorLabel'
import { requestLabAnalysis, requestAward, fetchSensorReading, type SensorReading } from '../simulator'
import { useRequestedAwards } from '../hooks/useRequestedAwards'

const STATES = ['Active', 'RetestRequired', 'NotSellable']
const REASONS = ['None', 'WaterContentExceeded', 'TemperatureViolation']
const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/'

function BatchDetail() {
  const { batchId } = useParams()
  const chainId = useChainId()
  const { address } = useConnection()
  const consumerGateway = addresses[chainId as keyof typeof addresses]?.ConsumerGateway
  const qualityIndex = addresses[chainId as keyof typeof addresses]?.QualityIndex
  const actorRegistry = addresses[chainId as keyof typeof addresses]?.ActorRegistry
  const supplyChain = addresses[chainId as keyof typeof addresses]?.SupplyChain
  const id = batchId ? BigInt(batchId) : undefined
  const enabled = Boolean(consumerGateway && id !== undefined)

  const { data: batchData } = useReadConsumerGatewayGetBatchData({
    address: consumerGateway,
    args: id !== undefined ? [id] : undefined,
    query: { enabled },
  })
  const { data: qualityData, refetch: refetchQualityData } = useReadConsumerGatewayGetQualityData({
    address: consumerGateway,
    args: id !== undefined ? [id] : undefined,
    query: { enabled },
  })
  const priceQuery = useReadConsumerGatewayGetPrice({
    address: consumerGateway,
    args: id !== undefined ? [id, 500] : undefined,
    query: { enabled },
  })

  if (!batchData || !qualityData) {
    return <p>Lädt...</p>
  }

  const [batch, holder] = batchData
  const [si, phqi, mci, qi, state, reason] = qualityData

  return (
    <div>
      <h1>Charge #{batchId}</h1>
      <p>Erntejahr: {batch.harvestYear}</p>
      <p>Imker: <ActorLabel address={batch.beekeeper} /></p>
      <p>Menge: {(Number(batch.quantity) / 1000).toFixed(1)} kg</p>
      <p>Aktueller Halter: <ActorLabel address={holder} /></p>
      <p>SI: {si.toString()}</p>
      <p>PHQI: {phqi.toString()}</p>
      <p>MCI: {mci.toString()}</p>
      <p>QI: {qi.toString()}</p>
      <p>Zustand: {STATES[state]}</p>
      <p>Grund: {REASONS[reason]}</p>
      <p>
        Preis (500 g):{' '}
        {priceQuery.isError
          ? 'nicht verkäuflich'
          : priceQuery.data !== undefined
            ? `${(Number(priceQuery.data) / 100).toFixed(2)} €`
            : '...'}
      </p>
      {address?.toLowerCase() === batch.beekeeper.toLowerCase() && (
        <p>
          <Link to={`/batches/${batchId}/si`}>SI einreichen</Link>{' '}
          <Link to={`/batches/${batchId}/origin`}>Herkunft eintragen</Link>
        </p>
      )}
      {address?.toLowerCase() === holder.toLowerCase() && (
        <>
          <p>
            <Link to={`/batches/${batchId}/transfer`}>Charge übergeben</Link>
          </p>
          <HandlingActions batchId={id} supplyChain={supplyChain} onReported={refetchQualityData} />
        </>
      )}
      <BatchDocuments
        batchId={id}
        beekeeper={batch.beekeeper}
        qualityIndex={qualityIndex}
        actorRegistry={actorRegistry}
        isBeekeeperOfThisBatch={address?.toLowerCase() === batch.beekeeper.toLowerCase()}
        canRequestLab={
          address?.toLowerCase() === batch.beekeeper.toLowerCase() ||
          (address?.toLowerCase() === holder.toLowerCase() && state === 1)
        }
        onQualityChanged={refetchQualityData}
        state={state}
      />
    </div>
  )
}

function HandlingActions({
  batchId,
  supplyChain,
  onReported,
}: {
  batchId: bigint | undefined
  supplyChain: `0x${string}` | undefined
  onReported: () => void
}) {
  const recordTransport = useWriteSupplyChainRecordTransportData()
  const transportReceipt = useWaitForTransactionReceipt({ hash: recordTransport.data })
  const recordWarehouse = useWriteSupplyChainRecordWarehouseData()
  const warehouseReceipt = useWaitForTransactionReceipt({ hash: recordWarehouse.data })
  const recordDefrost = useWriteSupplyChainRecordWarehouseData()
  const defrostReceipt = useWaitForTransactionReceipt({ hash: recordDefrost.data })

  const [transportStatus, setTransportStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [transportResult, setTransportResult] = useState<SensorReading | null>(null)
  const [warehouseStatus, setWarehouseStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [warehouseResult, setWarehouseResult] = useState<SensorReading | null>(null)
  const [defrostStatus, setDefrostStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [defrostResult, setDefrostResult] = useState<SensorReading | null>(null)

  useEffect(() => {
    if (transportReceipt.isSuccess) onReported()
  }, [transportReceipt.isSuccess])
  useEffect(() => {
    if (warehouseReceipt.isSuccess) onReported()
  }, [warehouseReceipt.isSuccess])
  useEffect(() => {
    if (defrostReceipt.isSuccess) onReported()
  }, [defrostReceipt.isSuccess])

  async function handleTransport() {
    if (batchId === undefined || !supplyChain) return
    setTransportStatus('loading')
    try {
      const reading = await fetchSensorReading('transport')
      setTransportResult(reading)
      recordTransport.mutate({
        address: supplyChain,
        args: [batchId, BigInt(reading.temperatureCelsius), BigInt(reading.durationMinutes)],
      })
      setTransportStatus('idle')
    } catch {
      setTransportStatus('error')
    }
  }

  async function handleWarehouse() {
    if (batchId === undefined || !supplyChain) return
    setWarehouseStatus('loading')
    try {
      const reading = await fetchSensorReading('warehouse')
      setWarehouseResult(reading)
      recordWarehouse.mutate({
        address: supplyChain,
        args: [batchId, BigInt(reading.temperatureCelsius), BigInt(reading.durationMinutes)],
      })
      setWarehouseStatus('idle')
    } catch {
      setWarehouseStatus('error')
    }
  }

  async function handleDefrost() {
    if (batchId === undefined || !supplyChain) return
    setDefrostStatus('loading')
    try {
      const reading = await fetchSensorReading('defrost')
      setDefrostResult(reading)
      recordDefrost.mutate({
        address: supplyChain,
        args: [batchId, BigInt(reading.temperatureCelsius), BigInt(reading.durationMinutes)],
      })
      setDefrostStatus('idle')
    } catch {
      setDefrostStatus('error')
    }
  }

  return (
    <div>
      <p>
        <button type="button" onClick={handleTransport} disabled={transportStatus === 'loading'}>
          {transportStatus === 'loading' ? 'wird gemeldet...' : 'Transportbedingungen melden'}
        </button>
        {transportResult && (
          <>
            {' '}— {transportResult.temperatureCelsius} °C, {transportResult.durationMinutes} min
            {transportResult.violation ? ' (Verletzung!)' : ''}
          </>
        )}
      </p>
      {transportStatus === 'error' && <p>Transportbedingungen melden fehlgeschlagen.</p>}
      <p>
        <button type="button" onClick={handleWarehouse} disabled={warehouseStatus === 'loading'}>
          {warehouseStatus === 'loading' ? 'wird gemeldet...' : 'Lagerbedingungen melden'}
        </button>
        {warehouseResult && (
          <>
            {' '}— {warehouseResult.temperatureCelsius} °C, {warehouseResult.durationMinutes} min
            {warehouseResult.violation ? ' (Verletzung!)' : ''}
          </>
        )}
      </p>
      {warehouseStatus === 'error' && <p>Lagerbedingungen melden fehlgeschlagen.</p>}
      <p>
        <button type="button" onClick={handleDefrost} disabled={defrostStatus === 'loading'}>
          {defrostStatus === 'loading' ? 'wird gemeldet...' : 'Auftauen melden'}
        </button>
        {defrostResult && (
          <>
            {' '}— {defrostResult.temperatureCelsius} °C, {defrostResult.durationMinutes} min
            {defrostResult.violation ? ' (Verletzung!)' : ''}
          </>
        )}
      </p>
      {defrostStatus === 'error' && <p>Auftauen melden fehlgeschlagen.</p>}
    </div>
  )
}

function BatchDocuments({
  batchId,
  beekeeper,
  qualityIndex,
  actorRegistry,
  isBeekeeperOfThisBatch,
  canRequestLab,
  onQualityChanged,
  state,
}: {
  batchId: bigint | undefined
  beekeeper: `0x${string}`
  qualityIndex: `0x${string}` | undefined
  actorRegistry: `0x${string}` | undefined
  isBeekeeperOfThisBatch: boolean
  canRequestLab: boolean
  onQualityChanged: () => void
  state: number
}) {
  const [labStatus, setLabStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [awardStatus, setAwardStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const { isRequested, markRequested } = useRequestedAwards()

  const { data: labReportCid, refetch: refetchLabReportCid } = useReadQualityIndexPhqiReportCid({
    address: qualityIndex,
    args: batchId !== undefined ? [batchId] : undefined,
    query: { enabled: Boolean(qualityIndex && batchId !== undefined) },
  })
  const { data: awardCertificateCid, refetch: refetchAwardCertificateCid } = useReadQualityIndexAwardCertificateCid({
    address: qualityIndex,
    args: batchId !== undefined ? [batchId] : undefined,
    query: { enabled: Boolean(qualityIndex && batchId !== undefined) },
  })

  async function handleRequestLab() {
    if (batchId === undefined) return
    setLabStatus('loading')
    try {
      await requestLabAnalysis(Number(batchId))
      await refetchLabReportCid()
      onQualityChanged()
      setLabStatus('idle')
    } catch {
      setLabStatus('error')
    }
  }

  async function handleRequestAward() {
    if (batchId === undefined) return
    setAwardStatus('loading')
    try {
      await requestAward(Number(batchId))
      await refetchAwardCertificateCid()
      markRequested(Number(batchId))
      onQualityChanged()
      setAwardStatus('idle')
    } catch {
      setAwardStatus('error')
    }
  }
  const { data: certificationData } = useReadActorRegistryCertifications({
    address: actorRegistry,
    args: [beekeeper],
    query: { enabled: Boolean(actorRegistry) },
  })
  const [beekeeperCertCid] = certificationData ?? ['']
  const { data: originCid } = useReadQualityIndexOriginCid({
    address: qualityIndex,
    args: batchId !== undefined ? [batchId] : undefined,
    query: { enabled: Boolean(qualityIndex && batchId !== undefined) },
  })

  return (
    <>
      <p>
        Herkunftsangabe:{' '}
        {originCid ? (
          <a href={IPFS_GATEWAY + originCid} target="_blank" rel="noreferrer">
            ansehen
          </a>
        ) : (
          'noch nicht eingetragen'
        )}
      </p>
      <p>
        Laboranalyse:{' '}
        {labReportCid ? (
          <a href={IPFS_GATEWAY + labReportCid} target="_blank" rel="noreferrer">
            ansehen
          </a>
        ) : (
          'noch nicht vorhanden'
        )}
        {canRequestLab && (!labReportCid || state === 1) && (
          <>
            {' '}
            <button type="button" onClick={handleRequestLab} disabled={labStatus === 'loading'}>
              {labStatus === 'loading' ? 'wird angefordert...' : 'anfordern'}
            </button>
          </>
        )}
      </p>
      {labStatus === 'error' && <p>Laboranalyse anfordern fehlgeschlagen.</p>}
      <p>
        Prämierungsurkunde:{' '}
        {awardCertificateCid ? (
          <a href={IPFS_GATEWAY + awardCertificateCid} target="_blank" rel="noreferrer">
            ansehen
          </a>
        ) : batchId !== undefined && isRequested(Number(batchId)) ? (
          'keine Prämierung erhalten'
        ) : (
          'noch nicht angefordert'
        )}
        {isBeekeeperOfThisBatch && !awardCertificateCid && !(batchId !== undefined && isRequested(Number(batchId))) && (
          <>
            {' '}
            <button type="button" onClick={handleRequestAward} disabled={awardStatus === 'loading'}>
              {awardStatus === 'loading' ? 'wird angefordert...' : 'anfordern'}
            </button>
          </>
        )}
      </p>
      {awardStatus === 'error' && <p>Prämierung anfordern fehlgeschlagen.</p>}
      <p>
        Zertifikat des Imkers:{' '}
        {beekeeperCertCid ? (
          <a href={IPFS_GATEWAY + beekeeperCertCid} target="_blank" rel="noreferrer">
            ansehen
          </a>
        ) : (
          'nicht zertifiziert'
        )}
      </p>
    </>
  )
}

export default BatchDetail
