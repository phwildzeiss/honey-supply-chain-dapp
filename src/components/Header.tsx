import { Link } from 'react-router-dom'
import { useChainId, useConnection, useDisconnect } from 'wagmi'

const CHAIN_NAMES: Record<number, string> = {
  31337: 'Hardhat',
  11155111: 'Sepolia',
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function Header() {
  const { address } = useConnection()
  const chainId = useChainId()
  const { mutate: disconnect } = useDisconnect()

  return (
    <header>
      <strong>Honig-Lieferkette</strong>
      <Link to="/dashboard">Dashboard</Link>
      <span>{address ? shortenAddress(address) : ''}</span>
      <span>{CHAIN_NAMES[chainId] ?? `Chain ${chainId}`}</span>
      <button type="button" onClick={() => disconnect()}>Trennen</button>
    </header>
  )
}

export default Header
