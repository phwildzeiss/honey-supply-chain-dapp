import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useChainId, useConnection, useDisconnect } from 'wagmi'
import { SCENARIOS, useActiveScenario, setActiveScenarioId, notifyCertificationReset, type ScenarioId } from '../scenario'
import { requestCertification } from '../simulator'

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
  const { id: scenarioId } = useActiveScenario()
  const [resetStatus, setResetStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  async function handleScenarioChange(id: ScenarioId) {
    const certificationUnchanged = SCENARIOS[scenarioId].force.certification === SCENARIOS[id].force.certification
    setActiveScenarioId(id)
    if (!address || certificationUnchanged) return
    setResetStatus('loading')
    try {
      await requestCertification(address, 'NONE', 'NONE')
      setResetStatus('idle')
      notifyCertificationReset()
    } catch {
      setResetStatus('error')
    }
  }

  return (
    <header>
      <strong>Honig-Lieferkette</strong>
      <Link to="/dashboard">Dashboard</Link>
      <select
        value={scenarioId}
        onChange={(e) => void handleScenarioChange(e.target.value as ScenarioId)}
        title="Szenario für Force-Vorgaben bei Labor/Prämierung/Sensoren — setzt die Zertifizierung des Imker-Kontos zurück, falls sich die geforderte Zertifizierung ändert"
      >
        {Object.entries(SCENARIOS).map(([id, scenario]) => (
          <option key={id} value={id}>{scenario.label}</option>
        ))}
      </select>
      {resetStatus === 'loading' && <span>Zertifizierung wird zurückgesetzt...</span>}
      {resetStatus === 'error' && <span>Zertifizierung zurücksetzen fehlgeschlagen</span>}
      <span>{address ? shortenAddress(address) : ''}</span>
      <span>{CHAIN_NAMES[chainId] ?? `Chain ${chainId}`}</span>
      <button type="button" onClick={() => disconnect()}>Trennen</button>
    </header>
  )
}

export default Header
