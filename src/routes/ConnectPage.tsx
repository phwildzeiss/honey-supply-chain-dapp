import { Navigate } from 'react-router-dom'
import { useConnect, useConnection, useConnectors } from 'wagmi'

function ConnectPage() {
  const { isConnected } = useConnection()
  const { mutate: connect, isPending } = useConnect()
  const connectors = useConnectors()

  if (isConnected) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <button type="button" onClick={() => connect({ connector: connectors[0] })} disabled={isPending}>
      {isPending ? 'Connecting...' : 'Connect wallet'}
    </button>
  )
}

export default ConnectPage
