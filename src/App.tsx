import { useAccount, useConnect, useDisconnect } from 'wagmi'

function App() {
  const { address, chain, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  if (!isConnected) {
    return (
      <button type="button" onClick={() => connect({ connector: connectors[0] })} disabled={isPending}>
        {isPending ? 'Connecting...' : 'Connect wallet'}
      </button>
    )
  }

  return (
    <div>
      <p>Connected: {address}</p>
      <p>Network: {chain?.name ?? 'unknown'}</p>
      <button type="button" onClick={() => disconnect()}>
        Disconnect
      </button>
    </div>
  )
}

export default App
