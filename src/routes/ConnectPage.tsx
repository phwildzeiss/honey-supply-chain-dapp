import { Navigate } from 'react-router-dom'
import { useAccount, useConnect } from 'wagmi'

function ConnectPage() {
  const { isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()

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
