import { EXERCISES, getExercise } from '@/data/exercises'
import type {
  BodyArea,
  Dose,
  Exercise,
  Plan,
  PlannedExercise,
  PlannedItem,
} from '@/domain/types'
import { fromMinutes, toMinutes } from '@/lib/dates'
import {
  RULES,
  SITTING_ROTATION,
  areasToProtect,
  assessReadiness,
  blockedAreas,
  dayBefore,
  isEligible,
  longSessionDecision,
  progressionFactor,
  safetyStop,
  snackCount,
  type Context,
  type LongType,
  type Readiness,
} from './rules'

// Turns the rules into a concrete plan. Choices are deterministic for a given
// day so re-opening the app shows the same plan.

export interface PlanOptions {
  /** Minutes since midnight; snacks aren't scheduled in the past. */
  nowMinutes?: number
}

export function buildPlan(ctx: Context, opts: PlanOptions = {}): Plan {
  const stop = safetyStop(ctx.checkIn)
  const base = {
    date: ctx.date,
    createdAt: new Date().toISOString(),
    accepted: false,
    adjustments: ctx.adjustments,
  }
  if (stop) {
    return {
      ...base,
      reasoning: [stop],
      items: [],
      longSession: { offered: false, note: 'Not today.' },
      safetyStop: stop,
    }
  }

  const readiness = assessReadiness(ctx)
  const protectedAreas = areasToProtect(ctx)
  const blocked = blockedAreas(ctx)
  const eligible = (ex: Exercise) =>
    isEligible(ex, ctx, readiness.level, protectedAreas, blocked)
  const pool = EXERCISES.filter(eligible)
  const yesterdayIds = new Set(
    dayBefore(ctx)?.sessions.flatMap((s) =>
      s.exercises.map((e) => e.exerciseId),
    ),
  )
  const rng = seeded(ctx.date + JSON.stringify(ctx.adjustments))

  const reasoning: string[] = [headline(readiness.level, readiness.reasons)]
  const protectedNotes = groupReasons(protectedAreas)
  if (protectedNotes) reasoning.push(protectedNotes)
  if (blocked.length)
    reasoning.push(
      `Leaving out ${list(blocked)} entirely.` +
        (ctx.checkIn.redFlags.length
          ? ' Sharp or worsening pain isn’t normal soreness — if it persists, see a GP or physio.'
          : ''),
    )

  // Snacks.
  // Planning late in the day: fewer snacks, roughly one per 45 minutes left.
  const minutesLeft =
    opts.nowMinutes === undefined
      ? Infinity
      : toMinutes(ctx.settings.dayEnd) - opts.nowMinutes
  const n = Math.min(
    snackCount(ctx, readiness.level),
    Math.max(2, Math.floor(minutesLeft / 45) + 1),
  )
  const rotationStart = Math.floor(rng() * SITTING_ROTATION.length)
  const usedToday = new Set<string>()
  const items: PlannedItem[] = []
  const progressed: string[] = []

  for (let i = 0; i < n; i++) {
    const slot = SITTING_ROTATION[(rotationStart + i) % SITTING_ROTATION.length]
    const picks = pickSnack(
      slot.areas,
      pool,
      readiness.level,
      yesterdayIds,
      usedToday,
      rng,
    )
    if (!picks.length) continue
    picks.forEach((p) => usedToday.add(p.id))
    const exercises = picks.map((ex) => {
      const prog = progressionFactor(ex.id, ctx)
      const lowDay = readiness.level === 'low'
      if (!lowDay && prog.factor > 1) progressed.push(ex.name)
      const factor = lowDay ? Math.min(1, prog.factor) * 0.75 : prog.factor
      return planned(
        ex,
        factor,
        ex.category === 'mobility' ? RULES.rpe.mobility : RULES.rpe.snack,
      )
    })
    items.push({
      id: `snack-${i + 1}`,
      kind: 'snack',
      title: slot.label,
      time: '',
      focus: unique(picks.flatMap((p) => p.primary)),
      category: sameCategory(picks),
      intensity: picks.some((p) => p.intensity !== 'low') ? 'moderate' : 'low',
      minutes: Math.max(
        1,
        Math.round(exercises.reduce((t, e) => t + seconds(e), 0) / 60),
      ),
      exercises,
      status: 'pending',
      why: snackWhy(slot.label, picks),
    })
  }

  // Longer session (or a lighter alternative).
  const decision = longSessionDecision(ctx, readiness.level)
  let longSession: Plan['longSession']
  if (decision.offer) {
    const session = buildLongSession(decision.type, pool, ctx, rng)
    if (session) {
      items.push(session)
      longSession = {
        offered: true,
        note: `Offering ${decision.type === 'weights' ? 'a strength session' : 'an interval session'}: ${decision.reason}.`,
      }
    } else {
      longSession = {
        offered: false,
        note: 'Not enough suitable exercises for a longer session with today’s limits.',
      }
    }
  } else {
    longSession = {
      offered: false,
      note: `No longer session today — ${decision.reason}.`,
    }
    const walk = EXERCISES.find((e) => e.id === 'easy-walk')
    const walkOk =
      walk &&
      eligible(walk) &&
      ctx.checkIn.timeAvailable !== 'little' &&
      ctx.adjustments.maxMinutes === undefined &&
      !ctx.adjustments.noLongSession
    if (walk && walkOk) {
      items.push({
        id: 'walk',
        kind: 'session',
        title: 'Easy walk (optional)',
        time: '',
        focus: walk.primary,
        category: 'cardio',
        intensity: 'low',
        minutes: 10,
        exercises: [planned(walk, 1, 3)],
        status: 'pending',
        why: 'Gentle movement helps stiffness and soreness settle without adding load.',
      })
    }
  }
  reasoning.push(longSession.note)
  if (progressed.length) {
    const names = unique(progressed)
    const named =
      names.length > 2
        ? `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`
        : list(names)
    reasoning.push(
      `${named} felt comfortable last time, so I’ve nudged reps or time up slightly.`,
    )
  }

  schedule(items, ctx.settings.dayStart, ctx.settings.dayEnd, opts.nowMinutes)
  trimToBudget(items, ctx.adjustments.maxMinutes)

  return { ...base, reasoning, items, longSession }
}

// ── Snacks ─────────────────────────────────────────────────────────────────

function pickSnack(
  areas: BodyArea[],
  pool: Exercise[],
  readiness: Readiness,
  yesterday: Set<string>,
  usedToday: Set<string>,
  rng: () => number,
): Exercise[] {
  const shortEnough = (e: Exercise) =>
    e.dose.kind === 'reps' || e.dose.seconds <= 90
  const hits = (e: Exercise) => e.primary.some((a) => areas.includes(a))
  const score = (e: Exercise) =>
    (hits(e) ? 10 : 0) -
    (usedToday.has(e.id) ? 6 : 0) -
    (yesterday.has(e.id) ? 2 : 0) +
    rng()
  const best = (filter: (e: Exercise) => boolean) =>
    pool
      .filter((e) => shortEnough(e) && filter(e))
      .sort((a, b) => score(b) - score(a))[0]

  const mobility =
    best((e) => e.category === 'mobility' && hits(e)) ??
    best((e) => e.category === 'mobility')
  const second =
    readiness === 'low'
      ? best(
          (e) =>
            e.id !== mobility?.id &&
            (e.category === 'activation' || e.id === 'march'),
        )
      : (best(
          (e) =>
            e.id !== mobility?.id &&
            e.category !== 'mobility' &&
            e.intensity !== 'high' &&
            hits(e),
        ) ??
        best(
          (e) =>
            e.id !== mobility?.id &&
            e.category !== 'mobility' &&
            e.intensity !== 'high',
        ))
  return [mobility, second].filter((e): e is Exercise => !!e)
}

function snackWhy(label: string, picks: Exercise[]): string {
  const moves = picks.map((p) => p.name.toLowerCase()).join(' then ')
  return `${label}: ${moves} — breaks up sitting and keeps this area moving.`
}

// ── Long session ───────────────────────────────────────────────────────────

function buildLongSession(
  type: LongType,
  pool: Exercise[],
  ctx: Context,
  rng: () => number,
): PlannedItem | undefined {
  const pick = (f: (e: Exercise) => boolean, exclude: string[] = []) =>
    pool
      .filter((e) => f(e) && !exclude.includes(e.id))
      .sort(() => rng() - 0.5)[0]

  const warmup = [
    pool.find((e) => e.id === 'march') ??
      pick((e) => e.category === 'cardio' && e.intensity === 'low'),
    pick((e) => e.category === 'mobility' && e.dose.kind === 'reps'),
  ].filter((e): e is Exercise => !!e)
  if (!warmup.length) return undefined
  const warmPlanned = warmup.map((e) => ({
    ...planned(e, 1, RULES.rpe.warmup),
    role: 'warmup' as const,
  }))

  let main: PlannedExercise[] = []
  if (type === 'intervals') {
    const hi = pool
      .filter((e) => e.category === 'cardio' && e.intensity === 'high')
      .sort(() => rng() - 0.5)
      .slice(0, 2)
    if (!hi.length) return undefined
    // 30 s on / 30 s easy, ~8 rounds split across the moves.
    main = hi.map((e) => ({
      exerciseId: e.id,
      dose: { kind: 'time', seconds: 30 },
      role: 'main',
      rpe: RULES.rpe.intervals,
      rounds: hi.length === 1 ? 8 : 4,
      restSeconds: 30,
    }))
  } else {
    const patterns = [
      ['squat', 'lunge'],
      ['push'],
      ['hinge'],
      ['pull'],
      ['core'],
    ]
    const chosen: Exercise[] = []
    for (const p of patterns) {
      const e = pick(
        (x) =>
          x.category !== 'mobility' &&
          x.intensity !== 'high' &&
          p.includes(x.pattern),
        chosen.map((c) => c.id),
      )
      if (e) chosen.push(e)
    }
    if (chosen.length < 2) return undefined
    const rpe =
      assessReadiness(ctx).level === 'moderate' ? 6 : RULES.rpe.weights
    main = chosen.slice(0, 4).map((e) => ({
      ...planned(e, progressionFactor(e.id, ctx).factor, rpe),
      rounds: 2,
      restSeconds: 45,
    }))
  }
  const cool = pool.find(
    (e) => e.category === 'mobility' && e.dose.kind === 'time',
  )
  const exercises = [
    ...warmPlanned,
    ...main,
    ...(cool ? [{ ...planned(cool, 1, 2), role: 'cooldown' as const }] : []),
  ]
  const minutes = Math.round(exercises.reduce((t, e) => t + seconds(e), 0) / 60)
  const focus = unique(main.flatMap((m) => getExercise(m.exerciseId).primary))
  return {
    id: 'long',
    kind: 'session',
    title: type === 'weights' ? 'Strength session' : 'Interval session',
    time: '',
    focus,
    category: type === 'weights' ? 'strength' : 'cardio',
    intensity: type === 'weights' ? 'moderate' : 'high',
    minutes: Math.max(10, Math.min(15, minutes)),
    exercises,
    status: 'pending',
    why:
      type === 'weights'
        ? `Warm-up, then two rounds of ${main.length} moves at about RPE ${main[0].rpe} — challenging, with a couple of reps in reserve.`
        : `Warm-up, then 30 seconds hard (RPE ${RULES.rpe.intervals}) and 30 seconds easy, eight rounds, then cool down.`,
  }
}

// ── Doses & time ───────────────────────────────────────────────────────────

export function scaleDose(dose: Dose, factor: number): Dose {
  if (dose.kind === 'reps') {
    const raw = Math.round(dose.reps * factor)
    const capped = Math.min(raw, dose.reps + RULES.maxRepIncrease)
    return { ...dose, reps: Math.max(3, capped) }
  }
  return {
    ...dose,
    seconds: Math.max(15, Math.round((dose.seconds * factor) / 5) * 5),
  }
}

function planned(ex: Exercise, factor: number, rpe: number): PlannedExercise {
  return {
    exerciseId: ex.id,
    dose: scaleDose(ex.dose, factor),
    role: 'main',
    rpe,
  }
}

/** Rough working time for an exercise, including a short transition. */
export function seconds(p: PlannedExercise): number {
  const sides = p.dose.perSide ? 2 : 1
  const work =
    p.dose.kind === 'reps' ? p.dose.reps * 3 * sides : p.dose.seconds * sides
  const rounds = p.rounds ?? 1
  return rounds * work + (rounds - 1) * (p.restSeconds ?? 0) + 10
}

function schedule(
  items: PlannedItem[],
  dayStart: string,
  dayEnd: string,
  now?: number,
) {
  const snacks = items.filter((i) => i.kind === 'snack')
  const sessions = items.filter((i) => i.kind === 'session')
  let start = toMinutes(dayStart) + 30
  if (now !== undefined)
    start = Math.max(start, Math.ceil((now + 10) / 15) * 15)
  const end = Math.max(toMinutes(dayEnd) - 15, start + snacks.length * 30)
  const gap = snacks.length > 1 ? (end - start) / (snacks.length - 1 || 1) : 0
  snacks.forEach(
    (s, i) => (s.time = fromMinutes(Math.round((start + gap * i) / 5) * 5)),
  )
  // Longer sessions go at lunch, or between the first two snacks if it's later.
  const lunch = toMinutes('12:30')
  const slot = lunch >= start ? lunch : start + Math.round(gap / 10) * 5
  sessions.forEach(
    (s, i) => (s.time = fromMinutes(Math.min(slot + i * 240, end))),
  )
  items.sort((a, b) => a.time.localeCompare(b.time))
}

function trimToBudget(items: PlannedItem[], maxMinutes?: number) {
  if (maxMinutes === undefined) return
  let total = items.reduce((t, i) => t + i.minutes, 0)
  while (
    total > maxMinutes &&
    items.filter((i) => i.kind === 'snack').length > 2
  ) {
    const idx = items.map((i) => i.kind).lastIndexOf('snack')
    total -= items[idx].minutes
    items.splice(idx, 1)
  }
}

// ── Wording ────────────────────────────────────────────────────────────────

function headline(level: Readiness, reasons: string[]): string {
  const why = list(reasons)
  switch (level) {
    case 'low':
      return `Since ${why}, today is about gentle movement — mobility, light activation and walking. A small win still counts.`
    case 'moderate':
      return `Since ${why}, I’ve kept things moderate: regular snacks, nothing too taxing.`
    case 'good':
      return `You’re feeling fresh, so we can do a bit more today.`
    default:
      return 'Safety first today.'
  }
}

function groupReasons(map: Map<BodyArea, string>): string | undefined {
  if (!map.size) return undefined
  const byReason = new Map<string, BodyArea[]>()
  for (const [area, reason] of map)
    byReason.set(reason, [...(byReason.get(reason) ?? []), area])
  const parts = [...byReason].map(
    ([reason, areas]) => `${list(areas)} (${reason})`,
  )
  return `Only gentle movement for ${parts.join('; ')}.`
}

export function list(items: string[]): string {
  const xs = items.map((s) => s.replace(/-/g, ' '))
  if (xs.length <= 1) return xs.join('')
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)]
}

function sameCategory(picks: Exercise[]): PlannedItem['category'] {
  const cats = unique(picks.map((p) => p.category))
  return cats.length === 1 ? cats[0] : 'mixed'
}

/** Small deterministic PRNG so the same day gives the same plan. */
function seeded(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++)
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

// ── Swapping ───────────────────────────────────────────────────────────────

/** Replace each exercise in an item with the closest eligible alternative. */
export function swapItem(ctx: Context, item: PlannedItem): PlannedItem {
  const readiness = assessReadiness(ctx).level
  const protectedAreas = areasToProtect(ctx)
  const blocked = blockedAreas(ctx)
  const used = new Set(item.exercises.map((e) => e.exerciseId))
  const overlap = (a: Exercise, b: Exercise) =>
    a.primary.filter((x) => b.primary.includes(x)).length * 2 +
    (a.pattern === b.pattern ? 1 : 0)

  const exercises = item.exercises.map((p) => {
    const current = getExercise(p.exerciseId)
    const long = current.dose.kind === 'time' && current.dose.seconds > 90
    const alt = EXERCISES.filter(
      (e) =>
        !used.has(e.id) &&
        e.category === current.category &&
        e.intensity === current.intensity &&
        (long || e.dose.kind === 'reps' || e.dose.seconds <= 90) &&
        isEligible(e, ctx, readiness, protectedAreas, blocked),
    ).sort((a, b) => overlap(b, current) - overlap(a, current))[0]
    if (!alt) return p
    used.add(alt.id)
    const keepDose = p.rounds !== undefined && p.dose.kind === alt.dose.kind
    return {
      ...p,
      exerciseId: alt.id,
      dose: keepDose ? p.dose : scaleDose(alt.dose, 1),
    }
  })
  return {
    ...item,
    exercises,
    focus: unique(exercises.flatMap((e) => getExercise(e.exerciseId).primary)),
    why: `${item.title}: swapped to ${exercises.map((e) => getExercise(e.exerciseId).name.toLowerCase()).join(' then ')} for variety.`,
  }
}
