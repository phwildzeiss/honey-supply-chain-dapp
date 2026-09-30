import { Navigate } from 'react-router-dom'
import { useConnection, useDisconnect } from 'wagmi'
import { useMyRoles } from '../hooks/useMyRoles'
import Tile from '../components/Tile'

function Dashboard() {
  const { address, chain, isConnected } = useConnection()
  const { mutate: disconnect } = useDisconnect()
  const roles = useMyRoles()

  if (!isConnected) {
    return <Navigate to="/" replace />
  }

  return (
    <div>
      <p>Connected: {address}</p>
      <p>Network: {chain?.name ?? 'unknown'}</p>
      <button type="button" onClick={() => disconnect()}>
        Disconnect
      </button>

      <h2>My roles</h2>
      {roles.isLoading ? (
        <p>Loading roles...</p>
      ) : (
        <ul>
          <li>Beekeeper: {roles.beekeeper ? 'yes' : 'no'}</li>
          <li>Bottler: {roles.bottler ? 'yes' : 'no'}</li>
          <li>Retailer: {roles.retailer ? 'yes' : 'no'}</li>
          <li>Logistics: {roles.logistics ? 'yes' : 'no'}</li>
        </ul>
      )}

      {roles.beekeeper && (
        <div>
          <h2>Aktionen</h2>
          <Tile to="/apiaries" label="Bienenstände" />
          <Tile to="/harvest" label="Ernte eintragen" />
          <Tile to="/batches/new" label="Gebinde anlegen" />
          <button type="button" onClick={() => alert('Noch nicht umgesetzt')}>
            Zertifikat beantragen
          </button>
        </div>
      )}
    </div>
  )
}

export default Dashboard
