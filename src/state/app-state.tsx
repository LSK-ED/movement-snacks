import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { buildDemoHistory } from '@/data/demo'
import type {
  CheckIn,
  DayRecord,
  Plan,
  PlannedItem,
  SessionLog,
  Settings,
} from '@/domain/types'
import { toDateKey } from '@/lib/dates'
import { createStore, localStorageBackend, toCsv } from '@/lib/storage'

const store = createStore(localStorageBackend())
/** Guards against double-counting an open (React StrictMode runs effects twice). */
const openedDays = new Set<string>()

interface AppState {
  today: string
  settings: Settings
  todayRecord: DayRecord
  /** Days before today, oldest first. */
  history: DayRecord[]
  allDays: DayRecord[]
  updateSettings(patch: Partial<Settings>): void
  saveCheckIn(checkIn: CheckIn): void
  savePlan(plan: Plan): void
  updateItem(itemId: string, patch: Partial<PlannedItem>): void
  /** Saves or updates a session on its own day — safe to call as it progresses. */
  logSession(log: SessionLog): void
  sessionStarted(): void
  touch(): void
  setDemoData(on: boolean): void
  deleteAll(): void
  exportJson(): string
  exportCsv(): string
}

const Ctx = createContext<AppState | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [today, setToday] = useState(() => toDateKey())
  const [settings, setSettings] = useState(() => store.getSettings())
  const [days, setDays] = useState(() => store.listDays())
  const refresh = useCallback(() => setDays(store.listDays()), [])

  // Record app opens (and roll over at midnight if left open).
  useEffect(() => {
    const now = new Date().toISOString()
    store.closePastDays(today)
    if (!openedDays.has(today)) {
      openedDays.add(today)
      store.updateDay(today, (d) => ({
        ...d,
        usage: {
          firstOpen: d.usage?.firstOpen ?? now,
          lastInteraction: now,
          opens: (d.usage?.opens ?? 0) + 1,
          sessionsStarted: d.usage?.sessionsStarted ?? 0,
        },
        demo: undefined,
      }))
    }
    refresh()
    const id = setInterval(() => {
      const key = toDateKey()
      setToday((t) => (t === key ? t : key))
    }, 60_000)
    return () => clearInterval(id)
  }, [today, refresh])

  const mutateDay = useCallback(
    (date: string, fn: (d: DayRecord) => DayRecord) => {
      const now = new Date().toISOString()
      store.updateDay(date, (d) => {
        const next = fn(d)
        return {
          ...next,
          usage: next.usage && { ...next.usage, lastInteraction: now },
        }
      })
      refresh()
    },
    [refresh],
  )
  const mutateToday = useCallback(
    (fn: (d: DayRecord) => DayRecord) => mutateDay(today, fn),
    [today, mutateDay],
  )

  const value = useMemo<AppState>(() => {
    const todayRecord = days.find((d) => d.date === today) ?? {
      date: today,
      sessions: [],
    }
    return {
      today,
      settings,
      todayRecord,
      history: days.filter((d) => d.date < today),
      allDays: days,
      updateSettings(patch) {
        const next = { ...settings, ...patch }
        store.saveSettings(next)
        setSettings(next)
      },
      saveCheckIn(checkIn) {
        mutateToday((d) => ({ ...d, checkIn, plan: undefined }))
      },
      savePlan(plan) {
        mutateToday((d) => ({ ...d, plan }))
      },
      updateItem(itemId, patch) {
        mutateToday((d) =>
          d.plan
            ? {
                ...d,
                plan: {
                  ...d.plan,
                  items: d.plan.items
                    .map((i) => (i.id === itemId ? { ...i, ...patch } : i))
                    .sort((a, b) => a.time.localeCompare(b.time)),
                },
              }
            : d,
        )
      },
      logSession(log) {
        mutateDay(log.date, (d) => ({
          ...d,
          sessions: [...d.sessions.filter((s) => s.id !== log.id), log],
          plan: d.plan && {
            ...d.plan,
            items: d.plan.items.map((i) =>
              i.id === log.itemId ? { ...i, status: log.status } : i,
            ),
          },
        }))
      },
      sessionStarted() {
        mutateToday((d) => ({
          ...d,
          usage: d.usage && {
            ...d.usage,
            sessionsStarted: d.usage.sessionsStarted + 1,
          },
        }))
      },
      touch() {
        mutateToday((d) => d)
      },
      setDemoData(on) {
        if (on) store.seedDemo(buildDemoHistory(today, settings))
        else store.clearDemo()
        const next = { ...settings, demoData: on }
        store.saveSettings(next)
        setSettings(next)
        refresh()
      },
      deleteAll() {
        store.deleteAll()
        setSettings(store.getSettings())
        refresh()
      },
      exportJson: () => JSON.stringify(store.exportAll(), null, 2),
      exportCsv: () => toCsv(store.listDays()),
    }
  }, [days, today, settings, mutateDay, mutateToday, refresh])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAppState(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider')
  return ctx
}
