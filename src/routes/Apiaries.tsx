import { useState, type SubmitEvent  } from 'react'
import { useApiaries, type Apiary } from '../hooks/useApiaries'

const STATIONS = ['Bienenstand_1', 'Bienenstand_2', 'Bienenstand_3', 'Bienenstand_4', 'Bienenstand_5', 'Bienenstand_6']
const REGIONS: Apiary['region'][] = ['EU_NON_EU_MIX', 'EU_MIX', 'NATIONAL', 'REGIONAL_GPS_VERIFIED']

function Apiaries() {
  const { apiaries, addApiary } = useApiaries()
  const [name, setName] = useState('')
  const [station, setStation] = useState(STATIONS[0])
  const [distance, setDistance] = useState('')
  const [region, setRegion] = useState<Apiary['region']>(REGIONS[0])

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    addApiary({ name, station, waterSourceDistanceMeters: Number(distance), region })
    setName('')
    setDistance('')
  }

  return (
    <div>
      <h1>Bienenstände</h1>

      <form onSubmit={handleSubmit}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Sensordatenquelle
          <select value={station} onChange={(e) => setStation(e.target.value)}>
            {STATIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Abstand zur Wasserquelle (m)
          <input type="number" value={distance} onChange={(e) => setDistance(e.target.value)} required min="0" />
        </label>
        <label>
          Region
          <select value={region} onChange={(e) => setRegion(e.target.value as Apiary['region'])}>
            {REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
        <button type="submit">Bienenstand anlegen</button>
      </form>

      <h2>Angelegte Bienenstände</h2>
      <ul>
        {apiaries.map((apiary) => (
          <li key={apiary.id}>
            {apiary.name} — {apiary.station}, {apiary.waterSourceDistanceMeters} m, {apiary.region}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Apiaries
