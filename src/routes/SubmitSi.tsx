import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useChainId, useWaitForTransactionReceipt } from 'wagmi'
import { useWriteQualityIndexSubmitSiData } from '../generated'
import { addresses } from '../addresses'
import { useApiaries } from '../hooks/useApiaries'
import { useBatchComposition } from '../hooks/useBatchComposition'
import { fetchSiScores, type SiScores } from '../simulator'

const FIELDS = [
  'forage', 'lightIntensity', 'waterSource', 'summerTemperature',
  'winterTemperature', 'windSpeed', 'humidity', 'precipitation',
] as const

function weightedAverage(entries: { scores: SiScores; grams: number }[]): SiScores {
  const totalGrams = entries.reduce((sum, e) => sum + e.grams, 0)
  const result = {} as SiScores
  for (const field of FIELDS) {
    const weightedSum = entries.reduce((sum, e) => sum + e.scores[field] * e.grams, 0)
    result[field] = Math.round(weightedSum / totalGrams)
  }
  return result
}

function SubmitSi() {
  const { batchId } = useParams()
  const chainId = useChainId()
  const qualityIndex = addresses[chainId as keyof typeof addresses]?.QualityIndex
  const { apiaries } = useApiaries()
  const { getComposition } = useBatchComposition()

  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState('')

  const submitSi = useWriteQualityIndexSubmitSiData()
  const receipt = useWaitForTransactionReceipt({ hash: submitSi.data })

  const id = batchId ? BigInt(batchId) : undefined
  const composition = batchId ? getComposition(Number(batchId)) : []

  async function handleSubmit() {
    if (!id || !qualityIndex) return
    setIsCalculating(true)
    setError('')
    try {
      const entries = await Promise.all(
        composition.map(async (row) => {
          const apiary = apiaries.find((a) => a.id === row.apiaryId)
          if (!apiary) throw new Error(`Bienenstand #${row.apiaryId} nicht gefunden.`)
          const scores = await fetchSiScores(apiary.station, apiary.waterSourceDistanceMeters)
          return { scores, grams: row.grams }
        }),
      )
      submitSi.mutate({ address: qualityIndex, args: [id, weightedAverage(entries)] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SI-Berechnung fehlgeschlagen.')
    } finally {
      setIsCalculating(false)
    }
  }

  if (!batchId) return <p>Lädt...</p>

  if (receipt.isSuccess) {
    return (
      <div>
        <p>SI wurde eingereicht.</p>
        <Link to={`/batches/${batchId}`} className="tile">Zur Charge</Link>
      </div>
    )
  }

  return (
    <div>
      <h1>SI einreichen — Charge #{batchId}</h1>

      <p>
        Beteiligte Bienenstände:{' '}
        {composition.length > 0
          ? composition.map((row) => apiaries.find((a) => a.id === row.apiaryId)?.name ?? `#${row.apiaryId}`).join(', ')
          : 'keine Zusammensetzung gefunden'}
      </p>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={composition.length === 0 || isCalculating || submitSi.isPending || receipt.isLoading}
      >
        {isCalculating || submitSi.isPending || receipt.isLoading ? 'Wird eingereicht...' : 'SI einreichen'}
      </button>

      {error && <p>{error}</p>}
    </div>
  )
}

export default SubmitSi
