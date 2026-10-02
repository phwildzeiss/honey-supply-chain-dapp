const SIMULATOR_URL = import.meta.env.VITE_SIMULATOR_URL ?? 'http://localhost:8081'

export async function fetchRegionScore(region: string): Promise<number> {
  const response = await fetch(`${SIMULATOR_URL}/api/mci/origin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ region }),
  })
  if (!response.ok) throw new Error('Simulator-Anfrage für die Region fehlgeschlagen.')
  const data: { region: number } = await response.json()
  return data.region
}

export async function uploadOrigin(regions: string[]): Promise<string> {
  const response = await fetch(`${SIMULATOR_URL}/api/origin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ regions }),
  })
  if (!response.ok) throw new Error('Hochladen der Herkunft fehlgeschlagen.')
  const data: { cid: string } = await response.json()
  return data.cid
}
