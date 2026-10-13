import { describe, expect, it } from 'vitest'
import { getExercise } from '@/data/exercises'
import type { Plan } from '@/domain/types'
import { addDays } from '@/lib/dates'
import { buildPlan } from './planner'
import { assessReadiness, hiitAllowed, progressionFactor } from './rules'
import { TODAY, checkIn, context, day, session } from './test-helpers'

const YESTERDAY = addDays(TODAY, -1)
const TWO_DAYS_AGO = addDays(TODAY, -2)

const allExercises = (plan: Plan) =>
  plan.items.flatMap((i) => i.exercises.map((e) => getExercise(e.exerciseId)))
const loadingExercises = (plan: Plan) =>
  allExercises(plan).filter(
    (e) => e.category === 'strength' || e.category === 'cardio',
  )

describe('sore day vs fresh day', () => {
  it('fresh day: good readiness, offers a longer session', () => {
    const plan = buildPlan(context())
    expect(assessReadiness(context()).level).toBe('good')
    expect(plan.longSession.offered).toBe(true)
    expect(
      plan.items.filter((i) => i.kind === 'snack').length,
    ).toBeGreaterThanOrEqual(4)
  })

  it('sore day: low readiness, low-intensity only, no longer session', () => {
    const ctx = context({
      checkIn: checkIn({ pain: 2, painAreas: ['quads', 'glutes'] }),
    })
    const plan = buildPlan(ctx)
    expect(assessReadiness(ctx).level).toBe('low')
    expect(plan.longSession.offered).toBe(false)
    expect(plan.items.some((i) => i.id === 'long')).toBe(false)
    expect(allExercises(plan).every((e) => e.intensity === 'low')).toBe(true)
    // Sore areas aren't loaded.
    for (const e of loadingExercises(plan)) {
      expect(e.primary).not.toContain('quads')
      expect(e.primary).not.toContain('glutes')
    }
  })
})

describe('consecutive-day muscle group avoidance', () => {
  it('does not load areas worked hard yesterday', () => {
    const history = [
      day(YESTERDAY, [
        session(YESTERDAY, ['goblet-squat', 'split-squat', 'db-rdl']),
      ]),
    ]
    const plan = buildPlan(context({ history }))
    for (const e of loadingExercises(plan)) {
      for (const area of ['quads', 'glutes', 'hamstrings'] as const) {
        expect(e.primary, `${e.id} loads ${area}`).not.toContain(area)
      }
    }
    expect(plan.reasoning.join(' ')).toMatch(/worked hard yesterday/)
  })

  it('treats hard work two days ago plus soreness today as DOMS', () => {
    const history = [
      day(TWO_DAYS_AGO, [
        session(TWO_DAYS_AGO, ['incline-push-up', 'db-press']),
      ]),
    ]
    const plan = buildPlan(
      context({ history, checkIn: checkIn({ pain: 1, painAreas: [] }) }),
    )
    for (const e of loadingExercises(plan))
      expect(e.primary).not.toContain('chest')
    expect(plan.reasoning.join(' ')).toMatch(/DOMS/)
  })
})

describe('high-intensity spacing', () => {
  const intervalsYesterday = [
    day(YESTERDAY, [
      session(YESTERDAY, ['fast-feet', 'skater-steps'], {
        category: 'cardio',
        post: { rpe: 6 },
      }),
    ]),
  ]

  it('never schedules intervals on back-to-back days', () => {
    const ctx = context({ history: intervalsYesterday })
    expect(hiitAllowed(ctx, 'good').allowed).toBe(false)
    const plan = buildPlan(ctx)
    expect(plan.items.find((i) => i.id === 'long')?.title).not.toBe(
      'Interval session',
    )
    expect(allExercises(plan).some((e) => e.intensity === 'high')).toBe(false)
  })

  it('allows intervals after a rest day when fresh', () => {
    const history = [
      day(
        TWO_DAYS_AGO,
        intervalsYesterday[0].sessions.map((s) => ({
          ...s,
          date: TWO_DAYS_AGO,
        })),
      ),
    ]
    expect(hiitAllowed(context({ history }), 'good').allowed).toBe(true)
  })

  it('caps interval sessions per week', () => {
    const history = [3, 5].map((n) => {
      const d = addDays(TODAY, -n)
      return day(d, [session(d, ['fast-feet'], { category: 'cardio' })])
    })
    expect(hiitAllowed(context({ history }), 'good').allowed).toBe(false)
  })

  it('no intervals when stiff or energy is low', () => {
    expect(
      hiitAllowed(context({ checkIn: checkIn({ stiffness: 2 }) }), 'good')
        .allowed,
    ).toBe(false)
    expect(hiitAllowed(context(), 'low').allowed).toBe(false)
  })
})

describe('low-energy fallback', () => {
  it('still plans gentle snacks and an easy walk instead of nothing', () => {
    const plan = buildPlan(context({ checkIn: checkIn({ energy: 1 }) }))
    expect(
      plan.items.filter((i) => i.kind === 'snack').length,
    ).toBeGreaterThanOrEqual(3)
    expect(allExercises(plan).every((e) => e.intensity === 'low')).toBe(true)
    expect(plan.items.some((i) => i.id === 'walk')).toBe(true)
    expect(plan.reasoning[0]).toMatch(/small win/)
  })
})

describe('red flags', () => {
  it('chest pain or dizziness stops all exercise suggestions', () => {
    for (const kind of ['chest-pain', 'dizziness'] as const) {
      const plan = buildPlan(
        context({ checkIn: checkIn({ redFlags: [{ kind, text: 'x' }] }) }),
      )
      expect(plan.items).toHaveLength(0)
      expect(plan.safetyStop).toMatch(/doctor/)
    }
  })

  it('sharp pain in an area removes that area completely', () => {
    const plan = buildPlan(
      context({
        checkIn: checkIn({
          pain: 2,
          painAreas: ['knees'],
          redFlags: [
            { kind: 'sharp-pain', area: 'knees', text: 'sharp knee pain' },
          ],
        }),
      }),
    )
    for (const e of allExercises(plan)) {
      expect([...e.primary, ...e.secondary]).not.toContain('knees')
    }
    expect(plan.reasoning.join(' ')).toMatch(/GP or physio/)
  })

  it('a red flag from a recent post-session check carries into today', () => {
    const s = session(YESTERDAY, ['wall-slides'], {
      kind: 'snack',
      post: {
        redFlags: [
          { kind: 'sharp-pain', area: 'shoulders', text: 'sharp shoulder' },
        ],
      },
    })
    const plan = buildPlan(context({ history: [day(YESTERDAY, [s])] }))
    for (const e of allExercises(plan))
      expect([...e.primary, ...e.secondary]).not.toContain('shoulders')
  })
})

describe('progression', () => {
  it('nudges up after a comfortable, complete session', () => {
    const s = session(YESTERDAY, ['sit-to-stand'], {
      kind: 'snack',
      post: { rpe: 4 },
    })
    expect(
      progressionFactor(
        'sit-to-stand',
        context({ history: [day(YESTERDAY, [s])] }),
      ).factor,
    ).toBeGreaterThan(1)
  })

  it('backs off after a hard session or poor recovery', () => {
    const hard = session(YESTERDAY, ['sit-to-stand'], { post: { rpe: 9 } })
    const worse = session(YESTERDAY, ['sit-to-stand'], {
      post: { rpe: 5, painChange: 'worse' },
    })
    expect(
      progressionFactor(
        'sit-to-stand',
        context({ history: [day(YESTERDAY, [hard])] }),
      ).factor,
    ).toBeLessThan(1)
    expect(
      progressionFactor(
        'sit-to-stand',
        context({ history: [day(YESTERDAY, [worse])] }),
      ).factor,
    ).toBeLessThan(1)
  })
})

describe('settings and adjustments', () => {
  it('respects equipment, excluded areas and no-jumping', () => {
    const ctx = context({
      settings: {
        ...context().settings,
        equipment: [],
        excludedAreas: ['neck'],
      },
      adjustments: { lessAreas: [], noJumping: true, noLongSession: false },
    })
    const plan = buildPlan(ctx)
    for (const e of allExercises(plan)) {
      expect(e.equipment).toEqual([])
      expect(e.impact).toBeFalsy()
      expect([...e.primary, ...e.secondary]).not.toContain('neck')
    }
  })

  it('fits a short time budget', () => {
    const plan = buildPlan(
      context({
        adjustments: {
          lessAreas: [],
          noJumping: false,
          noLongSession: false,
          maxMinutes: 10,
        },
      }),
    )
    expect(plan.items.some((i) => i.id === 'long')).toBe(false)
    expect(plan.items.reduce((t, i) => t + i.minutes, 0)).toBeLessThanOrEqual(
      10,
    )
  })
})

describe('sore joints', () => {
  it('sore knees keep squats, lunges and step-ups out of the plan', () => {
    const plan = buildPlan(
      context({
        checkIn: checkIn({ pain: 1, painAreas: ['knees'], energy: 4 }),
      }),
    )
    for (const e of allExercises(plan)) {
      if (e.intensity !== 'low')
        expect([...e.primary, ...e.secondary]).not.toContain('knees')
    }
  })
})
