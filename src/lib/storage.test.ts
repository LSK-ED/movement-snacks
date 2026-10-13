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

  it('produces a CSV with a header row', () => {
    const csv = toCsv(buildDemoHistory('2026-10-13', DEFAULT_SETTINGS))
    expect(csv.split('\n')[0]).toMatch(/^date,energy/)
    expect(csv.split('\n').length).toBeGreaterThan(10)
  })
})
