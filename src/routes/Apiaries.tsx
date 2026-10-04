import { useState, type SubmitEvent  } from 'react'
import { useApiaries } from '../hooks/useApiaries'

const STATIONS = ['Bienenstand_1', 'Bienenstand_2', 'Bienenstand_3', 'Bienenstand_4', 'Bienenstand_5', 'Bienenstand_6']

function Apiaries() {
  const { apiaries, addApiary } = useApiaries()
  const [name, setName] = useState('')
  const [station, setStation] = useState(STATIONS[0])
  const [distance, setDistance] = useState('')
  const [realRegion, setRealRegion] = useState('')

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    addApiary({ name, station, waterSourceDistanceMeters: Number(distance), realRegion })
    setName('')
    setDistance('')
    setRealRegion('')
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
          <input
            value={realRegion}
            onChange={(e) => setRealRegion(e.target.value)}
            required
            placeholder="z. B. Burgenland"
          />
        </label>
        <button type="submit">Bienenstand anlegen</button>
      </form>

      <h2>Angelegte Bienenstände</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Sensordatenquelle</th>
            <th>Abstand zur Wasserquelle (m)</th>
            <th>Region</th>
          </tr>
        </thead>
        <tbody>
          {apiaries.map((apiary) => (
            <tr key={apiary.id}>
              <td>{apiary.name}</td>
              <td>{apiary.station}</td>
              <td>{apiary.waterSourceDistanceMeters}</td>
              <td>{apiary.realRegion}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default Apiaries
