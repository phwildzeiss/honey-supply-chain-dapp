import { useEffect, useState } from 'react'
import { useConnection } from 'wagmi'

export type HarvestEntry = {
    apiaryId: number
    year: number
    grams: number
    usedGrams: number
}

function storageKey(address: string) {
    return `harvest:${address.toLowerCase()}`
}

function load(address: string | undefined): HarvestEntry[] {
    if (!address) return []
    try {
        const raw = localStorage.getItem(storageKey(address))
        return raw ? (JSON.parse(raw) as HarvestEntry[]) : []
    } catch {
        return []
    }
}

export function useHarvest() {
    const { address } = useConnection()
    const [entries, setEntries] = useState<HarvestEntry[]>(() => load(address))

    useEffect(() => {
        setEntries(load(address))
    }, [address])

    function save(next: HarvestEntry[]) {
        setEntries(next)
        if (address) localStorage.setItem(storageKey(address), JSON.stringify(next))
    }

    function setHarvest(apiaryId: number, year: number, grams: number) {
        if (!address) return
        const existing = entries.find((e) => e.apiaryId === apiaryId && e.year === year)
        const withoutExisting = entries.filter((e) => !(e.apiaryId === apiaryId && e.year === year))
        save([...withoutExisting, { apiaryId, year, grams, usedGrams: existing?.usedGrams ?? 0 }])
    }

    function consumeFromPool(usages: { apiaryId: number; year: number; grams: number }[]) {
        const next = entries.map((e) => {
            const totalUsed = usages
                .filter((u) => u.apiaryId === e.apiaryId && u.year === e.year)
                .reduce((sum, u) => sum + u.grams, 0)
            return totalUsed > 0 ? { ...e, usedGrams: e.usedGrams + totalUsed } : e
        })
        save(next)
    }

    function remaining(apiaryId: number, year: number) {
        const entry = entries.find((e) => e.apiaryId === apiaryId && e.year === year)
        return entry ? entry.grams - entry.usedGrams : 0
    }

    return { entries, setHarvest, consumeFromPool, remaining }
}
