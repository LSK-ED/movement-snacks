import { findExercise, getExercise } from '@/data/exercises'
import type {
  CheckIn,
  DateKey,
  DayRecord,
  Dose,
  Exercise,
  Plan,
  PlanAdjustments,
  PlannedExercise,
  PlannedItem,
  PostCheck,
  Settings,
  Variation,
} from '@/domain/types'
import { addDays } from '@/lib/dates'
import {
  interpretUtterance,
  type Expect,
  type Interpretation,
} from './interpret'
import { buildPlan, list, swapItem } from './planner'
import { hardAreas, type Context } from './rules'

// The coach's public interface. The UI only talks to `Coach`, so a
// language-model-backed implementation can replace `rulesCoach` later.
//
// EXTENSION POINT — LLM coach:
//   Implement `Coach` in e.g. `llmCoach.ts`, calling a small local server
//   (never an API key in browser code). Keep `getPlan` delegating to the rules
//   planner for safety decisions and let the model only reword `reasoning`,
//   cues and replies. Swap it in `src/coach/index.ts`.

export interface PlanContext {
  date: DateKey
  checkIn: CheckIn
  history: DayRecord[]
  settings: Settings
  adjustments?: Partial<PlanAdjustments>
  nowMinutes?: number
}

export interface Coach {
  getPlan(ctx: PlanContext): Plan
  /** Re-plan from a spoken/typed request. Returns the new plan and a reply. */
  replan(
    ctx: PlanContext,
    current: Plan,
    request: string,
  ): { plan: Plan; reply: string }
  /** Offer different exercises for the same slot. */
  swapItem(ctx: PlanContext, item: PlannedItem): PlannedItem
  getCue(exerciseId: string, variation?: Variation): string
  interpretUtterance(text: string, expect?: Expect): Interpretation
  greeting(recap?: string): string
  yesterdayRecap(date: DateKey, history: DayRecord[]): string
  planSummary(plan: Plan): string
  afterSession(post: PostCheck): string
}

export const EMPTY_ADJUSTMENTS: PlanAdjustments = {
  lessAreas: [],
  noJumping: false,
  noLongSession: false,
}

export const rulesCoach: Coach = {
  getPlan(ctx) {
    return buildPlan(rulesContext(ctx), { nowMinutes: ctx.nowMinutes })
  },

  swapItem(ctx, item) {
    return swapItem(rulesContext(ctx), item)
  },

  replan(ctx, current, request) {
    const meaning = interpretUtterance(request)
    const a = meaning.adjustments
    const prev = current.adjustments
    const next: PlanAdjustments = {
      lessAreas: [...new Set([...prev.lessAreas, ...(a.lessAreas ?? [])])],
      noJumping: prev.noJumping || !!a.noJumping,
      maxMinutes: a.maxMinutes ?? prev.maxMinutes,
      noLongSession: prev.noLongSession || !!a.noLongSession,
      moreIntensity: prev.moreIntensity || a.moreIntensity,
    }
    const changed = JSON.stringify(next) !== JSON.stringify(prev)
    if (!changed) {
      return {
        plan: current,
        reply:
          'I didn’t catch a change there. Try “less lower body”, “no jumping”, “I only have ten minutes” or “skip the long session”.',
      }
    }
    const plan = rulesCoach.getPlan({ ...ctx, adjustments: next })
    const bits: string[] = []
    if (a.lessAreas?.length) bits.push(`less ${list(a.lessAreas)}`)
    if (a.noJumping) bits.push('no jumping')
    if (a.maxMinutes) bits.push(`about ${a.maxMinutes} minutes in total`)
    if (a.noLongSession) bits.push('no longer session')
    if (a.moreIntensity) bits.push('a bit more intensity where it’s safe')
    return { plan, reply: `Done — ${bits.join(', ')}. Here’s the new plan.` }
  },

  getCue(exerciseId, variation = 'standard') {
    const ex = getExercise(exerciseId)
    if (variation === 'easier') return `Easier version: ${ex.easier}`
    if (variation === 'harder') return `Harder version: ${ex.harder}`
    return ex.cue
  },

  interpretUtterance,

  greeting(recap) {
    return `${timeGreeting()}. ${recap ? `${recap} ` : ''}Quick check-in: any soreness or stiffness, and where? And your energy, one to five?`
  },

  yesterdayRecap(date, history) {
    const y = history.find((d) => d.date === addDays(date, -1))
    if (!y || (!y.plan && !y.sessions.length))
      return 'Nothing logged yesterday — no problem. Today is a fresh start.'
    const planned = y.plan?.items.length ?? 0
    const done = y.sessions.filter((s) => s.status !== 'skipped')
    const minutes = Math.round(done.reduce((t, s) => t + s.durationSec, 0) / 60)
    const areas = hardAreas(y)
    const long = done.find((s) => s.kind === 'session')
    const parts: string[] = []
    parts.push(
      planned
        ? `Yesterday you did ${done.length} of ${planned} planned sessions — about ${minutes} minute${minutes === 1 ? '' : 's'} of movement.`
        : `Yesterday you logged ${done.length} session${done.length === 1 ? '' : 's'}, about ${minutes} minutes.`,
    )
    if (long?.post)
      parts.push(
        `The longer session felt like an RPE ${long.post.rpe}, and you felt ${long.post.painChange === 'worse' ? 'a bit worse' : long.post.painChange === 'better' ? 'better' : 'about the same'} afterwards.`,
      )
    if (areas.length)
      parts.push(
        `You worked ${list(areas.slice(0, 4))} harder, so they get a lighter day.`,
      )
    else if (done.length)
      parts.push('Nothing too strenuous, so everything is fair game today.')
    if (!done.length)
      parts.push('A quieter day is fine — consistency over perfection.')
    return parts.join(' ')
  },

  planSummary(plan) {
    if (plan.safetyStop) return plan.safetyStop
    const snacks = plan.items.filter((i) => i.kind === 'snack').length
    const long = plan.items.find((i) => i.id === 'long')
    return (
      `${plan.reasoning[0]} I’ve planned ${snacks} movement snacks` +
      (long
        ? ` and a ${long.minutes}-minute ${long.title.toLowerCase()}.`
        : '.') +
      ' Accept it, or tell me what to change.'
    )
  },

  afterSession(post) {
    if (post.redFlags.length)
      return 'Thanks for telling me. Stop for now and don’t push through that. If it doesn’t settle, or it’s sharp or worsening, get it checked by a GP or physio. I’ll leave that area out of future plans.'
    if (post.painChange === 'worse' || post.stiffnessChange === 'worse')
      return 'Noted — I’ll go easier on that next time. Mild soreness is normal, but tell me if it gets sharp or keeps getting worse.'
    if (post.rpe >= 8)
      return 'That was hard work — nice. I’ll keep the next one lighter.'
    if (post.rpe <= 4)
      return 'Nice and easy. That’s a win — every bit of movement counts.'
    return 'Good work. That’s logged.'
  },
}

export function describeDose(dose: Dose, rounds?: number): string {
  const base =
    dose.kind === 'reps' ? `${dose.reps} reps` : formatSeconds(dose.seconds)
  const side = dose.perSide ? ' each side' : ''
  return `${rounds && rounds > 1 ? `${rounds} × ` : ''}${base}${side}`
}

export function formatSeconds(s: number): string {
  if (s < 60) return `${s} seconds`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m} min ${r} s` : `${m} minute${m === 1 ? '' : 's'}`
}

/** Speakable intro for one exercise. */
export function introLine(p: PlannedExercise, variation: Variation): string {
  const ex: Exercise | undefined = findExercise(p.exerciseId)
  if (!ex) return ''
  const cue = rulesCoach.getCue(ex.id, variation)
  return `${ex.name}. ${describeDose(p.dose, p.rounds)}. ${cue}`
}

function rulesContext(ctx: PlanContext): Context {
  return {
    date: ctx.date,
    checkIn: ctx.checkIn,
    history: ctx.history.filter((d) => d.date < ctx.date),
    settings: ctx.settings,
    adjustments: { ...EMPTY_ADJUSTMENTS, ...ctx.adjustments },
  }
}

function timeGreeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}
