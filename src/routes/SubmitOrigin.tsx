import { useEffect, useState, type SubmitEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useChainId, useWaitForTransactionReceipt } from 'wagmi'
import { useWriteQualityIndexSubmitMciOriginData, useWriteQualityIndexSubmitOrigin } from '../generated'
import { addresses } from '../addresses'
import { useApiaries } from '../hooks/useApiaries'
import { useBatchComposition } from '../hooks/useBatchComposition'
import { fetchRegionScore, uploadOrigin } from '../simulator'

const REGIONS = [
  { value: 'EU_NON_EU_MIX', label: 'EU- und Nicht-EU-Mix' },
  { value: 'EU_MIX', label: 'EU-Mix' },
  { value: 'NATIONAL', label: 'National' },
  { value: 'REGIONAL_GPS_VERIFIED', label: 'Regional' },
]

function SubmitOrigin() {
  const { batchId } = useParams()
  const chainId = useChainId()
  const qualityIndex = addresses[chainId as keyof typeof addresses]?.QualityIndex
  const { apiaries } = useApiaries()
  const { getComposition } = useBatchComposition()

  const [region, setRegion] = useState(REGIONS[0].value)
  const [phase, setPhase] = useState<'form' | 'waitingRegion' | 'waitingOrigin' | 'done'>('form')
  const [error, setError] = useState('')

  const submitRegion = useWriteQualityIndexSubmitMciOriginData()
  const regionReceipt = useWaitForTransactionReceipt({ hash: submitRegion.data })
  const submitOriginTx = useWriteQualityIndexSubmitOrigin()
  const originReceipt = useWaitForTransactionReceipt({ hash: submitOriginTx.data })

  const id = batchId ? BigInt(batchId) : undefined
  const composition = batchId ? getComposition(Number(batchId)) : []
  const placeNames = [...new Set(
    composition
      .map((row) => apiaries.find((a) => a.id === row.apiaryId)?.realRegion)
      .filter((name): name is string => Boolean(name)),
  )]

  useEffect(() => {
    if (phase !== 'waitingRegion' || !regionReceipt.isSuccess || !id || !qualityIndex) return
    uploadOrigin(placeNames)
      .then((cid) => {
        submitOriginTx.mutate({ address: qualityIndex, args: [id, cid] })
        setPhase('waitingOrigin')
      })
      .catch(() => setError('Hochladen der Herkunft ist fehlgeschlagen.'))
  }, [phase, regionReceipt.isSuccess])

  useEffect(() => {
    if (phase === 'waitingOrigin' && originReceipt.isSuccess) {
      setPhase('done')
    }
  }, [phase, originReceipt.isSuccess])

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    if (!id || !qualityIndex) return
    setError('')
    try {
      const score = await fetchRegionScore(region)
      submitRegion.mutate({ address: qualityIndex, args: [id, score] })
      setPhase('waitingRegion')
    } catch {
      setError('Abfrage der Region beim Simulator ist fehlgeschlagen.')
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
