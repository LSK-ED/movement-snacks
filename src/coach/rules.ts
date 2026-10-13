import type {
  BodyArea,
  CheckIn,
  DateKey,
  DayRecord,
  Exercise,
  PlanAdjustments,
  Settings,
} from '@/domain/types'
import { addDays, daysBetween } from '@/lib/dates'

// ─────────────────────────────────────────────────────────────────────────────
// Coaching rules. Every decision the planner makes about safety, recovery and
// intensity lives in this file as a small named function, so you can read the
// logic top to bottom and change a number in one place.
//
// The rules are deliberately conservative. They encode mainstream guidance:
//  • don't load the same muscle groups hard on consecutive days
//  • DOMS peaks 24–72 h after unaccustomed effort, so treat sore areas gently
//  • space high-intensity work; never back-to-back days
//  • low energy / high soreness → mobility and light movement, not nothing
//  • progress in small steps when things felt comfortable; back off otherwise
//  • red-flag symptoms stop exercise for that area (or entirely) — no diagnosis
// ─────────────────────────────────────────────────────────────────────────────

export const RULES = {
  /** Minimum days between high-intensity cardio sessions (2 = never back-to-back). */
  hiitMinDaysApart: 2,
  /** At most this many high-intensity sessions in any rolling 7 days. */
  hiitMaxPerWeek: 2,
  /** Delayed onset muscle soreness window, in days, after hard work. */
  domsWindowDays: 3,
  /** Progress reps/time by this fraction when the last go felt comfortable. */
  progressionStep: 0.1,
  /** Back off by this fraction after a hard or poorly recovered session. */
  backOffStep: 0.2,
  /** RPE at or below this counts as "comfortable". */
  comfortableRpe: 6,
  /** RPE at or above this counts as "hard". */
  hardRpe: 8,
  /** Never progress more than this many reps in one step. */
  maxRepIncrease: 2,
  /** Target RPE ranges. */
  rpe: { mobility: 3, snack: 5, weights: 7, intervals: 8, warmup: 3 },
} as const

export type Readiness = 'stop' | 'low' | 'moderate' | 'good'

export interface Context {
  date: DateKey
  checkIn: CheckIn
  /** Previous days, any order. Today's record is ignored here. */
  history: DayRecord[]
  settings: Settings
  adjustments: PlanAdjustments
}

const SYSTEMIC_FLAGS = new Set(['dizziness', 'chest-pain'])

// ── Red flags ───────────────────────────────────────────────────────────────

/** Dizziness or chest pain → no exercise suggestions at all today. */
export function safetyStop(checkIn: CheckIn): string | undefined {
  const flag = checkIn.redFlags.find((f) => SYSTEMIC_FLAGS.has(f.kind))
  if (!flag) return undefined
  const what = flag.kind === 'chest-pain' ? 'chest pain' : 'feeling dizzy'
  return (
    `You mentioned ${what}, so I'm not going to suggest any exercise today. ` +
    `Please stop and get it checked by a doctor — if it's severe, sudden, or ` +
    `comes with breathlessness, call emergency services.`
  )
}

/** Areas with a red flag (today, or in a post-session check in the last 3 days). */
export function redFlagAreas(ctx: Context): BodyArea[] {
  const areas = new Set<BodyArea>()
  for (const f of ctx.checkIn.redFlags) if (f.area) areas.add(f.area)
  for (const day of recentDays(ctx, RULES.domsWindowDays)) {
    for (const s of day.sessions) {
      for (const f of s.post?.redFlags ?? []) if (f.area) areas.add(f.area)
    }
  }
  return [...areas]
}

// ── Readiness ───────────────────────────────────────────────────────────────

export function assessReadiness(ctx: Context): {
  level: Readiness
  reasons: string[]
} {
  const c = ctx.checkIn
  if (safetyStop(c)) return { level: 'stop', reasons: ['Safety first today.'] }

  const reasons: string[] = []
  const poorRecovery = reportedPoorRecovery(ctx)
  if (c.energy <= 2) reasons.push('your energy is low')
  if (c.pain >= 2) reasons.push('you have moderate or worse soreness')
  if (c.stiffness >= 3) reasons.push('you feel very stiff')
  if (poorRecovery) reasons.push('you felt worse after yesterday’s session')
  if (reasons.length) return { level: 'low', reasons }

  if (c.energy === 3) reasons.push('your energy is middling')
  if (c.pain === 1) reasons.push('you have some mild soreness')
  if (c.stiffness === 2) reasons.push('you’re fairly stiff')
  if (c.sleep !== undefined && c.sleep <= 2) reasons.push('you slept poorly')
  if (reasons.length) return { level: 'moderate', reasons }

  return { level: 'good', reasons: ['you’re feeling fresh'] }
}

/** Yesterday's post-session check said pain or stiffness got worse, or RPE was very hard. */
export function reportedPoorRecovery(ctx: Context): boolean {
  const y = dayBefore(ctx)
  return !!y?.sessions.some(
    (s) =>
      s.post &&
      (s.post.painChange === 'worse' ||
        s.post.stiffnessChange === 'worse' ||
        s.post.rpe >= 9),
  )
}

// ── Muscle-group recovery ──────────────────────────────────────────────────

/** Areas worked *hard* on a given day (moderate/high effort that was actually done). */
export function hardAreas(day: DayRecord | undefined): BodyArea[] {
  const areas = new Set<BodyArea>()
  for (const s of day?.sessions ?? []) {
    if (s.status === 'skipped') continue
    const rpe = s.post?.rpe ?? (s.kind === 'session' ? 7 : 4)
    for (const e of s.exercises) {
      if (e.status !== 'done') continue
      const hard =
        e.intensity === 'high' ||
        (e.intensity === 'moderate' && (rpe >= 6 || s.kind === 'session'))
      if (hard) e.primary.forEach((a) => areas.add(a))
    }
  }
  return [...areas]
}

/**
 * Areas that shouldn't be loaded today — only gentle, low-intensity movement.
 * Returns the reason for each so the coach can explain itself.
 */
export function areasToProtect(ctx: Context): Map<BodyArea, string> {
  const out = new Map<BodyArea, string>()
  const c = ctx.checkIn

  // Consecutive-day rule.
  for (const a of hardAreas(dayBefore(ctx))) out.set(a, 'worked hard yesterday')

  // DOMS: hard work two days ago + soreness today means it's likely peaking.
  if (c.pain >= 1) {
    const twoDaysAgo = ctx.history.find((d) => d.date === addDays(ctx.date, -2))
    for (const a of hardAreas(twoDaysAgo)) {
      if (!out.has(a)) out.set(a, 'likely still recovering (DOMS)')
    }
  }

  // Anywhere it hurts today.
  for (const a of c.painAreas) out.set(a, 'sore today')
  for (const a of ctx.adjustments.lessAreas) out.set(a, 'you asked for less')
  return out
}

/** Areas to leave out completely: red flags and settings exclusions. */
export function blockedAreas(ctx: Context): BodyArea[] {
  return [...new Set([...redFlagAreas(ctx), ...ctx.settings.excludedAreas])]
}

// ── High-intensity spacing ─────────────────────────────────────────────────

export function hiitDates(history: DayRecord[]): DateKey[] {
  return history
    .filter((d) =>
      d.sessions.some(
        (s) =>
          s.status !== 'skipped' &&
          s.category === 'cardio' &&
          s.kind === 'session' &&
          s.exercises.some(
            (e) => e.intensity === 'high' && e.status === 'done',
          ),
      ),
    )
    .map((d) => d.date)
}

export function hiitAllowed(
  ctx: Context,
  readiness: Readiness,
): { allowed: boolean; reason: string } {
  if (readiness !== 'good')
    return { allowed: false, reason: 'intervals need a fresh day' }
  if (ctx.checkIn.stiffness >= 2 || ctx.checkIn.pain >= 1)
    return {
      allowed: false,
      reason: 'intervals wait until soreness and stiffness settle',
    }
  const dates = hiitDates(ctx.history)
  const recent = dates.filter((d) => {
    const ago = daysBetween(d, ctx.date)
    return ago > 0 && ago < RULES.hiitMinDaysApart
  })
  if (recent.length)
    return {
      allowed: false,
      reason: 'you did intervals yesterday — we space hard cardio out',
    }
  const lastWeek = dates.filter((d) => {
    const ago = daysBetween(d, ctx.date)
    return ago > 0 && ago <= 7
  })
  if (lastWeek.length >= RULES.hiitMaxPerWeek)
    return {
      allowed: false,
      reason: `you've already had ${lastWeek.length} interval sessions this week`,
    }
  return { allowed: true, reason: 'you’re fresh and intervals are well spaced' }
}

// ── Long session decision ──────────────────────────────────────────────────

export type LongType = 'weights' | 'intervals'

export function longSessionDecision(
  ctx: Context,
  readiness: Readiness,
):
  | { offer: false; reason: string }
  | { offer: true; type: LongType; reason: string } {
  const { adjustments: adj, checkIn } = ctx
  if (readiness === 'stop')
    return { offer: false, reason: 'safety first today' }
  if (adj.noLongSession) return { offer: false, reason: 'you asked to skip it' }
  if (adj.maxMinutes !== undefined && adj.maxMinutes < 25)
    return { offer: false, reason: 'there isn’t time today' }
  if (checkIn.timeAvailable === 'little')
    return { offer: false, reason: 'you’re short on time' }
  if (readiness === 'low')
    return {
      offer: false,
      reason: 'recovery matters more today — an easy walk is a better choice',
    }
  if (reportedPoorRecovery(ctx))
    return { offer: false, reason: 'you didn’t recover well from yesterday' }

  const hiit = hiitAllowed(ctx, readiness)
  const yesterdayLong = dayBefore(ctx)?.sessions.find(
    (s) => s.kind === 'session' && s.status !== 'skipped',
  )
  if (
    hiit.allowed &&
    (yesterdayLong?.category !== 'cardio' || adj.moreIntensity)
  )
    return { offer: true, type: 'intervals', reason: hiit.reason }
  if (readiness === 'moderate' && yesterdayLong)
    return {
      offer: false,
      reason: 'two longer sessions in a row on a middling day is too much',
    }
  return {
    offer: true,
    type: 'weights',
    reason:
      readiness === 'moderate'
        ? 'a moderate strength session at a comfortable effort'
        : hiit.reason.startsWith('you did')
          ? 'strength today, since intervals were yesterday'
          : 'you’re fresh enough for some strength work',
  }
}

// ── How many snacks ────────────────────────────────────────────────────────

export function snackCount(ctx: Context, readiness: Readiness): number {
  if (readiness === 'stop') return 0
  let n = readiness === 'low' ? 4 : 5
  if (ctx.checkIn.timeAvailable === 'little') n = 4
  if (ctx.checkIn.timeAvailable === 'plenty' && readiness !== 'low') n = 6
  if (ctx.adjustments.maxMinutes !== undefined)
    n = Math.max(2, Math.min(n, Math.floor(ctx.adjustments.maxMinutes / 2)))
  return n
}

/** Rotate body regions through the day to counter long sitting. */
export const SITTING_ROTATION: { label: string; areas: BodyArea[] }[] = [
  { label: 'Hips & glutes', areas: ['hip-flexors', 'glutes'] },
  { label: 'Upper back & chest', areas: ['upper-back', 'chest'] },
  { label: 'Neck & shoulders', areas: ['neck', 'shoulders'] },
  { label: 'Calves & ankles', areas: ['calves', 'ankles'] },
  { label: 'Legs & lower back', areas: ['quads', 'hamstrings', 'lower-back'] },
  { label: 'Core & posture', areas: ['core', 'upper-back'] },
]

// ── Exercise eligibility ───────────────────────────────────────────────────

export function isEligible(
  ex: Exercise,
  ctx: Context,
  readiness: Readiness,
  protectedAreas: Map<BodyArea, string>,
  blocked: BodyArea[],
): boolean {
  const s = ctx.settings
  if (s.excludedExercises.includes(ex.id)) return false
  if (!ex.equipment.every((e) => s.equipment.includes(e))) return false
  if (ctx.adjustments.noJumping && ex.impact) return false
  // Red flags / exclusions: leave the area out entirely.
  if ([...ex.primary, ...ex.secondary].some((a) => blocked.includes(a)))
    return false
  // Low-readiness days: low intensity only.
  if (readiness === 'low' && ex.intensity !== 'low') return false
  // Protected areas may still get gentle mobility, never load.
  const loads = ex.category === 'strength' || ex.category === 'cardio'
  if (loads && ex.primary.some((a) => protectedAreas.has(a))) return false
  if (ex.intensity !== 'low' && ex.secondary.some((a) => protectedAreas.has(a)))
    return false
  return true
}

// ── Progression ────────────────────────────────────────────────────────────

/**
 * Multiplier for an exercise's dose based on the last time it was done.
 * Comfortable and complete → a small step up. Hard, partial or felt worse → back off.
 */
export function progressionFactor(
  exerciseId: string,
  ctx: Context,
): { factor: number; note?: string } {
  const days = [...ctx.history]
    .filter((d) => d.date < ctx.date && daysBetween(d.date, ctx.date) <= 14)
    .sort((a, b) => b.date.localeCompare(a.date))
  for (const day of days) {
    for (const s of [...day.sessions].reverse()) {
      const log = s.exercises.find((e) => e.exerciseId === exerciseId)
      if (!log || s.status === 'skipped') continue
      const post = s.post
      const worse =
        post?.painChange === 'worse' || post?.stiffnessChange === 'worse'
      if (
        worse ||
        (post && post.rpe >= RULES.hardRpe) ||
        log.status === 'skipped'
      )
        return { factor: 1 - RULES.backOffStep, note: 'backing off a little' }
      const target =
        log.target.kind === 'reps' ? log.target.reps : log.target.seconds
      const done =
        log.target.kind === 'reps'
          ? (log.repsDone ?? 0)
          : (log.secondsDone ?? 0)
      const complete = done >= target
      if (complete && post && post.rpe <= RULES.comfortableRpe)
        return { factor: 1 + RULES.progressionStep, note: 'a small step up' }
      return { factor: 1 }
    }
  }
  return { factor: 1 }
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function dayBefore(ctx: Context): DayRecord | undefined {
  const y = addDays(ctx.date, -1)
  return ctx.history.find((d) => d.date === y)
}

function recentDays(ctx: Context, n: number): DayRecord[] {
  return ctx.history.filter((d) => {
    const ago = daysBetween(d.date, ctx.date)
    return ago > 0 && ago <= n
  })
}
