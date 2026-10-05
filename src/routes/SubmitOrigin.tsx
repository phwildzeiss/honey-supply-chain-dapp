import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useChainId, useConnection, useWaitForTransactionReceipt } from 'wagmi'
import { useWriteQualityIndexSubmitMciOriginData, useWriteQualityIndexSubmitOrigin } from '../generated'
import { addresses } from '../addresses'
import { useApiaries } from '../hooks/useApiaries'
import { useBatchComposition } from '../hooks/useBatchComposition'
import { fetchRegionScore, uploadOrigin } from '../simulator'
import { recordStep, recordError, errorMessage } from '../measurements'
import { useTxTiming } from '../hooks/useTxTiming'

const REGIONS = [
  { value: 'EU_NON_EU_MIX', label: 'EU- und Nicht-EU-Mix' },
  { value: 'EU_MIX', label: 'EU-Mix' },
  { value: 'NATIONAL', label: 'National' },
  { value: 'REGIONAL_GPS_VERIFIED', label: 'Regional' },
]

function SubmitOrigin() {
  const { batchId } = useParams()
  const chainId = useChainId()
  const { address } = useConnection()
  const qualityIndex = addresses[chainId as keyof typeof addresses]?.QualityIndex
  const { apiaries } = useApiaries()
  const { getComposition } = useBatchComposition()

  const [region, setRegion] = useState(REGIONS[0].value)
  const [phase, setPhase] = useState<'form' | 'waitingRegion' | 'waitingOrigin' | 'done'>('form')
  const [error, setError] = useState('')
  const uploadMsRef = useRef(0)
  const uploadedCidRef = useRef('')
  const regionErrorRecorded = useRef(false)
  const originErrorRecorded = useRef(false)

  const submitRegion = useWriteQualityIndexSubmitMciOriginData()
  const regionReceipt = useWaitForTransactionReceipt({ hash: submitRegion.data })
  const regionTiming = useTxTiming(submitRegion.data)
  const submitOriginTx = useWriteQualityIndexSubmitOrigin()
  const originReceipt = useWaitForTransactionReceipt({ hash: submitOriginTx.data })
  const originTiming = useTxTiming(submitOriginTx.data)

  const id = batchId ? BigInt(batchId) : undefined
  const composition = batchId ? getComposition(Number(batchId)) : []
  const placeNames = [...new Set(
    composition
      .map((row) => apiaries.find((a) => a.id === row.apiaryId)?.realRegion)
      .filter((name): name is string => Boolean(name)),
  )]

  useEffect(() => {
    if (submitRegion.isError && !regionErrorRecorded.current) {
      regionErrorRecorded.current = true
      recordError({
        chainId, batchId: id, step: 'submitMCIOriginData', actor: 'beekeeper', address,
        message: errorMessage(submitRegion.error),
      })
    }
  }, [submitRegion.isError])

  useEffect(() => {
    if (submitOriginTx.isError && !originErrorRecorded.current) {
      originErrorRecorded.current = true
      recordError({
        chainId, batchId: id, step: 'submitOrigin', actor: 'beekeeper', address,
        message: errorMessage(submitOriginTx.error),
      })
    }
  }, [submitOriginTx.isError])

  useEffect(() => {
    if (phase !== 'waitingRegion' || !regionReceipt.isSuccess || !regionReceipt.data || !id || !qualityIndex) return
    if (regionReceipt.data.status === 'reverted') {
      recordError({
        chainId, batchId: id, step: 'submitMCIOriginData', actor: 'beekeeper', address,
        message: 'Transaktion wurde on-chain zurückgewiesen (reverted).',
      })
      return
    }
    const { walletConfirmMs, miningMs, totalMs } = regionTiming.split()
    void recordStep({
      chainId, batchId: id, step: 'submitMCIOriginData', actor: 'beekeeper', address,
      txHash: regionReceipt.data.transactionHash, gasUsed: regionReceipt.data.gasUsed,
      gasPriceWei: regionReceipt.data.effectiveGasPrice,
      durationMs: totalMs, walletTiming: { walletConfirmMs, miningMs },
    })
    const uploadStartedAt = performance.now()
    uploadOrigin(placeNames)
      .then((cid) => {
        uploadMsRef.current = Math.round(performance.now() - uploadStartedAt)
        uploadedCidRef.current = cid
        originErrorRecorded.current = false
        originTiming.markSubmitted()
        submitOriginTx.mutate({ address: qualityIndex, args: [id, cid] })
        setPhase('waitingOrigin')
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Hochladen der Herkunft ist fehlgeschlagen.'
        setError(message)
        recordError({ chainId, batchId: id, step: 'submitOrigin', actor: 'beekeeper', address, message })
      })
  }, [phase, regionReceipt.isSuccess])

  useEffect(() => {
    if (phase !== 'waitingOrigin' || !originReceipt.isSuccess || !originReceipt.data) return
    if (id !== undefined) {
      if (originReceipt.data.status === 'reverted') {
        recordError({
          chainId, batchId: id, step: 'submitOrigin', actor: 'beekeeper', address,
          message: 'Transaktion wurde on-chain zurückgewiesen (reverted).',
        })
        setPhase('done')
        return
      }
      const { walletConfirmMs, miningMs, totalMs } = originTiming.split()
      void recordStep({
        chainId, batchId: id, step: 'submitOrigin', actor: 'beekeeper', address,
        txHash: originReceipt.data.transactionHash, gasUsed: originReceipt.data.gasUsed,
        gasPriceWei: originReceipt.data.effectiveGasPrice,
        durationMs: uploadMsRef.current + totalMs,
        timings: { renderMs: 0, uploadMs: uploadMsRef.current, chainMs: totalMs },
        walletTiming: { walletConfirmMs, miningMs },
        note: uploadedCidRef.current ? `cid=${uploadedCidRef.current}` : '',
      })
    }
    setPhase('done')
  }, [phase, originReceipt.isSuccess])

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    if (!id || !qualityIndex) return
    setError('')
    try {
      const score = await fetchRegionScore(region)
      regionErrorRecorded.current = false
      regionTiming.markSubmitted()
      submitRegion.mutate({ address: qualityIndex, args: [id, score] })
      setPhase('waitingRegion')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Abfrage der Region beim Simulator ist fehlgeschlagen.'
      setError(message)
      recordError({ chainId, batchId: id, step: 'submitMCIOriginData', actor: 'beekeeper', address, message })
    }
  }

  if (!batchId) return <p>Lädt...</p>

  if (phase === 'done') {
    return (
      <div>
        <p>Herkunft wurde eingetragen.</p>
        <Link to={`/batches/${batchId}`} className="tile">Zur Charge</Link>
      </div>
    )
  }

  return (
    <div>
      <h1>Herkunft eintragen — Charge #{batchId}</h1>

      <p>Beteiligte Orte: {placeNames.length > 0 ? placeNames.join(', ') : 'keine Zusammensetzung gefunden'}</p>

      <form onSubmit={handleSubmit}>
        <label>
          Eignungsstufe
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </label>

        <button type="submit" disabled={phase !== 'form' || placeNames.length === 0}>
          {phase === 'form' ? 'Einreichen' : 'Wird eingereicht...'}
        </button>
      </form>

      {error && <p>{error}</p>}
    </div>
  )
}

export default SubmitOrigin
