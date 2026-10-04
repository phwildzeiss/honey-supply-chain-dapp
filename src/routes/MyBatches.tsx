import { Link } from 'react-router-dom'
import { useMyBatches } from '../hooks/useMyBatches'
import { useMyRoles } from '../hooks/useMyRoles'

function MyBatches() {
  const { asHolder, asBeekeeper, isLoading } = useMyBatches()
  const roles = useMyRoles()

  if (isLoading) {
    return <p>Lädt...</p>
  }

  return (
    <div>
      <h1>Meine Chargen</h1>

      <h2>Aktuell bei mir</h2>
      {asHolder.length > 0 ? (
        <ul>
          {asHolder.map((id) => (
            <li key={id}><Link to={`/batches/${id}`}>Charge #{id}</Link></li>
          ))}
        </ul>
      ) : (
        <p>keine</p>
      )}

      {roles.beekeeper && (
        <>
          <h2>Meine Ernte (als Imker)</h2>
          {asBeekeeper.length > 0 ? (
            <ul>
              {asBeekeeper.map((id) => (
                <li key={id}><Link to={`/batches/${id}`}>Charge #{id}</Link></li>
              ))}
            </ul>
          ) : (
            <p>keine</p>
          )}
        </>
      )}
    </div>
  )
}

export default MyBatches
