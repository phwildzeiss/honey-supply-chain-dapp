import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useConnection } from 'wagmi'
import { useMyRoles } from '../hooks/useMyRoles'
import { requestCertification } from '../simulator'
import Tile from '../components/Tile'

function Dashboard() {
  const { address, isConnected } = useConnection()
  const roles = useMyRoles()

  const [certStatus, setCertStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [certResult, setCertResult] = useState('')

  if (!isConnected) {
    return <Navigate to="/" replace />
  }

  async function handleRequestCertification() {
    if (!address) return
    setCertStatus('loading')
    try {
      const result = await requestCertification(address)
      setCertResult(result.certification)
      setCertStatus('done')
    } catch {
      setCertStatus('error')
    }
  }

  return (
    <div>
      <h2>Meine Rollen</h2>
      {roles.isLoading ? (
        <p>Rollen werden geladen...</p>
      ) : (
        <ul>
          <li>Imker: {roles.beekeeper ? 'ja' : 'nein'}</li>
          <li>Abfüller: {roles.bottler ? 'ja' : 'nein'}</li>
          <li>Einzelhändler: {roles.retailer ? 'ja' : 'nein'}</li>
          <li>Logistik: {roles.logistics ? 'ja' : 'nein'}</li>
        </ul>
      )}

      {roles.beekeeper && (
        <div>
          <h2>Aktionen</h2>
          <Tile to="/apiaries" label="Bienenstände" />
          <Tile to="/harvest" label="Ernte eintragen" />
          <Tile to="/batches/new" label="Gebinde anlegen" />
          <button type="button" onClick={handleRequestCertification} disabled={certStatus === 'loading'}>
            {certStatus === 'loading' ? 'wird beantragt...' : 'Zertifikat beantragen'}
          </button>
          {certStatus === 'done' && <p>Ergebnis: {certResult}</p>}
          {certStatus === 'error' && <p>Zertifizierung beantragen fehlgeschlagen.</p>}
        </div>
      )}
    </div>
  )
}

export default Dashboard
