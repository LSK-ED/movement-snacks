import { useRef } from 'react'
import {
  Check,
  ChevronsDown,
  ChevronsUp,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Square,
} from 'lucide-react'
import { coach, describeDose } from '@/coach'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import type { PlannedItem, PostCheck, SessionLog } from '@/domain/types'
import { useSessionRunner } from '@/hooks/use-session-runner'
import { useVoice, useVoiceHandler } from '@/voice/voice-provider'
import { PostSessionCheck } from './post-session-check'

export function SessionRunner({
  item,
  onFinish,
  onCancel,
}: {
  item: PlannedItem
  onFinish: (log: Omit<SessionLog, 'date'>) => void
  onCancel: () => void
}) {
  const voice = useVoice()
  const run = useSessionRunner(item, voice.say)
  // Built once, when the session finishes.
  const log = useRef<Omit<SessionLog, 'post' | 'date'>>(undefined)

  useVoiceHandler(
    (text) => {
      const m = coach.interpretUtterance(
        text,
        run.step.kind === 'reps' ? 'reps' : undefined,
      )
      if (
        run.phase !== 'rest' &&
        run.step.kind === 'reps' &&
        m.number !== undefined &&
        m.number <= 200
      ) {
        run.setCount(m.number)
      }
      const cmd = m.commands[0]
      if (cmd) run.command(cmd, run.step.kind === 'reps' ? m.number : undefined)
      else if (m.number === undefined)
        void voice.say(
          'Say done, skip, repeat, easier, harder, pause, stop or how many left.',
        )
    },
    { continuous: true },
  )

  if (run.phase === 'finished') {
    log.current ??= run.buildLog()
    const finished = log.current
    if (finished.status === 'skipped')
      return (
        <Card>
          <CardHeader>
            <CardTitle>Stopped before starting</CardTitle>
            <CardDescription>
              No problem — nothing logged as done.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={() => onFinish(finished)}>Mark as skipped</Button>
            <Button variant="outline" onClick={onCancel}>
              Back without logging
            </Button>
          </CardContent>
        </Card>
      )
    return (
      <PostSessionCheck
        log={finished}
        onSave={(post: PostCheck) => onFinish({ ...finished, post })}
      />
    )
  }

  const { step, exercise, planned, phase } = run
  const progress = Math.round((run.index / run.steps.length) * 100)
  const timeLeft =
    phase === 'rest'
      ? run.restLeft
      : step.kind === 'time'
        ? Math.max(0, step.target - run.count)
        : undefined

  return (
    <Card aria-labelledby="runner-title">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardDescription>
            {item.title} · exercise {step.ex + 1} of {item.exercises.length}
            {step.rounds > 1 && ` · round ${step.round} of ${step.rounds}`}
          </CardDescription>
          <Button variant="ghost" size="sm" onClick={() => run.command('stop')}>
            <Square /> End session
          </Button>
        </div>
        <Progress value={progress} aria-label="Session progress" />
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-2 text-center">
          {phase === 'rest' ? (
            <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
              Rest
            </p>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              {planned.role !== 'main' && (
                <Badge variant="secondary">
                  {planned.role === 'warmup' ? 'Warm-up' : 'Cool-down'}
                </Badge>
              )}
              {step.side && (
                <Badge variant="outline">
                  {step.side === 'left' ? 'Left side' : 'Right side'}
                </Badge>
              )}
              {run.variation !== 'standard' && (
                <Badge>
                  {run.variation === 'easier'
                    ? 'Easier version'
                    : 'Harder version'}
                </Badge>
              )}
              <Badge variant="outline">Target RPE {planned.rpe}</Badge>
            </div>
          )}
          <h2
            id="runner-title"
            className="text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            {exercise.name}
          </h2>
          <p className="mx-auto max-w-prose text-muted-foreground">
            {coach.getCue(exercise.id, run.variation)}
          </p>
          <p className="text-sm">
            Target: {describeDose(planned.dose)}
            {phase === 'intro' && (
              <span className="text-muted-foreground"> · getting ready…</span>
            )}
          </p>
        </div>

        <div className="flex flex-col items-center gap-3" aria-live="off">
          {timeLeft !== undefined ? (
            <p
              className="text-6xl font-semibold tabular-nums sm:text-7xl"
              role="timer"
              aria-label={`${timeLeft} seconds ${phase === 'rest' ? 'of rest' : ''} left`}
            >
              {formatClock(timeLeft)}
            </p>
          ) : (
            <>
              <p
                className="text-6xl font-semibold tabular-nums sm:text-7xl"
                aria-label={`${run.count} of ${step.target} reps`}
              >
                {run.count}
                <span className="text-2xl text-muted-foreground">
                  {' '}
                  / {step.target}
                </span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="One rep fewer"
                  onClick={() => run.setCount(Math.max(0, run.count - 1))}
                >
                  <Minus />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="One more rep"
                  onClick={() => run.setCount(run.count + 1)}
                >
                  <Plus />
                </Button>
                <div className="ml-2 flex items-center gap-2">
                  <Switch
                    id="auto-count"
                    checked={run.autoCount}
                    onCheckedChange={run.setAutoCount}
                  />
                  <Label htmlFor="auto-count" className="text-sm font-normal">
                    Count aloud
                  </Label>
                </div>
              </div>
            </>
          )}
          {run.paused && <Badge variant="secondary">Paused</Badge>}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button
            size="lg"
            className="col-span-2 bg-highlight text-highlight-foreground hover:bg-highlight/90"
            onClick={() => run.command('done')}
          >
            <Check /> {phase === 'rest' ? 'Skip rest' : 'Done'}
          </Button>
          {run.paused ? (
            <Button
              size="lg"
              variant="secondary"
              onClick={() => run.command('resume')}
            >
              <Play /> Resume
            </Button>
          ) : (
            <Button
              size="lg"
              variant="secondary"
              onClick={() => run.command('pause')}
            >
              <Pause /> Pause
            </Button>
          )}
          <Button
            size="lg"
            variant="outline"
            onClick={() => run.command('skip')}
          >
            <SkipForward /> Skip
          </Button>
          <Button variant="outline" onClick={() => run.command('easier')}>
            <ChevronsDown /> Easier
          </Button>
          <Button variant="outline" onClick={() => run.command('harder')}>
            <ChevronsUp /> Harder
          </Button>
          <Button variant="outline" onClick={() => run.command('repeat')}>
            <RotateCcw /> Repeat cue
          </Button>
          <Button
            variant="outline"
            onClick={() => run.command('how-many-left')}
          >
            How many left?
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Say: done · skip · repeat · easier · harder · pause · resume · stop ·
          how many left
          {exercise.cautions && (
            <>
              <br />
              <span>Caution: {exercise.cautions}</span>
            </>
          )}
        </p>
      </CardContent>
    </Card>
  )
}

function formatClock(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}
