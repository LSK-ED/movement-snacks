import { getExercise } from '@/data/exercises'
import {
  DEFAULT_SETTINGS,
  type CheckIn,
  type DateKey,
  type DayRecord,
  type PostCheck,
  type SessionLog,
} from '@/domain/types'
import type { Context } from './rules'

export const TODAY: DateKey = '2026-10-13'

export function checkIn(over: Partial<CheckIn> = {}): CheckIn {
  return {
    date: TODAY,
    at: `${TODAY}T09:00:00Z`,
    pain: 0,
    painAreas: [],
    stiffness: 0,
    stiffAreas: [],
    energy: 4,
    sleep: 4,
    timeAvailable: 'some',
    redFlags: [],
    ...over,
  }
}

export function context(over: Partial<Context> = {}): Context {
  return {
    date: TODAY,
    checkIn: checkIn(),
    history: [],
    settings: {
      ...DEFAULT_SETTINGS,
      equipment: ['chair', 'wall', 'table', 'dumbbells', 'band', 'step'],
    },
    adjustments: { lessAreas: [], noJumping: false, noLongSession: false },
    ...over,
  }
}

export function session(
  date: DateKey,
  exerciseIds: string[],
  opts: {
    kind?: SessionLog['kind']
    category?: SessionLog['category']
    post?: Partial<PostCheck>
  } = {},
): SessionLog {
  return {
    id: `${date}-${exerciseIds.join('-')}`,
    date,
    itemId: 'x',
    kind: opts.kind ?? 'session',
    category: opts.category ?? 'strength',
    startedAt: `${date}T12:00:00Z`,
    endedAt: `${date}T12:12:00Z`,
    durationSec: 720,
    status: 'completed',
    exercises: exerciseIds.map((id) => {
      const ex = getExercise(id)
      return {
        exerciseId: id,
        primary: ex.primary,
        intensity: ex.intensity,
        variation: 'standard',
        target: ex.dose,
        repsDone: ex.dose.kind === 'reps' ? ex.dose.reps : undefined,
        secondsDone: ex.dose.kind === 'time' ? ex.dose.seconds : undefined,
        status: 'done',
      }
    }),
    post: {
      energy: 4,
      painChange: 'same',
      stiffnessChange: 'same',
      rpe: 7,
      redFlags: [],
      ...opts.post,
    },
  }
}

export function day(date: DateKey, sessions: SessionLog[]): DayRecord {
  return { date, sessions }
}
