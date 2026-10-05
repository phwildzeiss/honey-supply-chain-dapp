import { useState } from 'react'
import { getAllSteps, clearSteps, downloadCsv, downloadRunsCsv, computeRunSummaries } from '../measurements'

function MeasurementsExport() {
  const [rows, setRows] = useState(getAllSteps())
  const batchCount = computeRunSummaries(rows).length
  const errorCount = rows.filter((r) => r.outcome === 'error').length

  function handleReset() {
    if (!confirm(`${rows.length} Messwerte wirklich löschen? Das kann nicht rückgängig gemacht werden.`)) return
    clearSteps()
    setRows(getAllSteps())
  }

  return (
    <div>
      <h1>Messwerte</h1>
      <p>
        Jede Transaktion, die über diese dApp gesendet wird (in diesem Browser, über alle verbundenen
        Konten hinweg), wird hier als eine Zeile erfasst — Gasverbrauch, Dauer, Netzwerk und der
        Qualitäts-Snapshot direkt danach. Gleiche Spalten wie <code>steps.csv</code> aus dem
        Fallstudien-Runner (<code>fullBatchFlow.ts</code>), damit sich beide Quellen zusammenführen lassen.
        Abgelehnte oder on-chain zurückgewiesene Versuche landen ebenfalls als eigene Zeile
        (<code>outcome=error</code>), statt stillschweigend zu verschwinden.
      </p>

      <h2>Status</h2>
      <p>Erfasste Zeilen: {rows.length}</p>
      <p>Davon fehlgeschlagene Versuche: {errorCount}</p>
      <p>Chargen mit mindestens einem erfolgreichen Schritt: {batchCount}</p>

      <h2>Aktionen</h2>
      <p>
        <button type="button" onClick={downloadCsv} disabled={rows.length === 0}>
          Einzelschritte (steps.csv) herunterladen
        </button>
        <button type="button" onClick={downloadRunsCsv} disabled={batchCount === 0}>
          Zusammenfassung je Charge (runs.csv) herunterladen
        </button>
        <button type="button" onClick={handleReset} disabled={rows.length === 0}>
          Zurücksetzen
        </button>
      </p>
    </div>
  )
}

export default MeasurementsExport
