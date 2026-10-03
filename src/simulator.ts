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

export type SiScores = {
  forage: number
  lightIntensity: number
  waterSource: number
  summerTemperature: number
  winterTemperature: number
  windSpeed: number
  humidity: number
  precipitation: number
}

export async function fetchSiScores(sensorStation: string, waterSourceDistanceMeters: number): Promise<SiScores> {
  const response = await fetch(`${SIMULATOR_URL}/api/si`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sensorStation, waterSourceDistanceMeters }),
  })
  if (!response.ok) throw new Error('Simulator-Anfrage für die SI-Werte fehlgeschlagen.')
  return response.json()
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

export async function requestLabAnalysis(batchId: number): Promise<void> {
  const response = await fetch(`${SIMULATOR_URL}/api/lab/analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batchId }),
  })
  if (!response.ok) throw new Error('Laboranalyse-Anfrage fehlgeschlagen.')
}

export async function requestAward(batchId: number): Promise<void> {
  const response = await fetch(`${SIMULATOR_URL}/api/awards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batchId }),
  })
  if (!response.ok) throw new Error('Prämierungs-Anfrage fehlgeschlagen.')
}

export async function requestCertification(beekeeperAddress: string): Promise<{ certification: string }> {
  const response = await fetch(`${SIMULATOR_URL}/api/certifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ beekeeperAddress }),
  })
  if (!response.ok) throw new Error('Zertifizierungs-Anfrage fehlgeschlagen.')
  return response.json()
}
