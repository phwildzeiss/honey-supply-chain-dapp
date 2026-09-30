import { Navigate } from 'react-router-dom'
import { useAccount, useDisconnect } from 'wagmi'
import { useMyRoles } from '../hooks/useMyRoles'

function Dashboard() {
  const { address, chain, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
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
    </div>
  )
}

export default Dashboard
