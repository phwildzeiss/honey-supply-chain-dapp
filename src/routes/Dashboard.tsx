import { Navigate } from 'react-router-dom'
import { useConnection } from 'wagmi'
import { useMyRoles } from '../hooks/useMyRoles'
import Tile from '../components/Tile'

function Dashboard() {
  const { isConnected } = useConnection()
  const roles = useMyRoles()

  if (!isConnected) {
    return <Navigate to="/" replace />
  }

  return (
    <div>
      <h2>Meine Rollen</h2>
      {roles.isLoading ? (
        <p>Rollen werden geladen...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Rolle</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Imker</td>
              <td>{roles.beekeeper ? 'ja' : 'nein'}</td>
            </tr>
            <tr>
              <td>Abfüller</td>
              <td>{roles.bottler ? 'ja' : 'nein'}</td>
            </tr>
            <tr>
              <td>Einzelhändler</td>
              <td>{roles.retailer ? 'ja' : 'nein'}</td>
            </tr>
            <tr>
              <td>Logistik</td>
              <td>{roles.logistics ? 'ja' : 'nein'}</td>
            </tr>
          </tbody>
        </table>
      )}

      <Tile to="/my-batches" label="Meine Chargen" />
      <Tile to="/measurements" label="Messwerte" />

      {roles.beekeeper && (
        <div>
          <h2>Aktionen</h2>
          <Tile to="/apiaries" label="Bienenstände" />
          <Tile to="/harvest" label="Ernte eintragen" />
          <Tile to="/batches/new" label="Gebinde anlegen" />
          <Tile to="/certification" label="Zertifikat beantragen" />
        </div>
      )}
    </div>
  )
}

export default Dashboard
