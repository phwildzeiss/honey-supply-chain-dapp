import { useEffect, useRef } from 'react'

export type TxTimingSplit = { walletConfirmMs: number; miningMs: number; totalMs: number }

// Trennt die Dauer einer Wallet-Transaktion in zwei Phasen: die Zeit vom Absenden bis der Hash da ist
// (Warten auf den Menschen im MetaMask-Popup) und die Zeit danach bis zur Bestätigung (reine
// Netzwerk-/Mining-Zeit). Nur Letztere ist mit fullBatchFlow.ts' chainMs vergleichbar, da dort
// niemand klickt (ethers signiert automatisch). `hash` ist das `.data` des jeweiligen
// useWrite...()-Hooks — sobald es sich von undefined auf einen Wert ändert, gilt die Wallet-Phase
// als abgeschlossen.
export function useTxTiming(hash: `0x${string}` | undefined) {
  const submittedAt = useRef<number | null>(null)
  const hashReceivedAt = useRef<number | null>(null)

  useEffect(() => {
    if (hash && hashReceivedAt.current === null) hashReceivedAt.current = performance.now()
    if (!hash) hashReceivedAt.current = null
  }, [hash])

  function markSubmitted(): void {
    submittedAt.current = performance.now()
    hashReceivedAt.current = null
  }

  function split(): TxTimingSplit {
    const now = performance.now()
    const walletConfirmMs = submittedAt.current !== null && hashReceivedAt.current !== null
      ? Math.round(hashReceivedAt.current - submittedAt.current) : 0
    const miningMs = hashReceivedAt.current !== null ? Math.round(now - hashReceivedAt.current) : 0
    return { walletConfirmMs, miningMs, totalMs: walletConfirmMs + miningMs }
  }

  return { markSubmitted, split }
}
