import { useState, type SubmitEvent } from 'react'
import { useApiaries } from '../hooks/useApiaries'
import { useHarvest } from '../hooks/useHarvest'

function Harvest() {
  const { apiaries } = useApiaries()
  const { entries, setHarvest } = useHarvest()
  const [apiaryId, setApiaryId] = useState(apiaries[0]?.id ?? 0)
  const [year, setYear] = useState(new Date().getFullYear())
  const [kg, setKg] = useState('')

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    setHarvest(apiaryId, year, Number(kg) * 1000)
    setKg('')
  }

  function apiaryName(id: number) {
    return apiaries.find((a) => a.id === id)?.name ?? `#${id}`
  }

  if (apiaries.length === 0) {
    return <p>Zuerst einen Bienenstand anlegen.</p>
  }

  return (
    <div>
      <h1>Ernte eintragen</h1>

      <form onSubmit={handleSubmit}>
        <label>
          Bienenstand
          <select value={apiaryId} onChange={(e) => setApiaryId(Number(e.target.value))}>
            {apiaries.map((apiary) => (
              <option key={apiary.id} value={apiary.id}>{apiary.name}</option>
            ))}
          </select>
        </label>
        <label>
          Erntejahr
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} required />
        </label>
        <label>
          Menge (kg)
          <input type="number" value={kg} onChange={(e) => setKg(e.target.value)} required min="0" step="0.1" />
        </label>
        <button type="submit">Eintragen</button>
      </form>

      <h2>Erfasste Erntemengen</h2>
      <ul>
        {entries.map((entry) => (
          <li key={`${entry.apiaryId}-${entry.year}`}>
            {apiaryName(entry.apiaryId)}, {entry.year}: {(entry.grams / 1000).toFixed(1)} kg
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Harvest
