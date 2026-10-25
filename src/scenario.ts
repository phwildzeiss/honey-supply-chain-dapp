import { useEffect, useState } from 'react'
import type { LabForce, AwardForce, CertificationForce, SensorForce } from './simulator'

export type ScenarioId = 'normal' | 'entwicklung' | 'F-1' | 'F-4' | 'F-5' | 'F-6' | 'F-7'

export type ScenarioForce = {
  lab?: LabForce
  award?: AwardForce
  certification?: CertificationForce
  transport?: SensorForce
  warehouse?: SensorForce
  defrost?: SensorForce
}

export type Scenario = {
  label: string
  force: ScenarioForce
}

const SAFE_SENSORS: Pick<ScenarioForce, 'transport' | 'warehouse' | 'defrost'> = {
  transport: 'NORMAL',
  warehouse: 'NORMAL',
  defrost: 'NORMAL',
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  normal: { label: 'Normal', force: {} },
  entwicklung: { label: 'Entwicklung', force: {} },
  'F-1': { label: 'F-1 Premium', force: { lab: 'PREMIUM', award: 'GOLD', certification: 'ASSOCIATION_ORGANIC', ...SAFE_SENSORS } },
  'F-4': { label: 'F-4 Gatekeeper', force: { lab: 'PHQI_EXCLUDED', award: 'GOLD', certification: 'ASSOCIATION_ORGANIC', ...SAFE_SENSORS } },
  'F-5': { label: 'F-5 Temperaturverletzung', force: { lab: 'STANDARD', certification: 'NONE', transport: 'NORMAL', warehouse: 'NORMAL', defrost: 'VIOLATION' } },
  'F-6': { label: 'F-6 Mischcharge', force: { certification: 'NONE', ...SAFE_SENSORS } },
  'F-7': { label: 'F-7 Vollständige Lieferkette', force: { certification: 'NONE', ...SAFE_SENSORS } },
}

const STORAGE_KEY = 'activeScenario'
const CHANGE_EVENT = 'scenario-changed'

function isScenarioId(value: string): value is ScenarioId {
  return value in SCENARIOS
}

export function getActiveScenarioId(): ScenarioId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && isScenarioId(stored)) return stored
  } catch {
  }
  return 'normal'
}

export function setActiveScenarioId(id: ScenarioId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function useActiveScenario(): { id: ScenarioId; scenario: Scenario; isDev: boolean } {
  const [id, setId] = useState<ScenarioId>(getActiveScenarioId)
  useEffect(() => {
    const onChange = () => setId(getActiveScenarioId())
    window.addEventListener(CHANGE_EVENT, onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])
  return { id, scenario: SCENARIOS[id], isDev: id === 'entwicklung' }
}

const CERTIFICATION_RESET_EVENT = 'certification-reset'

export function notifyCertificationReset(): void {
  window.dispatchEvent(new Event(CERTIFICATION_RESET_EVENT))
}

export function useCertificationReset(onReset: () => void): void {
  useEffect(() => {
    window.addEventListener(CERTIFICATION_RESET_EVENT, onReset)
    return () => window.removeEventListener(CERTIFICATION_RESET_EVENT, onReset)
  }, [onReset])
}
