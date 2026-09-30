import { Navigate } from 'react-router-dom'
import { useAccount, useDisconnect } from 'wagmi'

function Dashboard() {
  const { address, chain, isConnected } = useAccount()
  const { disconnect } = useDisconnect()

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
      <p>Dashboard placeholder — tiles come next.</p>
    </div>
  )
}

export default Dashboard
