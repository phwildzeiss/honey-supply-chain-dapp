import { useState, type SubmitEvent } from 'react'
import { Link } from 'react-router-dom'
import { useChainId, useConnection } from 'wagmi'
import { useReadActorRegistryCertifications } from '../generated'
import { addresses } from '../addresses'
import { requestCertification } from '../simulator'

const OPTIONS = [
  { value: 'NATIONAL_QUALITY_LABEL', label: 'Nationales Gütesiegel' },
  { value: 'EU_ORGANIC', label: 'EU-Bio' },
  { value: 'ASSOCIATION_ORGANIC', label: 'Verbands-Bio' },
]

const SCORE_LABELS: Record<number, string> = {
  0: 'keines',
  2500: 'Nationales Gütesiegel',
  5000: 'EU-Bio',
  10000: 'Verbands-Bio',
}

const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/'

function SubmitCertification() {
  const chainId = useChainId()
  const { address } = useConnection()
  const actorRegistry = addresses[chainId as keyof typeof addresses]?.ActorRegistry
  const [requested, setRequested] = useState(OPTIONS[0].value)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState('')

  const { data: certificationData, refetch: refetchCertification } = useReadActorRegistryCertifications({
    address: actorRegistry,
    args: address ? [address] : undefined,
    query: { enabled: Boolean(actorRegistry && address) },
  })
  const [currentCid, currentScore] = certificationData ?? ['', 0]

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    if (!address) return
    setStatus('loading')
    try {
      const response = await requestCertification(address, requested)
      setResult(response.certification)
      await refetchCertification()
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done') {
    const label = OPTIONS.find((o) => o.value === requested)?.label
    return (
      <div>
        <p>
          {result === requested
            ? `Zertifikat erhalten: ${label}`
            : `Die Kriterien für "${label}" wurden nicht erfüllt — kein Zertifikat erhalten.`}
        </p>
        <Link to="/dashboard" className="tile">Zum Dashboard</Link>
      </div>
    )
  }

  return (
    <div>
      <h1>Zertifikat beantragen</h1>
      <p>
        Aktuelles Zertifikat: {SCORE_LABELS[currentScore] ?? 'keines'}
        {currentCid && (
          <>
            {' '}— <a href={IPFS_GATEWAY + currentCid} target="_blank" rel="noreferrer">ansehen</a>
          </>
        )}
      </p>
      <form onSubmit={handleSubmit}>
        <label>
          Zertifikat
          <select value={requested} onChange={(e) => setRequested(e.target.value)}>
            {OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'wird beantragt...' : 'Beantragen'}
        </button>
      </form>
      {status === 'error' && <p>Zertifizierung beantragen fehlgeschlagen.</p>}
    </div>
  )
}

export default SubmitCertification
