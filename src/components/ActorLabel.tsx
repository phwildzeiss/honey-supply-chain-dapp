import { useMyRoles } from '../hooks/useMyRoles'
import { useActorName } from '../hooks/useActorName'

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function ActorLabel({ address }: { address: string | undefined }) {
  const name = useActorName(address)
  const roles = useMyRoles(address)
  const role = roles.beekeeper
    ? 'Imker'
    : roles.bottler
      ? 'Abfüller'
      : roles.retailer
        ? 'Einzelhändler'
        : roles.logistics
          ? 'Logistik'
          : undefined

  if (!address) return null
  return (
    <span>
      {name}
      {role ? ` (${role})` : ''} · {shortenAddress(address)}
    </span>
  )
}

export default ActorLabel
