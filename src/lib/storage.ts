import {
  DEFAULT_SETTINGS,
  type DateKey,
  type DayRecord,
  type Settings,
} from '@/domain/types'
import { addDays } from '@/lib/dates'

// All persistence goes through this module. It speaks to a tiny key-value
// backend so localStorage can be swapped for IndexedDB (or a test double)
// without touching the rest of the app.

export interface KeyValueBackend {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
  keys(): string[]
}

export function localStorageBackend(): KeyValueBackend {
  return {
    get: (k) => localStorage.getItem(k),
    set: (k, v) => localStorage.setItem(k, v),
    remove: (k) => localStorage.removeItem(k),
    keys: () => Object.keys(localStorage),
  }
}

export function memoryBackend(): KeyValueBackend {
  const map = new Map<string, string>()
  return {
    get: (k) => map.get(k) ?? null,
    set: (k, v) => void map.set(k, v),
    remove: (k) => void map.delete(k),
    keys: () => [...map.keys()],
  }
}

const PREFIX = 'ms:'
const DAY = `${PREFIX}day:`
const SETTINGS = `${PREFIX}settings`
const SCHEMA_VERSION = 1

export interface ExportBundle {
  app: 'movement-snacks'
  version: number
  exportedAt: string
  settings: Settings
  days: DayRecord[]
}

export function createStore(backend: KeyValueBackend) {
  const read = <T>(key: string): T | undefined => {
    const raw = backend.get(key)
    if (raw == null) return undefined
    try {
      return JSON.parse(raw) as T
    } catch {
      return undefined
    }
  }

  const store = {
    getDay(date: DateKey): DayRecord | undefined {
      return read<DayRecord>(DAY + date)
    },

    /** Today's record, created empty if missing. */
    getOrCreateDay(date: DateKey): DayRecord {
      return store.getDay(date) ?? { date, sessions: [] }
    },

    saveDay(day: DayRecord): void {
      backend.set(DAY + day.date, JSON.stringify(day))
    },

    updateDay(date: DateKey, fn: (day: DayRecord) => DayRecord): DayRecord {
      const next = fn(store.getOrCreateDay(date))
      store.saveDay(next)
      return next
    },

    /** All days, oldest first. */
    listDays(): DayRecord[] {
      return backend
        .keys()
        .filter((k) => k.startsWith(DAY))
        .sort()
        .map((k) => read<DayRecord>(k))
        .filter((d): d is DayRecord => !!d)
    },

    /**
     * Closes out every real day before `today`, so history records what
     * wasn't done as well as what was: planned items never started become
     * `missed`, and days the app wasn't opened get an empty record.
     */
    closePastDays(today: DateKey): void {
      const first = store.listDays().find((d) => !d.demo)
      if (!first) return
      for (let date = first.date; date < today; date = addDays(date, 1)) {
        const day = store.getDay(date)
        if (!day) {
          store.saveDay({ date, sessions: [] })
          continue
        }
        if (day.demo || !day.plan?.items.some((i) => i.status === 'pending'))
          continue
        store.saveDay({
          ...day,
          plan: {
            ...day.plan,
            items: day.plan.items.map((i) =>
              i.status === 'pending' ? { ...i, status: 'missed' } : i,
            ),
          },
        })
      }
    },

    getSettings(): Settings {
      return { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(SETTINGS) }
    },

    saveSettings(settings: Settings): void {
      backend.set(SETTINGS, JSON.stringify(settings))
    },

    /** Writes demo days without overwriting any real ones. */
    seedDemo(days: DayRecord[]): number {
      let written = 0
      for (const day of days) {
        const existing = store.getDay(day.date)
        if (existing && !existing.demo) continue
        store.saveDay({ ...day, demo: true })
        written++
      }
      return written
    },

    clearDemo(): void {
      for (const day of store.listDays()) {
        if (day.demo) backend.remove(DAY + day.date)
      }
    },

    exportAll(): ExportBundle {
      return {
        app: 'movement-snacks',
        version: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        settings: store.getSettings(),
        days: store.listDays(),
      }
    },

    deleteAll(): void {
      for (const k of backend.keys()) {
        if (k.startsWith(PREFIX)) backend.remove(k)
      }
    },
  }
  return store
}

export type Store = ReturnType<typeof createStore>

/** One row per logged exercise — the easiest shape to open in a spreadsheet. */
export function toCsv(days: DayRecord[]): string {
  const header = [
    'date',
    'energy',
    'pain',
    'pain_areas',
    'stiffness',
    'stiff_areas',
    'session_status',
    'session_minutes',
    'exercise',
    'variation',
    'target',
    'reps_done',
    'seconds_done',
    'exercise_status',
    'post_rpe',
    'post_energy',
    'note',
  ]
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const rows: string[] = [header.join(',')]
  for (const day of days) {
    const c = day.checkIn
    const base = [
      day.date,
      c?.energy,
      c?.pain,
      c?.painAreas.join(' '),
      c?.stiffness,
      c?.stiffAreas.join(' '),
    ]
    // Planned items with no session (missed or skipped) get a row of their own.
    const logged = new Set(day.sessions.map((s) => s.itemId))
    const notDone = (day.plan?.items ?? []).filter(
      (i) => i.status !== 'pending' && !logged.has(i.id),
    )
    for (const item of notDone) {
      rows.push(
        [...base, item.status, 0, ...Array(9).fill('')].map(esc).join(','),
      )
    }
    if (day.sessions.length === 0) {
      if (!notDone.length)
        rows.push([...base, ...Array(11).fill('')].map(esc).join(','))
      continue
    }
    for (const s of day.sessions) {
      const exs = s.exercises.length ? s.exercises : [undefined]
      for (const e of exs) {
        rows.push(
          [
            ...base,
            s.status,
            Math.round(s.durationSec / 60),
            e?.exerciseId,
            e?.variation,
            e
              ? e.target.kind === 'reps'
                ? `${e.target.reps} reps`
                : `${e.target.seconds}s`
              : '',
            e?.repsDone,
            e?.secondsDone,
            e?.status,
            s.post?.rpe,
            s.post?.energy,
            s.post?.note,
          ]
            .map(esc)
            .join(','),
        )
      }
    }
  }
  return rows.join('\n')
}
