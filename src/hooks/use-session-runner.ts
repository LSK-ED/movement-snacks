import { useEffect, useMemo, useRef, useState } from 'react'
import { coach, introLine, type SessionCommand } from '@/coach'
import { getExercise } from '@/data/exercises'
import type {
  ExerciseLog,
  PlannedItem,
  SessionLog,
  Variation,
} from '@/domain/types'

// Drives one snack or session: steps through exercises, rounds and sides,
// runs the timer and rep count, speaks cues, and builds the log.

export interface Step {
  ex: number
  round: number
  rounds: number
  side?: 'left' | 'right'
  kind: 'reps' | 'time'
  target: number
  restAfter: number
}

export type Phase = 'intro' | 'work' | 'rest' | 'finished'

/** Seconds per rep when the coach counts aloud. */
const TEMPO = 3

export function buildSteps(item: PlannedItem): Step[] {
  const steps: Step[] = []
  item.exercises.forEach((p, ex) => {
    const rounds = p.rounds ?? 1
    const sides = p.dose.perSide ? (['left', 'right'] as const) : [undefined]
    const target = p.dose.kind === 'reps' ? p.dose.reps : p.dose.seconds
    for (let round = 1; round <= rounds; round++) {
      sides.forEach((side, s) => {
        const lastOfExercise = round === rounds && s === sides.length - 1
        steps.push({
          ex,
          round,
          rounds,
          side,
          kind: p.dose.kind,
          target,
          restAfter:
            side === 'left' ? 3 : lastOfExercise ? 6 : (p.restSeconds ?? 10),
        })
      })
    }
  })
  return steps
}

interface Totals {
  reps: number
  secs: number
  done: boolean
}

export function useSessionRunner(
  item: PlannedItem,
  say: (text: string, opts?: { quiet?: boolean }) => Promise<void>,
  /** Called with the log so far after every completed step, so leaving mid-session loses nothing. */
  onProgress?: (log: Omit<SessionLog, 'post'>) => void,
) {
  const steps = useMemo(() => buildSteps(item), [item])
  const [i, setI] = useState(0)
  const [phase, setPhase] = useState<Phase>('intro')
  const [paused, setPaused] = useState(false)
  const [count, setCount] = useState(0)
  const [restLeft, setRestLeft] = useState(0)
  const [autoCount, setAutoCount] = useState(true)
  const [variations, setVariations] = useState<Variation[]>(() =>
    item.exercises.map(() => 'standard'),
  )
  const [tick, setTick] = useState(0)
  const totals = useRef<Totals[]>(
    item.exercises.map(() => ({ reps: 0, secs: 0, done: false })),
  )
  const activeSeconds = useRef(0)
  const stoppedEarly = useRef(false)
  const startedAt = useRef(new Date().toISOString())

  const step = steps[Math.min(i, steps.length - 1)]
  const planned = item.exercises[step.ex]
  const exercise = getExercise(planned.exerciseId)
  const variation = variations[step.ex]

  const introFor = (s: Step, v: Variation) => {
    const p = item.exercises[s.ex]
    if (s.side === 'right') return 'Other side. Go.'
    if (s.round > 1) return `Round ${s.round} of ${s.rounds}. Go.`
    const sideNote = s.side === 'left' ? ' Left side first.' : ''
    return `${introLine(p, v)}${sideNote} Go.`
  }

  // Announce each step, then start work once the coach has finished speaking.
  useEffect(() => {
    if (phase !== 'intro') return
    let cancelled = false
    void say(introFor(step, variation)).then(() => {
      if (!cancelled) setPhase('work')
    })
    return () => {
      cancelled = true
    }
  }, [i, phase])

  // One-second heartbeat while working or resting.
  useEffect(() => {
    if (paused || (phase !== 'work' && phase !== 'rest')) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [phase, paused])

  useEffect(() => {
    if (!tick) return
    activeSeconds.current++
    if (phase === 'rest') {
      const left = restLeft - 1
      setRestLeft(left)
      if (left > 0 && left <= 3) void say(String(left), { quiet: true })
      if (left <= 0) advance()
      return
    }
    if (phase !== 'work') return
    if (step.kind === 'time') {
      const elapsed = count + 1
      setCount(elapsed)
      const left = step.target - elapsed
      if (left <= 0) return completeStep('timer', elapsed)
      if (step.target >= 30 && elapsed === Math.floor(step.target / 2))
        void say('Halfway.', { quiet: true })
      else if (left === 10 && step.target >= 25)
        void say('Ten seconds.', { quiet: true })
      else if (left <= 3) void say(String(left), { quiet: true })
    } else if (autoCount && activeSeconds.current % TEMPO === 0) {
      const reps = count + 1
      setCount(reps)
      void say(String(reps), { quiet: true })
      if (reps >= step.target) completeStep('done', reps)
    }
  }, [tick])

  function record(how: 'done' | 'timer', value: number) {
    const t = totals.current[step.ex]
    if (step.kind === 'reps')
      t.reps += how === 'done' && value === 0 ? step.target : value
    else t.secs += how === 'timer' || value === 0 ? step.target : value
    t.done = true
  }

  function completeStep(how: 'done' | 'timer', value = count) {
    record(how, value)
    onProgress?.(buildLog())
    if (i >= steps.length - 1) return finish()
    const next = steps[i + 1]
    setPhase('rest')
    setRestLeft(step.restAfter)
    if (next.ex !== step.ex) {
      void say(
        `Nice. Next: ${getExercise(item.exercises[next.ex].exerciseId).name}.`,
      )
    } else if (next.side === 'right') {
      void say('Switch sides.', { quiet: false })
    } else {
      void say(`Good. Rest ${step.restAfter} seconds.`)
    }
  }

  function advance() {
    setI((x) => x + 1)
    setCount(0)
    setPhase('intro')
  }

  function goToExercise(ex: number) {
    const idx = steps.findIndex((s) => s.ex === ex)
    if (idx < 0) return finish()
    setI(idx)
    setCount(0)
    setPhase('intro')
  }

  function finish(early = false) {
    stoppedEarly.current = early
    setPhase('finished')
  }

  /** `value` is a spoken rep count ("I did twelve, done"). */
  function command(cmd: SessionCommand, value?: number) {
    switch (cmd) {
      case 'done':
        if (phase === 'rest') return advance()
        // From the intro too: they may have done it while the coach was talking.
        return completeStep('done', value ?? count)
      case 'skip':
        if (step.ex + 1 >= item.exercises.length) return finish(true)
        void say('Skipping that one.')
        return goToExercise(step.ex + 1)
      case 'repeat':
        return void say(
          introFor(
            {
              ...step,
              round: 1,
              side: step.side === 'right' ? 'left' : step.side,
            },
            variation,
          ).replace(/ Go\.$/, ''),
        )
      case 'easier':
      case 'harder': {
        const v: Variation = cmd
        setVariations((vs) => vs.map((x, k) => (k === step.ex ? v : x)))
        return void say(coach.getCue(exercise.id, v))
      }
      case 'pause':
        setPaused(true)
        return void say('Paused. Say resume when you’re ready.')
      case 'resume':
        setPaused(false)
        return void say('Back to it.')
      case 'stop':
        return finish(true)
      case 'how-many-left': {
        const exLeft = item.exercises.length - step.ex - 1
        const now =
          phase === 'rest'
            ? `${restLeft} seconds of rest`
            : step.kind === 'reps'
              ? `${Math.max(0, step.target - count)} reps`
              : `${Math.max(0, step.target - count)} seconds`
        const after = exLeft
          ? `, then ${exLeft} more exercise${exLeft === 1 ? '' : 's'}`
          : ', and that’s the last one'
        return void say(`${now} to go${after}.`)
      }
    }
  }

  function buildLog(): Omit<SessionLog, 'post'> {
    const exercises: ExerciseLog[] = item.exercises.map((p, k) => {
      const ex = getExercise(p.exerciseId)
      const t = totals.current[k]
      return {
        exerciseId: p.exerciseId,
        primary: ex.primary,
        intensity: ex.intensity,
        variation: variations[k],
        target: p.dose,
        repsDone: p.dose.kind === 'reps' && t.done ? t.reps : undefined,
        secondsDone: p.dose.kind === 'time' && t.done ? t.secs : undefined,
        status: t.done ? 'done' : 'skipped',
      }
    })
    const doneCount = exercises.filter((e) => e.status === 'done').length
    const status =
      doneCount === 0
        ? 'skipped'
        : doneCount === exercises.length && !stoppedEarly.current
          ? 'completed'
          : 'partial'
    return {
      id: `${item.id}-${startedAt.current}`,
      date: '',
      itemId: item.id,
      kind: item.kind,
      category: item.category,
      startedAt: startedAt.current,
      endedAt: new Date().toISOString(),
      // Reps logged by voice or tap may never have run the clock, so credit
      // the logged work (about 3 s a rep) when it's more than the clock shows.
      durationSec: Math.max(
        activeSeconds.current,
        exercises.reduce(
          (t, e) => t + (e.repsDone ?? 0) * 3 + (e.secondsDone ?? 0),
          0,
        ),
      ),
      status,
      exercises,
    }
  }

  return {
    steps,
    index: i,
    step,
    phase,
    paused,
    count,
    setCount,
    restLeft,
    autoCount,
    setAutoCount,
    exercise,
    planned,
    variation,
    command,
    buildLog,
  }
}
