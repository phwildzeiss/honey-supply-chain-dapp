import { useEffect, useState, type SubmitEvent } from 'react'
import { useChainId, useWaitForTransactionReceipt } from 'wagmi'
import { useReadSupplyChainNextBatchId, useWriteSupplyChainRegisterHarvestBatch } from '../generated'
import { addresses } from '../addresses'
import { useApiaries } from '../hooks/useApiaries'
import { useHarvest } from '../hooks/useHarvest'
import { useBatchComposition } from '../hooks/useBatchComposition'
import { Link } from 'react-router-dom'

type Row = { apiaryId: number; kg: string }

// BigInt() throws on a non-integer, and kg * 1000 can land just off an integer due to
// floating-point rounding (e.g. 0.1 * 1000 === 100.00000000000001), so round explicitly.
function toGrams(kg: string): number {
  return Math.round(Number(kg) * 1000)
}

function NewBatch() {
  const chainId = useChainId()
  const supplyChain = addresses[chainId as keyof typeof addresses]?.SupplyChain
  const { apiaries } = useApiaries()
  const { remaining, consumeFromPool } = useHarvest()
  const { saveComposition } = useBatchComposition()

  const [year, setYear] = useState(new Date().getFullYear())
  const [rows, setRows] = useState<Row[]>([{ apiaryId: apiaries[0]?.id ?? 0, kg: '' }])
  const [consumed, setConsumed] = useState(false)

  const { data: nextBatchId } = useReadSupplyChainNextBatchId({ address: supplyChain })
  const registerBatch = useWriteSupplyChainRegisterHarvestBatch()
  const receipt = useWaitForTransactionReceipt({ hash: registerBatch.data })

  useEffect(() => {
    if (receipt.isSuccess && !consumed && nextBatchId !== undefined) {
      consumeFromPool(rows.map((row) => ({ apiaryId: row.apiaryId, year, grams: toGrams(row.kg) })))
      saveComposition(Number(nextBatchId), rows.map((row) => ({ apiaryId: row.apiaryId, grams: toGrams(row.kg) })))
      setConsumed(true)
    }
  }, [receipt.isSuccess])

  function apiaryName(id: number) {
    return apiaries.find((a) => a.id === id)?.name ?? `#${id}`
  }

  function updateRow(index: number, changes: Partial<Row>) {
    setRows(rows.map((row, i) => (i === index ? { ...row, ...changes } : row)))
  }

  function addRow() {
    setRows([...rows, { apiaryId: apiaries[0]?.id ?? 0, kg: '' }])
  }

  function removeRow(index: number) {
    setRows(rows.filter((_, i) => i !== index))
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    if (!supplyChain) return
    for (const row of rows) {
      if (toGrams(row.kg) > remaining(row.apiaryId, year)) {
        alert(`Nicht genug Ernte von ${apiaryName(row.apiaryId)} für ${year} übrig.`)
        return
      }
    }
    const standIds = rows.map((row) => BigInt(row.apiaryId))
    const quantities = rows.map((row) => BigInt(toGrams(row.kg)))
    registerBatch.mutate({ address: supplyChain, args: [year, standIds, quantities] })
  }

  if (apiaries.length === 0) {
    return <p>Zuerst einen Bienenstand anlegen und Ernte eintragen.</p>
  }

  if (receipt.isSuccess) {
    return (
      <p>
        Charge #{nextBatchId?.toString()} wurde angelegt.{' '}
        <Link to={`/batches/${nextBatchId}`}>Ansehen</Link>
      </p>
    )
  }

  return (
    <div>
      <h1>Gebinde anlegen</h1>

      <form onSubmit={handleSubmit}>
        <label>
          Erntejahr
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} required />
        </label>

        {rows.map((row, index) => (
          <div key={index}>
            <select value={row.apiaryId} onChange={(e) => updateRow(index, { apiaryId: Number(e.target.value) })}>
              {apiaries.map((apiary) => (
                <option key={apiary.id} value={apiary.id}>
                  {apiary.name} (verfügbar: {(remaining(apiary.id, year) / 1000).toFixed(1)} kg)
                </option>
              ))}
            </select>
            <input
              type="number"
              value={row.kg}
              onChange={(e) => updateRow(index, { kg: e.target.value })}
              required
              min="0"
              step="0.1"
            />
            <span>kg</span>
            {rows.length > 1 && (
              <button type="button" onClick={() => removeRow(index)}>
                Entfernen
              </button>
            )}
          </div>
        ))}

        <button type="button" onClick={addRow}>
          Weiteren Bienenstand hinzufügen
        </button>

        <button type="submit" disabled={registerBatch.isPending || receipt.isLoading}>
          {registerBatch.isPending || receipt.isLoading ? 'Wird angelegt...' : 'Gebinde anlegen'}
        </button>
      </form>
    </div>
  )
}

export default NewBatch
