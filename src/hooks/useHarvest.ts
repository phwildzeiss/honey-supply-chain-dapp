import { useEffect, useState } from 'react'
import { useConnection } from 'wagmi'

export type HarvestEntry = {
    apiaryId: number
    year: number
    grams: number
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

    function setHarvest(apiaryId: number, year: number, grams: number) {
        if (!address) return
        const withoutExisting = entries.filter((e) => !(e.apiaryId === apiaryId && e.year === year))
        const next = [...withoutExisting, { apiaryId, year, grams }]
        setEntries(next)
        localStorage.setItem(storageKey(address), JSON.stringify(next))
    }

    return { entries, setHarvest }
}
