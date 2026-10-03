import { useConnection } from 'wagmi'

function storageKey(address: string) {
  return `awardRequested:${address.toLowerCase()}`
}

function load(address: string | undefined): number[] {
  if (!address) return []
  try {
    const raw = localStorage.getItem(storageKey(address))
    return raw ? (JSON.parse(raw) as number[]) : []
  } catch {
    return []
  }
}

export function useRequestedAwards() {
  const { address } = useConnection()

  function isRequested(batchId: number): boolean {
    return load(address).includes(batchId)
  }

  function markRequested(batchId: number) {
    if (!address) return
    const current = load(address)
    if (current.includes(batchId)) return
    localStorage.setItem(storageKey(address), JSON.stringify([...current, batchId]))
  }

  return { isRequested, markRequested }
}
