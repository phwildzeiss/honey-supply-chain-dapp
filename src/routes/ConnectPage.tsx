import { Navigate, Link } from 'react-router-dom'
import { useConnect, useConnection, useConnectors } from 'wagmi'

function ConnectPage() {
  const { isConnected } = useConnection()
  const { mutate: connect, isPending } = useConnect()
  const connectors = useConnectors()

  if (isConnected) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div>
      <h1>Honig-Lieferkette</h1>
      <button type="button" onClick={() => connect({ connector: connectors[0] })} disabled={isPending}>
        {isPending ? 'Connecting...' : 'Connect wallet'}
      </button>
      <p><Link to="/consumer">Honig-Herkunft als Konsument prüfen</Link></p>
    </div>
  )
}

export default ConnectPage
