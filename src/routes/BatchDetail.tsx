import { useEffect, useRef, useState } from 'react'
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
  useReadHoneyTokenProcessedBatches,
  useReadSupplyChainRetailReceiptTimestamp,
  useWriteSupplyChainRecordTransportData,
  useWriteSupplyChainRecordWarehouseData,
  useWriteSupplyChainRecordRetailReceipt,
} from '../generated'
import { addresses } from '../addresses'
import ActorLabel from '../components/ActorLabel'
import { requestLabAnalysis, requestAward, fetchSensorReading, type SensorReading } from '../simulator'
import { useRequestedAwards } from '../hooks/useRequestedAwards'
import { useMyRoles } from '../hooks/useMyRoles'
import { useJarCount } from '../hooks/useJarCount'
import { recordStep, recordError, roleLabel, errorMessage } from '../measurements'
import { useTxTiming } from '../hooks/useTxTiming'

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
  const honeyToken = addresses[chainId as keyof typeof addresses]?.HoneyToken
  const id = batchId ? BigInt(batchId) : undefined
  const enabled = Boolean(consumerGateway && id !== undefined)
  const roles = useMyRoles()

  const { data: processed } = useReadHoneyTokenProcessedBatches({
    address: honeyToken,
    args: id !== undefined ? [id] : undefined,
    query: { enabled: Boolean(honeyToken && id !== undefined) },
  })
  const { data: retailReceiptTimestamp, refetch: refetchRetailReceiptTimestamp } = useReadSupplyChainRetailReceiptTimestamp({
    address: supplyChain,
    args: id !== undefined ? [id] : undefined,
    query: { enabled: Boolean(supplyChain && id !== undefined) },
  })
  const confirmRetailReceipt = useWriteSupplyChainRecordRetailReceipt()
  const retailReceiptTxReceipt = useWaitForTransactionReceipt({ hash: confirmRetailReceipt.data })
  const retailReceiptTiming = useTxTiming(confirmRetailReceipt.data)
  const retailReceiptErrorRecorded = useRef(false)

  useEffect(() => {
    if (confirmRetailReceipt.isError && !retailReceiptErrorRecorded.current) {
      retailReceiptErrorRecorded.current = true
      recordError({
        chainId, batchId: id, step: 'recordRetailReceipt', actor: 'retailer', address,
        message: errorMessage(confirmRetailReceipt.error),
      })
    }
  }, [confirmRetailReceipt.isError])

  useEffect(() => {
    if (!retailReceiptTxReceipt.isSuccess || !retailReceiptTxReceipt.data) return
    refetchRetailReceiptTimestamp()
    if (id === undefined) return
    if (retailReceiptTxReceipt.data.status === 'reverted') {
      recordError({
        chainId, batchId: id, step: 'recordRetailReceipt', actor: 'retailer', address,
        message: 'Transaktion wurde on-chain zurückgewiesen (reverted).',
      })
      return
    }
    const { walletConfirmMs, miningMs, totalMs } = retailReceiptTiming.split()
    void recordStep({
      chainId, batchId: id, step: 'recordRetailReceipt', actor: 'retailer', address,
      txHash: retailReceiptTxReceipt.data.transactionHash, gasUsed: retailReceiptTxReceipt.data.gasUsed,
      gasPriceWei: retailReceiptTxReceipt.data.effectiveGasPrice,
      durationMs: totalMs, walletTiming: { walletConfirmMs, miningMs },
    })
  }, [retailReceiptTxReceipt.isSuccess])

  function handleConfirmRetailReceipt() {
    if (!id || !supplyChain) return
    retailReceiptErrorRecorded.current = false
    retailReceiptTiming.markSubmitted()
    confirmRetailReceipt.mutate({ address: supplyChain, args: [id] })
  }

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
  const jarCount = useJarCount(id, batchData?.[1])

  if (!batchData || !qualityData) {
    return <p>Lädt...</p>
  }

  const [batch, holder] = batchData
  const [si, phqi, mci, qi, state, reason] = qualityData
  const isBeekeeperOfThisBatch = address?.toLowerCase() === batch.beekeeper.toLowerCase()
  const isCurrentHolder = address?.toLowerCase() === holder.toLowerCase()
  const canBottle = roles.bottler && isCurrentHolder && !processed
  const canConfirmRetailReceipt = roles.retailer && isCurrentHolder && !retailReceiptTimestamp
  const hasAnyAction = isBeekeeperOfThisBatch || isCurrentHolder

  return (
    <div>
      <h1>Charge #{batchId}</h1>

      <h2>Grunddaten</h2>
      <p>Erntejahr: {batch.harvestYear}</p>
      <p>Imker: <ActorLabel address={batch.beekeeper} /></p>
      <p>Menge: {(Number(batch.quantity) / 1000).toFixed(1)} kg</p>
      <p>Aktueller Halter: <ActorLabel address={holder} /></p>

      <h2>Qualität</h2>
      <p>SI: {si.toString()}</p>
      <p>PHQI: {phqi.toString()}</p>
      <p>MCI: {mci.toString()}</p>
      <p>QI: {qi.toString()}</p>
      <p>Zustand: {STATES[state]}</p>
      <p>Grund: {REASONS[reason]}</p>

      <h2>Status</h2>
      <p>Abfüllstatus: {processed ? 'abgefüllt' : 'noch nicht abgefüllt'}</p>
      <p>Abgefüllte Gläser (500 g): {jarCount !== undefined ? jarCount.toString() : '...'}</p>
      <p>
        Wareneingang:{' '}
        {retailReceiptTimestamp
          ? new Date(Number(retailReceiptTimestamp) * 1000).toLocaleString()
          : 'noch nicht bestätigt'}
      </p>
      <p>
        Preis (500 g):{' '}
        {priceQuery.isError
          ? 'nicht verkäuflich'
          : priceQuery.data !== undefined
            ? `${(Number(priceQuery.data) / 100).toFixed(2)} €`
            : '...'}
      </p>

      {hasAnyAction && (
        <>
          <h2>Aktionen</h2>
          <p>
            {isBeekeeperOfThisBatch && (
              <>
                <Link to={`/batches/${batchId}/si`} className="tile">SI einreichen</Link>
                <Link to={`/batches/${batchId}/origin`} className="tile">Herkunft eintragen</Link>
              </>
            )}
            {isCurrentHolder && (
              <Link to={`/batches/${batchId}/transfer`} className="tile">Charge übergeben</Link>
            )}
            {canBottle && (
              <Link to={`/batches/${batchId}/bottle`} className="tile">Abfüllen</Link>
            )}
          </p>
          {canConfirmRetailReceipt && (
            <p>
              <button
                type="button"
                onClick={handleConfirmRetailReceipt}
                disabled={confirmRetailReceipt.isPending || retailReceiptTxReceipt.isLoading}
              >
                {confirmRetailReceipt.isPending || retailReceiptTxReceipt.isLoading
                  ? 'wird bestätigt...'
                  : 'Wareneingang bestätigen'}
              </button>
            </p>
          )}
          {isCurrentHolder && (
            <HandlingActions batchId={id} supplyChain={supplyChain} onReported={refetchQualityData} />
          )}
        </>
      )}

      <h2>Dokumente</h2>
      <BatchDocuments
        batchId={id}
        beekeeper={batch.beekeeper}
        qualityIndex={qualityIndex}
        actorRegistry={actorRegistry}
        isBeekeeperOfThisBatch={isBeekeeperOfThisBatch}
        canRequestLab={isBeekeeperOfThisBatch || (isCurrentHolder && state === 1)}
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
  const chainId = useChainId()
  const { address } = useConnection()
  const roles = useMyRoles()
  const recordTransport = useWriteSupplyChainRecordTransportData()
  const transportReceipt = useWaitForTransactionReceipt({ hash: recordTransport.data })
  const transportTiming = useTxTiming(recordTransport.data)
  const recordWarehouse = useWriteSupplyChainRecordWarehouseData()
  const warehouseReceipt = useWaitForTransactionReceipt({ hash: recordWarehouse.data })
  const warehouseTiming = useTxTiming(recordWarehouse.data)
  const recordDefrost = useWriteSupplyChainRecordWarehouseData()
  const defrostReceipt = useWaitForTransactionReceipt({ hash: recordDefrost.data })
  const defrostTiming = useTxTiming(recordDefrost.data)

  const [transportStatus, setTransportStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [transportResult, setTransportResult] = useState<SensorReading | null>(null)
  const [warehouseStatus, setWarehouseStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [warehouseResult, setWarehouseResult] = useState<SensorReading | null>(null)
  const [defrostStatus, setDefrostStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [defrostResult, setDefrostResult] = useState<SensorReading | null>(null)
  const transportErrorRecorded = useRef(false)
  const warehouseErrorRecorded = useRef(false)
  const defrostErrorRecorded = useRef(false)

  useEffect(() => {
    if (recordTransport.isError && !transportErrorRecorded.current) {
      transportErrorRecorded.current = true
      recordError({
        chainId, batchId, step: 'recordTransportData', actor: roleLabel(roles), address,
        message: errorMessage(recordTransport.error),
      })
    }
  }, [recordTransport.isError])
  useEffect(() => {
    if (recordWarehouse.isError && !warehouseErrorRecorded.current) {
      warehouseErrorRecorded.current = true
      recordError({
        chainId, batchId, step: 'recordWarehouseData(lager)', actor: roleLabel(roles), address,
        message: errorMessage(recordWarehouse.error),
      })
    }
  }, [recordWarehouse.isError])
  useEffect(() => {
    if (recordDefrost.isError && !defrostErrorRecorded.current) {
      defrostErrorRecorded.current = true
      recordError({
        chainId, batchId, step: 'recordWarehouseData(defrost)', actor: roleLabel(roles), address,
        message: errorMessage(recordDefrost.error),
      })
    }
  }, [recordDefrost.isError])

  useEffect(() => {
    if (!transportReceipt.isSuccess || !transportReceipt.data || batchId === undefined) return
    onReported()
    if (transportReceipt.data.status === 'reverted') {
      recordError({
        chainId, batchId, step: 'recordTransportData', actor: roleLabel(roles), address,
        message: 'Transaktion wurde on-chain zurückgewiesen (reverted).',
      })
      return
    }
    const { walletConfirmMs, miningMs, totalMs } = transportTiming.split()
    void recordStep({
      chainId, batchId, step: 'recordTransportData', actor: roleLabel(roles), address,
      txHash: transportReceipt.data.transactionHash, gasUsed: transportReceipt.data.gasUsed,
      gasPriceWei: transportReceipt.data.effectiveGasPrice,
      durationMs: totalMs, walletTiming: { walletConfirmMs, miningMs },
    })
  }, [transportReceipt.isSuccess])
  useEffect(() => {
    if (!warehouseReceipt.isSuccess || !warehouseReceipt.data || batchId === undefined) return
    onReported()
    if (warehouseReceipt.data.status === 'reverted') {
      recordError({
        chainId, batchId, step: 'recordWarehouseData(lager)', actor: roleLabel(roles), address,
        message: 'Transaktion wurde on-chain zurückgewiesen (reverted).',
      })
      return
    }
    const { walletConfirmMs, miningMs, totalMs } = warehouseTiming.split()
    void recordStep({
      chainId, batchId, step: 'recordWarehouseData(lager)', actor: roleLabel(roles), address,
      txHash: warehouseReceipt.data.transactionHash, gasUsed: warehouseReceipt.data.gasUsed,
      gasPriceWei: warehouseReceipt.data.effectiveGasPrice,
      durationMs: totalMs, walletTiming: { walletConfirmMs, miningMs },
    })
  }, [warehouseReceipt.isSuccess])
  useEffect(() => {
    if (!defrostReceipt.isSuccess || !defrostReceipt.data || batchId === undefined) return
    onReported()
    if (defrostReceipt.data.status === 'reverted') {
      recordError({
        chainId, batchId, step: 'recordWarehouseData(defrost)', actor: roleLabel(roles), address,
        message: 'Transaktion wurde on-chain zurückgewiesen (reverted).',
      })
      return
    }
    const { walletConfirmMs, miningMs, totalMs } = defrostTiming.split()
    void recordStep({
      chainId, batchId, step: 'recordWarehouseData(defrost)', actor: roleLabel(roles), address,
      txHash: defrostReceipt.data.transactionHash, gasUsed: defrostReceipt.data.gasUsed,
      gasPriceWei: defrostReceipt.data.effectiveGasPrice,
      durationMs: totalMs, walletTiming: { walletConfirmMs, miningMs },
    })
  }, [defrostReceipt.isSuccess])

  async function handleTransport() {
    if (batchId === undefined || !supplyChain) return
    setTransportStatus('loading')
    try {
      const reading = await fetchSensorReading('transport')
      setTransportResult(reading)
      transportErrorRecorded.current = false
      transportTiming.markSubmitted()
      recordTransport.mutate({
        address: supplyChain,
        args: [batchId, BigInt(reading.temperatureCelsius), BigInt(reading.durationMinutes)],
      })
      setTransportStatus('idle')
    } catch (err) {
      setTransportStatus('error')
      recordError({
        chainId, batchId, step: 'recordTransportData', actor: roleLabel(roles), address,
        message: err instanceof Error ? err.message : 'Sensordaten-Anfrage fehlgeschlagen.',
      })
    }
  }

  async function handleWarehouse() {
    if (batchId === undefined || !supplyChain) return
    setWarehouseStatus('loading')
    try {
      const reading = await fetchSensorReading('warehouse')
      setWarehouseResult(reading)
      warehouseErrorRecorded.current = false
      warehouseTiming.markSubmitted()
      recordWarehouse.mutate({
        address: supplyChain,
        args: [batchId, BigInt(reading.temperatureCelsius), BigInt(reading.durationMinutes)],
      })
      setWarehouseStatus('idle')
    } catch (err) {
      setWarehouseStatus('error')
      recordError({
        chainId, batchId, step: 'recordWarehouseData(lager)', actor: roleLabel(roles), address,
        message: err instanceof Error ? err.message : 'Sensordaten-Anfrage fehlgeschlagen.',
      })
    }
  }

  async function handleDefrost() {
    if (batchId === undefined || !supplyChain) return
    setDefrostStatus('loading')
    try {
      const reading = await fetchSensorReading('defrost')
      setDefrostResult(reading)
      defrostErrorRecorded.current = false
      defrostTiming.markSubmitted()
      recordDefrost.mutate({
        address: supplyChain,
        args: [batchId, BigInt(reading.temperatureCelsius), BigInt(reading.durationMinutes)],
      })
      setDefrostStatus('idle')
    } catch (err) {
      setDefrostStatus('error')
      recordError({
        chainId, batchId, step: 'recordWarehouseData(defrost)', actor: roleLabel(roles), address,
        message: err instanceof Error ? err.message : 'Sensordaten-Anfrage fehlgeschlagen.',
      })
    }
  }

  return (
    <div>
      <p>
        <button type="button" onClick={handleTransport} disabled={transportStatus === 'loading'}>
          {transportStatus === 'loading' ? 'wird gemeldet...' : 'Transportbedingungen melden'}
        </button>
        {transportResult && <>{' '}— {describeReading(transportResult)}</>}
      </p>
      {transportStatus === 'error' && <p>Transportbedingungen melden fehlgeschlagen.</p>}
      <p>
        <button type="button" onClick={handleWarehouse} disabled={warehouseStatus === 'loading'}>
          {warehouseStatus === 'loading' ? 'wird gemeldet...' : 'Lagerbedingungen melden'}
        </button>
        {warehouseResult && <>{' '}— {describeReading(warehouseResult)}</>}
      </p>
      {warehouseStatus === 'error' && <p>Lagerbedingungen melden fehlgeschlagen.</p>}
      <p>
        <button type="button" onClick={handleDefrost} disabled={defrostStatus === 'loading'}>
          {defrostStatus === 'loading' ? 'wird gemeldet...' : 'Auftauen melden'}
        </button>
        {defrostResult && <>{' '}— {describeReading(defrostResult)}</>}
      </p>
      {defrostStatus === 'error' && <p>Auftauen melden fehlgeschlagen.</p>}
    </div>
  )
}

function describeReading(reading: SensorReading): string {
  return reading.violation
    ? `Temperaturverletzung! ${reading.temperatureCelsius} °C, ${reading.durationMinutes} min`
    : 'keine Temperaturverletzung'
}

export function BatchDocuments({
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
  const chainId = useChainId()
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
      const result = await requestLabAnalysis(Number(batchId))
      await refetchLabReportCid()
      onQualityChanged()
      void recordStep({
        chainId, batchId, step: 'labAnalysis', actor: 'lab',
        txHash: result.transactionHash, gasUsed: BigInt(result.gasUsed),
        durationMs: result.timings.renderMs + result.timings.uploadMs + result.timings.chainMs,
        timings: result.timings, note: result.ipfsCid ? `cid=${result.ipfsCid}` : '',
      })
      setLabStatus('idle')
    } catch (err) {
      setLabStatus('error')
      recordError({
        chainId, batchId, step: 'labAnalysis', actor: 'lab',
        message: err instanceof Error ? err.message : 'Laboranalyse-Anfrage fehlgeschlagen.',
      })
    }
  }

  async function handleRequestAward() {
    if (batchId === undefined) return
    setAwardStatus('loading')
    try {
      const result = await requestAward(Number(batchId))
      await refetchAwardCertificateCid()
      markRequested(Number(batchId))
      onQualityChanged()
      void recordStep({
        chainId, batchId, step: 'award', actor: 'awardBody',
        txHash: result.transactionHash, gasUsed: BigInt(result.gasUsed),
        durationMs: result.timings.renderMs + result.timings.uploadMs + result.timings.chainMs,
        timings: result.timings, note: result.ipfsCid ? `cid=${result.ipfsCid}` : '',
      })
      setAwardStatus('idle')
    } catch (err) {
      setAwardStatus('error')
      recordError({
        chainId, batchId, step: 'award', actor: 'awardBody',
        message: err instanceof Error ? err.message : 'Prämierungs-Anfrage fehlgeschlagen.',
      })
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
