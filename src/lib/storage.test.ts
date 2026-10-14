import { describe, expect, it } from 'vitest'
import { buildDemoHistory } from '@/data/demo'
import { DEFAULT_SETTINGS } from '@/domain/types'
import { createStore, memoryBackend, toCsv } from './storage'

describe('storage', () => {
  it('round-trips days and lists them oldest first', () => {
    const store = createStore(memoryBackend())
    store.saveDay({ date: '2026-10-12', sessions: [] })
    store.saveDay({ date: '2026-10-10', sessions: [] })
    expect(store.listDays().map((d) => d.date)).toEqual([
      '2026-10-10',
      '2026-10-12',
    ])
    expect(store.getDay('2026-10-12')).toEqual({
      date: '2026-10-12',
      sessions: [],
    })
  })

  it('updateDay creates a missing day', () => {
    const store = createStore(memoryBackend())
    const d = store.updateDay('2026-10-13', (day) => ({
      ...day,
      usage: {
        firstOpen: 'a',
        lastInteraction: 'a',
        opens: 1,
        sessionsStarted: 0,
      },
    }))
    expect(d.usage?.opens).toBe(1)
    expect(store.getDay('2026-10-13')?.usage?.opens).toBe(1)
  })

  it('returns defaults merged with saved settings', () => {
    const store = createStore(memoryBackend())
    expect(store.getSettings()).toEqual(DEFAULT_SETTINGS)
    store.saveSettings({ ...DEFAULT_SETTINGS, handsFree: true })
    expect(store.getSettings().handsFree).toBe(true)
  })

  it('seeds demo data without overwriting real days, and clears only demo', () => {
    const store = createStore(memoryBackend())
    const demo = buildDemoHistory('2026-10-13', DEFAULT_SETTINGS)
    expect(demo).toHaveLength(7)
    store.saveDay({ date: demo[3].date, sessions: [] }) // a real day
    store.seedDemo(demo)
    expect(store.getDay(demo[3].date)?.demo).toBeUndefined()
    expect(store.listDays().filter((d) => d.demo)).toHaveLength(6)
    store.clearDemo()
    expect(store.listDays()).toHaveLength(1)
  })

  it('exports and deletes everything', () => {
    const backend = memoryBackend()
    backend.set('unrelated', 'keep')
    const store = createStore(backend)
    store.saveDay({ date: '2026-10-13', sessions: [] })
    expect(store.exportAll().days).toHaveLength(1)
    store.deleteAll()
    expect(store.listDays()).toHaveLength(0)
    expect(backend.get('unrelated')).toBe('keep')
  })

  it('ignores corrupt entries', () => {
    const backend = memoryBackend()
    backend.set('ms:day:2026-10-13', '{not json')
    expect(createStore(backend).listDays()).toEqual([])
  })

  it('closes out past days: unstarted items are missed, gaps get a record', () => {
    const store = createStore(memoryBackend())
    const plan = buildDemoHistory('2026-10-13', DEFAULT_SETTINGS)[0].plan!
    store.saveDay({
      date: '2026-10-10',
      sessions: [],
      plan: {
        ...plan,
        items: plan.items.map((i, k) => ({
          ...i,
          status: k === 0 ? 'completed' : 'pending',
        })),
      },
    })
    store.saveDay({ date: '2026-10-13', sessions: [] })
    store.closePastDays('2026-10-13')

    const items = store.getDay('2026-10-10')!.plan!.items
    expect(items[0].status).toBe('completed')
    expect(items.slice(1).every((i) => i.status === 'missed')).toBe(true)
    expect(store.getDay('2026-10-11')).toEqual({
      date: '2026-10-11',
      sessions: [],
    })
    expect(store.getDay('2026-10-12')).toBeDefined()
    expect(store.listDays()).toHaveLength(4)

    const csv = toCsv(store.listDays())
    expect(csv).toContain(',missed,0,')
  })

  it('does not close out from demo days alone', () => {
    const store = createStore(memoryBackend())
    store.seedDemo(buildDemoHistory('2026-10-13', DEFAULT_SETTINGS))
    const before = JSON.stringify(store.listDays())
    store.closePastDays('2026-10-20')
    expect(JSON.stringify(store.listDays())).toBe(before)
  })

  it('produces a CSV with a header row', () => {
    const csv = toCsv(buildDemoHistory('2026-10-13', DEFAULT_SETTINGS))
    expect(csv.split('\n')[0]).toMatch(/^date,energy/)
    expect(csv.split('\n').length).toBeGreaterThan(10)
  })
})
