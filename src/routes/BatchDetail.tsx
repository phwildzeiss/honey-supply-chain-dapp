import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useChainId, useConnection, usePublicClient, useWaitForTransactionReceipt } from 'wagmi'
import {
  useReadProductGatewayGetBatchData,
  useReadProductGatewayGetPrice,
  useReadProductGatewayGetQualityData,
  useReadQualityIndexPhqiReportCid,
  useReadQualityIndexAwardCertificateCid,
  useReadActorRegistryCertifications,
  useReadHoneyTokenProcessedBatches,
  useReadSupplyChainRetailReceiptTimestamp,
  useWriteSupplyChainRecordTransportData,
  useWriteSupplyChainRecordWarehouseData,
  useWriteSupplyChainRecordRetailReceipt,
  qualityIndexAbi,
} from '../generated'
import { addresses } from '../addresses'
import ActorLabel from '../components/ActorLabel'
import {
  requestLabAnalysis, requestAward, fetchSensorReading,
  type SensorReading, type SensorForce, type LabForce, type AwardForce, type LabReportData,
} from '../simulator'
import { useRequestedAwards } from '../hooks/useRequestedAwards'
import { useMyRoles } from '../hooks/useMyRoles'
import { useJarCount } from '../hooks/useJarCount'
import { useOriginPlaces } from '../hooks/useOriginPlaces'
import { recordStep, recordError, roleLabel, errorMessage } from '../measurements'
import { useTxTiming } from '../hooks/useTxTiming'
import { getFreshNonce } from '../nonce'
import { useActiveScenario } from '../scenario'

const STATES = ['Active', 'RetestRequired', 'NotSellable']
const REASONS = ['None', 'WaterContentExceeded', 'TemperatureViolation']
const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/'

function labReportStorageKey(batchId: bigint): string {
  return `labReport:${batchId.toString()}`
}

function loadLastReportData(batchId: bigint): LabReportData | undefined {
  try {
    const raw = sessionStorage.getItem(labReportStorageKey(batchId))
    return raw ? (JSON.parse(raw) as LabReportData) : undefined
  } catch {
    return undefined
  }
}

function saveLastReportData(batchId: bigint, data: LabReportData): void {
  try {
    sessionStorage.setItem(labReportStorageKey(batchId), JSON.stringify(data))
  } catch {
  }
}

function BatchDetail() {
  const { batchId } = useParams()
  const chainId = useChainId()
  const { address } = useConnection()
  const productGateway = addresses[chainId as keyof typeof addresses]?.ProductGateway
  const qualityIndex = addresses[chainId as keyof typeof addresses]?.QualityIndex
  const actorRegistry = addresses[chainId as keyof typeof addresses]?.ActorRegistry
  const supplyChain = addresses[chainId as keyof typeof addresses]?.SupplyChain
  const honeyToken = addresses[chainId as keyof typeof addresses]?.HoneyToken
  const id = batchId ? BigInt(batchId) : undefined
  const enabled = Boolean(productGateway && id !== undefined)
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

  async function handleConfirmRetailReceipt() {
    if (!id || !supplyChain) return
    retailReceiptErrorRecorded.current = false
    retailReceiptTiming.markSubmitted()
    const nonce = await getFreshNonce(address as `0x${string}` | undefined)
    confirmRetailReceipt.mutate({ address: supplyChain, args: [id], nonce })
  }

  const { data: batchData } = useReadProductGatewayGetBatchData({
    address: productGateway,
    args: id !== undefined ? [id] : undefined,
    query: { enabled },
  })
  const { data: qualityData, refetch: refetchQualityData } = useReadProductGatewayGetQualityData({
    address: productGateway,
    args: id !== undefined ? [id] : undefined,
    query: { enabled },
  })
  const priceQuery = useReadProductGatewayGetPrice({
    address: productGateway,
    args: id !== undefined ? [id, 500] : undefined,
    query: { enabled },
  })
  const jarCount = useJarCount(id, batchData?.[1])
  const originPlaces = useOriginPlaces(id)

  if (!batchData || !qualityData) {
    return <p>Lädt...</p>
  }

  const [batch, holder] = batchData
  const [si, phqi, mci, qi, state, reason] = qualityData
  // Contract-Skala ist 0-10000 (SCALE in QualityIndex.sol); die Arbeit stellt SI/PHQI/MCI/QI
  // durchgehend als Dezimalwert 0-1 dar (z.B. Tabelle 5.7: 0,836), nicht als Ganzzahl oder Prozent.
  const siFraction = Number(si) / 10000
  const phqiFraction = Number(phqi) / 10000
  const mciFraction = Number(mci) / 10000
  const qiFraction = Number(qi) / 10000
  const isBeekeeperOfThisBatch = address?.toLowerCase() === batch.beekeeper.toLowerCase()
  const isCurrentHolder = address?.toLowerCase() === holder.toLowerCase()
  const canBottle = roles.bottler && isCurrentHolder && !processed
  const canConfirmRetailReceipt = roles.retailer && isCurrentHolder && !retailReceiptTimestamp
  const hasAnyAction = isBeekeeperOfThisBatch || isCurrentHolder
  const blockReason =
    state === 1 ? 'Erst wieder möglich, sobald die Laboranalyse nach der Temperaturverletzung bestätigt wurde.'
      : state === 2 ? 'Nicht möglich: Die Charge ist dauerhaft nicht verkäuflich.'
      : null

  return (
    <div>
      <h1>Charge #{batchId}</h1>

      <h2>Grunddaten</h2>
      <p>Erntejahr: {batch.harvestYear}</p>
      <p>Imker: <ActorLabel address={batch.beekeeper} /></p>
      <p>Menge: {(Number(batch.quantity) / 1000).toFixed(1)} kg</p>
      <p>Aktueller Halter: <ActorLabel address={holder} /></p>
      <p>Herkunft: {originPlaces ? (originPlaces.length > 0 ? originPlaces.join(', ') : 'noch nicht eingetragen') : '...'}</p>

      <h2>Qualität</h2>
      <p>SI: {siFraction.toFixed(4)}</p>
      <p>PHQI: {phqiFraction.toFixed(4)}</p>
      <p>MCI: {mciFraction.toFixed(4)}</p>
      <p>QI: {qiFraction.toFixed(4)}</p>
      <p>Zustand: {state === 0 ? STATES[state] : <span className="state-warning">{STATES[state]}</span>}</p>
      <p>Grund: {reason === 0 ? REASONS[reason] : <span className="state-warning">{REASONS[reason]}</span>}</p>

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
      <p>
        <Link to={`/product/${batchId}`} state={{ fromApp: true }} className="tile">Produktansicht öffnen</Link>
      </p>

      {hasAnyAction && (
        <>
          <h2>Aktionen</h2>
          <p>
            {isBeekeeperOfThisBatch && (
              <>
                <Link to={`/batches/${batchId}/si`} className="tile">Standortdaten einreichen</Link>
                <Link to={`/batches/${batchId}/origin`} className="tile">Herkunft einreichen</Link>
              </>
            )}
            {isCurrentHolder && (
              blockReason ? (
                <span className="tile-disabled" title={blockReason}>
                  Charge übergeben
                </span>
              ) : (
                <Link to={`/batches/${batchId}/transfer`} className="tile">Charge übergeben</Link>
              )
            )}
            {canBottle && (
              blockReason ? (
                <span className="tile-disabled" title={blockReason}>
                  Abfüllen
                </span>
              ) : (
                <Link to={`/batches/${batchId}/bottle`} className="tile">Abfüllen</Link>
              )
            )}
          </p>
          {canConfirmRetailReceipt && (
            blockReason ? (
              <p>
                <span className="tile-disabled" title={blockReason}>
                  Wareneingang bestätigen
                </span>
              </p>
            ) : (
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
            )
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
  const { isDev, scenario } = useActiveScenario()
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
  const [transportForce, setTransportForce] = useState<SensorForce | ''>('')
  const [warehouseStatus, setWarehouseStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [warehouseResult, setWarehouseResult] = useState<SensorReading | null>(null)
  const [warehouseForce, setWarehouseForce] = useState<SensorForce | ''>('')
  const [defrostStatus, setDefrostStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [defrostResult, setDefrostResult] = useState<SensorReading | null>(null)
  const [defrostForce, setDefrostForce] = useState<SensorForce | ''>('')
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
      const reading = await fetchSensorReading('transport', isDev ? (transportForce || undefined) : scenario.force.transport)
      setTransportResult(reading)
      transportErrorRecorded.current = false
      transportTiming.markSubmitted()
      const nonce = await getFreshNonce(address as `0x${string}` | undefined)
      recordTransport.mutate({
        address: supplyChain,
        args: [batchId, BigInt(reading.temperatureCelsius), BigInt(reading.durationMinutes)],
        nonce,
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
      const reading = await fetchSensorReading('warehouse', isDev ? (warehouseForce || undefined) : scenario.force.warehouse)
      setWarehouseResult(reading)
      warehouseErrorRecorded.current = false
      warehouseTiming.markSubmitted()
      const nonce = await getFreshNonce(address as `0x${string}` | undefined)
      recordWarehouse.mutate({
        address: supplyChain,
        args: [batchId, BigInt(reading.temperatureCelsius), BigInt(reading.durationMinutes)],
        nonce,
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
      const reading = await fetchSensorReading('defrost', isDev ? (defrostForce || undefined) : scenario.force.defrost)
      setDefrostResult(reading)
      defrostErrorRecorded.current = false
      defrostTiming.markSubmitted()
      const nonce = await getFreshNonce(address as `0x${string}` | undefined)
      recordDefrost.mutate({
        address: supplyChain,
        args: [batchId, BigInt(reading.temperatureCelsius), BigInt(reading.durationMinutes)],
        nonce,
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
        {isDev && (
          <select value={transportForce} onChange={(e) => setTransportForce(e.target.value as SensorForce | '')}>
            <option value="">Zufällig</option>
            <option value="NORMAL">Normal erzwingen</option>
            <option value="VIOLATION">Verletzung erzwingen</option>
          </select>
        )}
        <button type="button" onClick={handleTransport} disabled={transportStatus === 'loading'}>
          {transportStatus === 'loading' ? 'wird gemeldet...' : 'Transportbedingungen melden'}
        </button>
        {transportResult && <span className="reading-result"> — {describeReading(transportResult)}</span>}
      </p>
      {transportStatus === 'error' && <p>Transportbedingungen melden fehlgeschlagen.</p>}
      <p>
        {isDev && (
          <select value={warehouseForce} onChange={(e) => setWarehouseForce(e.target.value as SensorForce | '')}>
            <option value="">Zufällig</option>
            <option value="NORMAL">Normal erzwingen</option>
            <option value="VIOLATION">Verletzung erzwingen</option>
          </select>
        )}
        <button type="button" onClick={handleWarehouse} disabled={warehouseStatus === 'loading'}>
          {warehouseStatus === 'loading' ? 'wird gemeldet...' : 'Lagerbedingungen melden'}
        </button>
        {warehouseResult && <span className="reading-result"> — {describeReading(warehouseResult)}</span>}
      </p>
      {warehouseStatus === 'error' && <p>Lagerbedingungen melden fehlgeschlagen.</p>}
      <p>
        {isDev && (
          <select value={defrostForce} onChange={(e) => setDefrostForce(e.target.value as SensorForce | '')}>
            <option value="">Zufällig</option>
            <option value="NORMAL">Normal erzwingen</option>
            <option value="VIOLATION">Verletzung erzwingen</option>
          </select>
        )}
        <button type="button" onClick={handleDefrost} disabled={defrostStatus === 'loading'}>
          {defrostStatus === 'loading' ? 'wird gemeldet...' : 'Auftauen melden'}
        </button>
        {defrostResult && <span className="reading-result"> — {describeReading(defrostResult)}</span>}
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
  const publicClient = usePublicClient()
  const { isDev, scenario } = useActiveScenario()
  const [labStatus, setLabStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [labErrorMessage, setLabErrorMessage] = useState('')
  const [labForce, setLabForce] = useState<LabForce | ''>('')
  const [awardStatus, setAwardStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [awardForce, setAwardForce] = useState<AwardForce | ''>('')
  const { isRequested, markRequested } = useRequestedAwards()

  const [lastReportData, setLastReportData] = useState<LabReportData>()
  const [labReportHistory, setLabReportHistory] = useState<string[]>([])

  useEffect(() => {
    if (batchId === undefined) return
    setLastReportData(loadLastReportData(batchId))
  }, [batchId])

  const { data: labReportCid, refetch: refetchLabReportCid } = useReadQualityIndexPhqiReportCid({
    address: qualityIndex,
    args: batchId !== undefined ? [batchId] : undefined,
    query: { enabled: Boolean(qualityIndex && batchId !== undefined) },
  })

  async function refetchLabReportHistory() {
    if (!publicClient || !qualityIndex || batchId === undefined) return
    const logs = await publicClient.getContractEvents({
      address: qualityIndex,
      abi: qualityIndexAbi,
      eventName: 'PHQIDataSubmitted',
      args: { batchId },
      fromBlock: 0n,
      toBlock: 'latest',
    })
    setLabReportHistory(logs.map((log) => log.args.ipfsCid).filter((cid): cid is string => Boolean(cid)))
  }

  useEffect(() => {
    void refetchLabReportHistory()
  }, [publicClient, qualityIndex, batchId])
  const { data: awardCertificateCid, refetch: refetchAwardCertificateCid } = useReadQualityIndexAwardCertificateCid({
    address: qualityIndex,
    args: batchId !== undefined ? [batchId] : undefined,
    query: { enabled: Boolean(qualityIndex && batchId !== undefined) },
  })

  async function handleRequestLab() {
    if (batchId === undefined) return
    // state === 1 (RetestRequired) bedeutet immer, dass hier ein Nachtest noetig ist - nicht erst,
    // wenn zufaellig noch ein Befund im Speicher ist. Fehlt der vorherige Befund (z. B. anderes
    // Geraet/Browser, sessionStorage geleert), lieber klar abbrechen statt stillschweigend neu zu
    // wuerfeln (das saehe im Case-Study-Modus wie ein unveraenderter Wiederholungsbefund aus).
    const isRetest = state === 1
    if (isRetest && !lastReportData) {
      const message = 'Nachtest nicht möglich: Der vorherige Laborbefund wurde in dieser Sitzung nicht gefunden (z. B. anderes Gerät/Browser oder Sitzungsdaten gelöscht).'
      setLabStatus('error')
      setLabErrorMessage(message)
      recordError({ chainId, batchId, step: 'labAnalysis', actor: 'lab', message })
      return
    }
    setLabStatus('loading')
    setLabErrorMessage('')
    try {
      const result = await requestLabAnalysis(
        Number(batchId),
        isRetest ? undefined : isDev ? (labForce || undefined) : scenario.force.lab,
        isRetest ? lastReportData : undefined,
      )
      setLastReportData(result.reportData)
      saveLastReportData(batchId, result.reportData)
      await refetchLabReportCid()
      await refetchLabReportHistory()
      onQualityChanged()
      void recordStep({
        chainId, batchId, step: 'labAnalysis', actor: 'lab',
        txHash: result.transactionHash, gasUsed: BigInt(result.gasUsed),
        durationMs: result.timings.renderMs + result.timings.uploadMs + result.timings.chainMs,
        timings: result.timings, note: result.ipfsCid ? `cid=${result.ipfsCid}` : '',
      })
      setLabStatus('idle')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Laboranalyse-Anfrage fehlgeschlagen.'
      setLabStatus('error')
      setLabErrorMessage(message)
      recordError({ chainId, batchId, step: 'labAnalysis', actor: 'lab', message })
    }
  }

  async function handleRequestAward() {
    if (batchId === undefined) return
    setAwardStatus('loading')
    try {
      const result = await requestAward(Number(batchId), isDev ? (awardForce || undefined) : scenario.force.award)
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

  return (
    <>
      <p>
        Laboranalyse:{' '}
        {labReportHistory.length > 0 ? (
          labReportHistory.map((cid, index) => (
            <span key={cid}>
              {index > 0 && ' · '}
              <a href={IPFS_GATEWAY + cid} target="_blank" rel="noreferrer">
                {labReportHistory.length === 1 ? 'ansehen' : index === 0 ? 'Befund 1' : `Befund ${index + 1} (Nachtest)`}
              </a>
            </span>
          ))
        ) : (
          'noch nicht vorhanden'
        )}
        {canRequestLab && (!labReportCid || state === 1) && (
          <>
            {' '}
            {isDev && (
              <select value={labForce} onChange={(e) => setLabForce(e.target.value as LabForce | '')}>
                <option value="">Zufällig</option>
                <option value="PREMIUM">Premium erzwingen</option>
                <option value="STANDARD">Standard erzwingen</option>
                <option value="GATEKEEPER">Gatekeeper erzwingen (nicht verkäuflich)</option>
                <option value="PHQI_EXCLUDED">PHQI ausgeschlossen erzwingen</option>
              </select>
            )}
            <button type="button" onClick={handleRequestLab} disabled={labStatus === 'loading'}>
              {labStatus === 'loading' ? 'wird angefordert...' : 'anfordern'}
            </button>
          </>
        )}
      </p>
      {labStatus === 'error' && <p>{labErrorMessage || 'Laboranalyse anfordern fehlgeschlagen.'}</p>}
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
            {isDev && (
              <select value={awardForce} onChange={(e) => setAwardForce(e.target.value as AwardForce | '')}>
                <option value="">Zufällig</option>
                <option value="NONE">Keine erzwingen</option>
                <option value="BRONZE">Bronze erzwingen</option>
                <option value="SILVER">Silber erzwingen</option>
                <option value="GOLD">Gold erzwingen</option>
              </select>
            )}
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
