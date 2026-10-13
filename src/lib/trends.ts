import type { DateKey, DayRecord } from '@/domain/types'
import { addDays } from '@/lib/dates'

export interface DayStat {
  date: DateKey
  moved: boolean
  minutes: number
  planned: number
  done: number
  energy?: number
  soreness?: number
  stiffness?: number
  opened: boolean
}

/** One row per calendar day in the window ending today (inclusive), oldest first. */
export function dayStats(
  days: DayRecord[],
  today: DateKey,
  window: number,
): DayStat[] {
  const byDate = new Map(days.map((d) => [d.date, d]))
  return Array.from({ length: window }, (_, i) => {
    const date = addDays(today, i - window + 1)
    const d = byDate.get(date)
    const done = d?.sessions.filter((s) => s.status !== 'skipped') ?? []
    return {
      date,
      moved: done.length > 0,
      minutes: Math.round(done.reduce((t, s) => t + s.durationSec, 0) / 60),
      planned: d?.plan?.items.length ?? 0,
      done: done.length,
      energy: d?.checkIn?.energy,
      soreness: d?.checkIn?.pain,
      stiffness: d?.checkIn?.stiffness,
      opened: !!d?.usage,
    }
  })
}

export function summarise(stats: DayStat[]) {
  const planned = stats.reduce((t, s) => t + s.planned, 0)
  const done = stats.reduce((t, s) => t + s.done, 0)
  const avg = (xs: (number | undefined)[]) => {
    const v = xs.filter((x): x is number => x !== undefined)
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined
  }
  return {
    daysMoved: stats.filter((s) => s.moved).length,
    minutes: stats.reduce((t, s) => t + s.minutes, 0),
    completion: planned ? Math.round((done / planned) * 100) : undefined,
    energy: avg(stats.map((s) => s.energy)),
    soreness: avg(stats.map((s) => s.soreness)),
    stiffness: avg(stats.map((s) => s.stiffness)),
  }
}
