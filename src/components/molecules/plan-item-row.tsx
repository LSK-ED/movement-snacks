import {
  Check,
  ChevronLeft,
  ChevronRight,
  Play,
  Shuffle,
  SkipForward,
} from 'lucide-react'
import { describeDose } from '@/coach'
import { getExercise } from '@/data/exercises'
import type { PlannedItem } from '@/domain/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatTime } from '@/lib/dates'
import { STATUS_LABELS } from '@/lib/labels'
import { cn } from '@/lib/utils'

export interface ItemActions {
  onShift?: (minutes: number) => void
  onSwap?: () => void
  onSkip?: () => void
  onStart?: () => void
}

export function PlanItemRow({
  item,
  highlight,
  showWhy,
  ...actions
}: {
  item: PlannedItem
  highlight?: boolean
  showWhy?: boolean
} & ItemActions) {
  const pending = item.status === 'pending'
  return (
    <li
      className={cn(
        'rounded-lg border p-3 sm:p-4',
        highlight && 'border-highlight bg-highlight-subtle',
        !pending && 'opacity-80',
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex items-baseline gap-3">
          <time className="w-16 shrink-0 text-sm tabular-nums text-muted-foreground">
            {formatTime(item.time)}
          </time>
          <h3 className="font-medium">
            {item.title}
            <span className="sr-only">
              , {item.minutes} minute{item.minutes === 1 ? '' : 's'},{' '}
              {STATUS_LABELS[item.status]}
            </span>
          </h3>
        </div>
        <div className="flex items-center gap-2" aria-hidden>
          <span className="text-sm text-muted-foreground">
            ~{item.minutes} min
          </span>
          {item.kind === 'session' && <Badge variant="secondary">Longer</Badge>}
          {!pending && (
            <Badge variant={item.status === 'skipped' ? 'outline' : 'default'}>
              {item.status !== 'skipped' && <Check />}
              {STATUS_LABELS[item.status]}
            </Badge>
          )}
        </div>
      </div>

      <ul className="mt-2 space-y-0.5 pl-0 text-sm sm:pl-19">
        {item.exercises.map((e, i) => {
          const ex = getExercise(e.exerciseId)
          return (
            <li key={i} className="flex flex-wrap gap-x-2">
              <span>{ex.name}</span>
              <span className="text-muted-foreground">
                {describeDose(e.dose, e.rounds)}
                {e.role === 'warmup'
                  ? ' · warm-up'
                  : e.role === 'cooldown'
                    ? ' · cool-down'
                    : ''}
              </span>
            </li>
          )
        })}
      </ul>
      {showWhy && (
        <p className="mt-2 text-sm text-muted-foreground sm:pl-19">
          {item.why}
        </p>
      )}

      {pending &&
        (actions.onStart ||
          actions.onShift ||
          actions.onSwap ||
          actions.onSkip) && (
          <div className="mt-3 flex flex-wrap gap-2 sm:pl-19">
            {actions.onStart && (
              <Button
                size="sm"
                onClick={actions.onStart}
                className={cn(
                  highlight &&
                    'bg-highlight text-highlight-foreground hover:bg-highlight/90',
                )}
              >
                <Play /> Start
              </Button>
            )}
            {actions.onShift && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => actions.onShift!(-30)}
                  aria-label={`Move ${item.title} 30 minutes earlier`}
                >
                  <ChevronLeft /> 30 min
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => actions.onShift!(30)}
                  aria-label={`Move ${item.title} 30 minutes later`}
                >
                  30 min <ChevronRight />
                </Button>
              </>
            )}
            {actions.onSwap && (
              <Button
                variant="outline"
                size="sm"
                onClick={actions.onSwap}
                aria-label={`Swap exercises in ${item.title}`}
              >
                <Shuffle /> Swap
              </Button>
            )}
            {actions.onSkip && (
              <Button
                variant="ghost"
                size="sm"
                onClick={actions.onSkip}
                aria-label={`Skip ${item.title}`}
              >
                <SkipForward /> Skip
              </Button>
            )}
          </div>
        )}
    </li>
  )
}
