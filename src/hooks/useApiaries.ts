import { useEffect, useState } from 'react'
import { useConnection } from 'wagmi'

export type Apiary = {
    id: number
    name: string
    station: string
    waterSourceDistanceMeters: number
    realRegion: string
}

function storageKey(address: string) {
    return `apiaries:${address.toLowerCase()}`
}

function load(address: string | undefined): Apiary[] {
    if (!address) return []
    try {
        const raw = localStorage.getItem(storageKey(address))
        return raw ? (JSON.parse(raw) as Apiary[]) : []
    } catch {
        return []
    }
}

export function useApiaries() {
    const { address } = useConnection()
    const [apiaries, setApiaries] = useState<Apiary[]>(() => load(address))

    useEffect(() => {
        setApiaries(load(address))
    }, [address])

    function addApiary(data: Omit<Apiary, 'id'>) {
        if (!address) return
        const apiary: Apiary = { ...data, id: Date.now() }
        const next = [...apiaries, apiary]
        setApiaries(next)
        localStorage.setItem(storageKey(address), JSON.stringify(next))
    }

    return { apiaries, addApiary }
}
