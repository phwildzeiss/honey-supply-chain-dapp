import { useConnection } from 'wagmi'

export type BatchComposition = {
  batchId: number
  rows: { apiaryId: number; grams: number }[]
}

function storageKey(address: string) {
  return `batchCompositions:${address.toLowerCase()}`
}

function load(address: string | undefined): BatchComposition[] {
  if (!address) return []
  try {
    const raw = localStorage.getItem(storageKey(address))
    return raw ? (JSON.parse(raw) as BatchComposition[]) : []
  } catch {
    return []
  }
}

export function useBatchComposition() {
  const { address } = useConnection()

  function saveComposition(batchId: number, rows: { apiaryId: number; grams: number }[]) {
    if (!address) return
    const all = load(address)
    const next = [...all.filter((c) => c.batchId !== batchId), { batchId, rows }]
    localStorage.setItem(storageKey(address), JSON.stringify(next))
  }

  function getComposition(batchId: number): { apiaryId: number; grams: number }[] {
    return load(address).find((c) => c.batchId === batchId)?.rows ?? []
  }

  return { saveComposition, getComposition }
}
