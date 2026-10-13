import { Pencil } from 'lucide-react'
import { PlanItemRow } from '@/components/molecules/plan-item-row'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { DayRecord, PlannedItem } from '@/domain/types'
import { usePlanEditing } from '@/hooks/use-plan-editing'
import { useAppState } from '@/state/app-state'

/** The accepted plan for today: progress, the next snack, and the rest. */
export function DayDashboard({
  day,
  onStart,
}: {
  day: DayRecord
  onStart: (item: PlannedItem) => void
}) {
  const edit = usePlanEditing()
  const { savePlan } = useAppState()
  const plan = day.plan!
  const items = plan.items
  const done = items.filter(
    (i) => i.status === 'completed' || i.status === 'partial',
  ).length
  const minutes = Math.round(
    day.sessions.reduce((t, s) => t + s.durationSec, 0) / 60,
  )
  const next = items.find((i) => i.status === 'pending')

  if (plan.safetyStop)
    return (
      <Alert variant="destructive">
        <AlertTitle>Rest day, for safety</AlertTitle>
        <AlertDescription>{plan.safetyStop}</AlertDescription>
      </Alert>
    )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Today</CardTitle>
        <CardDescription>
          {done === 0
            ? 'Nothing done yet — the first snack is the easiest win.'
            : `${done} of ${items.length} done · ${minutes} minute${minutes === 1 ? '' : 's'} of movement`}
        </CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => savePlan({ ...plan, accepted: false })}
          >
            <Pencil /> Change plan
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress
          value={items.length ? (done / items.length) * 100 : 0}
          aria-label={`${done} of ${items.length} sessions done`}
        />
        {!next && (
          <p className="font-medium">
            All done for today. That’s a great day — rest up.
          </p>
        )}
        <ol className="space-y-2" aria-label="Today’s sessions">
          {items.map((item) => (
            <PlanItemRow
              key={item.id}
              item={item}
              highlight={item === next}
              onStart={() => onStart(item)}
              onShift={(m) => edit.shift(item, m)}
              onSwap={() => edit.swap(item)}
              onSkip={() => edit.skip(item)}
            />
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
