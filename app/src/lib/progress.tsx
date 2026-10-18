import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { DEFAULT_SETTINGS, freshProgress, withRating, type HistoryItem, type Progress, type Rating, type Settings } from "@/lib/srs"

const KEY = "iosprep.v1" // same key and shape as the earlier standalone version, so saved progress carries over

function load(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null")
    if (p && typeof p.cards === "object") return { ...freshProgress(), ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings } }
  } catch { /* storage blocked or corrupt: start fresh */ }
  return freshProgress()
}

interface Ctx {
  progress: Progress
  rate: (id: string, rating: Rating) => void
  addHistory: (h: Omit<HistoryItem, "day"> & { day: string }) => void
  setSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void
  exportJson: () => string
  importJson: (text: string) => number
  reset: () => void
  restore: (p: Progress) => void // undo: put back a snapshot taken earlier in this session
}
const ProgressCtx = createContext<Ctx | null>(null)

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<Progress>(load)
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(progress)) } catch { /* blocked */ } }, [progress])

  const rate = useCallback((id: string, r: Rating) => setProgress((p) => withRating(p, id, r)), [])
  const addHistory = useCallback((h: HistoryItem) => setProgress((p) => ({ ...p, history: [...p.history, h].slice(-200) })), [])
  const setSetting = useCallback(<K extends keyof Settings>(k: K, v: Settings[K]) => setProgress((p) => ({ ...p, settings: { ...p.settings, [k]: v } })), [])
  const value = useMemo<Ctx>(() => ({
    progress, rate, addHistory, setSetting,
    exportJson: () => JSON.stringify(progress, null, 1),
    importJson: (text) => {
      const p = JSON.parse(text)
      if (!p || typeof p.cards !== "object") throw new Error("not a progress file")
      const next = { ...freshProgress(), ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings } } as Progress
      setProgress(next)
      return Object.keys(next.cards).length
    },
    reset: () => setProgress((p) => ({ ...freshProgress(), settings: p.settings })),
    restore: setProgress,
  }), [progress, rate, addHistory, setSetting])
  return <ProgressCtx.Provider value={value}>{children}</ProgressCtx.Provider>
}

export function useProgress() {
  const c = useContext(ProgressCtx)
  if (!c) throw new Error("useProgress outside provider")
  return c
}
