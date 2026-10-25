import { readContract } from 'wagmi/actions'
import { config } from './wagmi'
import { addresses } from './addresses'
import { productGatewayAbi } from './generated'

// Gemeinsamer Speicher für alle Konten in diesem Browser (nicht pro Adresse wie bei Apiaries/Harvest):
// Eine Übergabe/ein Transport betrifft immer zwei Konten, und ohne einen gemeinsamen Schlüssel müsste man
// beim Export mehrere Konten-Exporte zu einer durchgehenden Chargen-Historie zusammenführen.
const STORAGE_KEY = 'measurements'
const JAR_GRAMS = 500
const STATES = ['Active', 'RetestRequired', 'NotSellable']
const REASONS = ['None', 'WaterContentExceeded', 'TemperatureViolation']
const NETWORK_NAMES: Record<number, string> = { 31337: 'hardhat', 11155111: 'sepolia' }

export type StepTimings = { renderMs: number; uploadMs: number; chainMs: number }
export type MeasurementRow = Record<string, string | number>


export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'shortMessage' in error) {
    const shortMessage = (error as { shortMessage?: unknown }).shortMessage
    if (typeof shortMessage === 'string') return shortMessage
  }
  return error instanceof Error ? error.message : 'unbekannter Fehler'
}

function load(): MeasurementRow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function save(rows: MeasurementRow[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  } catch {
  }
}

export function getAllSteps(): MeasurementRow[] {
  return load()
}

export function clearSteps() {
  save([])
}

async function snapshotQuality(chainId: number, batchId: bigint): Promise<MeasurementRow> {
  const productGateway = addresses[chainId as keyof typeof addresses]?.ProductGateway
  if (!productGateway) return {}
  try {
    const q = await readContract(config, {
      address: productGateway,
      abi: productGatewayAbi,
      functionName: 'getQualityData',
      args: [batchId],
    })
    const [si, phqi, mci, qi, state, reason] = q as readonly [bigint, bigint, bigint, bigint, number, number]
    let priceCents: string | number = 'not sellable'
    try {
      const price = await readContract(config, {
        address: productGateway,
        abi: productGatewayAbi,
        functionName: 'getPrice',
        args: [batchId, JAR_GRAMS],
      })
      priceCents = Number(price)
    } catch {
      // NotSellable: getPrice reverted, wie beim Runner.
    }
    return {
      si: Number(si), phqi: Number(phqi), mci: Number(mci), qi: Number(qi),
      state: STATES[state] ?? state, reason: REASONS[reason] ?? reason, priceCents,
    }
  } catch {
    return {}
  }
}

export type RecordStepInput = {
  chainId: number
  batchId: bigint | number | undefined
  step: string
  actor: string
  address?: string
  txHash: string
  gasUsed: bigint
  gasPriceWei?: bigint
  durationMs: number
  timings?: StepTimings
  walletTiming?: { walletConfirmMs: number; miningMs: number }
  note?: string
}

export async function recordStep(input: RecordStepInput): Promise<void> {
  const { chainId, batchId, step, actor, address, txHash, gasUsed, gasPriceWei, durationMs, timings, walletTiming, note } = input
  const total = Math.round(durationMs)
  const walletConfirmMs = walletTiming?.walletConfirmMs ?? 0
  const miningMs = walletTiming?.miningMs ?? 0
  const t = timings ?? { renderMs: 0, uploadMs: 0, chainMs: walletTiming ? walletConfirmMs + miningMs : total }
  const row: MeasurementRow = {
    timestamp: new Date().toISOString(),
    outcome: 'success',
    network: NETWORK_NAMES[chainId] ?? '',
    chainId,
    batchId: batchId !== undefined ? Number(batchId) : '',
    step,
    actor,
    address: address ?? '',
    txHash,
    gasUsed: Number(gasUsed),
    gasPriceWei: gasPriceWei !== undefined ? gasPriceWei.toString() : '',
    feeWei: gasPriceWei !== undefined ? (gasUsed * gasPriceWei).toString() : '',
    durationMs: total,
    renderMs: t.renderMs,
    uploadMs: t.uploadMs,
    chainMs: t.chainMs,
    walletConfirmMs,
    miningMs,
    otherMs: total - t.renderMs - t.uploadMs - t.chainMs,
    note: note ?? '',
  }
  if (batchId !== undefined) {
    Object.assign(row, await snapshotQuality(chainId, BigInt(batchId)))
  }
  const rows = load()
  rows.push(row)
  save(rows)
}

export type RecordErrorInput = {
  chainId: number
  batchId: bigint | number | undefined
  step: string
  actor: string
  address?: string
  message: string
}

export function recordError(input: RecordErrorInput): void {
  const { chainId, batchId, step, actor, address, message } = input
  const row: MeasurementRow = {
    timestamp: new Date().toISOString(),
    outcome: 'error',
    network: NETWORK_NAMES[chainId] ?? '',
    chainId,
    batchId: batchId !== undefined ? Number(batchId) : '',
    step,
    actor,
    address: address ?? '',
    note: message,
  }
  const rows = load()
  rows.push(row)
  save(rows)
}

export function toCsv(rows: MeasurementRow[]): string {
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  const cell = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`
  return [headers.join(','), ...rows.map((r) => headers.map((h) => cell(r[h])).join(','))].join('\n')
}

export function roleLabel(roles: { beekeeper: boolean; bottler: boolean; retailer: boolean; logistics: boolean }): string {
  if (roles.beekeeper) return 'beekeeper'
  if (roles.bottler) return 'bottler'
  if (roles.retailer) return 'retailer'
  if (roles.logistics) return 'logistics'
  return 'unknown'
}

function downloadBlob(content: string, filenamePrefix: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filenamePrefix}-${new Date().toISOString().replaceAll(':', '-')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadCsv(): void {
  downloadBlob(toCsv(load()), 'measurements')
}

export function computeRunSummaries(rows: MeasurementRow[]): MeasurementRow[] {
  const byBatch = new Map<number, MeasurementRow[]>()
  for (const row of rows) {
    if (row.batchId === '' || row.batchId === undefined) continue
    const batchId = Number(row.batchId)
    const existing = byBatch.get(batchId)
    if (existing) existing.push(row)
    else byBatch.set(batchId, [row])
  }

  const summaries: MeasurementRow[] = []
  for (const [batchId, batchRows] of byBatch) {
    const successRows = batchRows.filter((r) => r.outcome !== 'error')
    const errorRows = batchRows.filter((r) => r.outcome === 'error')
    const sum = (key: string) => successRows.reduce((total, r) => total + Number(r[key] || 0), 0)
    const gasByActor: Record<string, number> = {}
    for (const r of successRows) {
      const actor = String(r.actor)
      gasByActor[actor] = (gasByActor[actor] ?? 0) + Number(r.gasUsed || 0)
    }
    const totalFeeWei = successRows.reduce((total, r) => (r.feeWei ? total + BigInt(String(r.feeWei)) : total), 0n)
    const first = batchRows[0]
    const lastOverall = batchRows[batchRows.length - 1]
    const lastSuccess = successRows[successRows.length - 1]
    summaries.push({
      batchId,
      network: first.network ?? '',
      stepCount: successRows.length,
      errorCount: errorRows.length,
      custodyTransfers: successRows.filter((r) => r.step === 'transferCustody').length,
      totalGas: sum('gasUsed'),
      ...Object.fromEntries(Object.entries(gasByActor).map(([actor, gas]) => [`gas_${actor}`, gas])),
      totalFeeWei: totalFeeWei.toString(),
      offChainMs: sum('renderMs') + sum('uploadMs'),
      onChainMs: sum('chainMs'),
      walletConfirmMs: sum('walletConfirmMs'),
      miningMs: sum('miningMs'),
      finalQi: lastSuccess?.qi ?? '',
      finalState: lastSuccess?.state ?? '',
      finalReason: lastSuccess?.reason ?? '',
      finalPriceCents: lastSuccess?.priceCents ?? '',
      firstTimestamp: first.timestamp,
      lastTimestamp: lastOverall.timestamp,
      wallClockMs: new Date(String(lastOverall.timestamp)).getTime() - new Date(String(first.timestamp)).getTime(),
    })
  }
  return summaries
}

export function downloadRunsCsv(): void {
  downloadBlob(toCsv(computeRunSummaries(load())), 'runs')
}
