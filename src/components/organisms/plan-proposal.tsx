import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { coach } from '@/coach'
import { PlanItemRow } from '@/components/molecules/plan-item-row'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Plan } from '@/domain/types'
import { usePlanEditing } from '@/hooks/use-plan-editing'
import { useVoice, useVoiceHandler } from '@/voice/voice-provider'

const SUGGESTIONS = [
  'Less lower body',
  'No jumping',
  'I only have ten minutes',
  'Skip the long session',
]

/** The coach's proposed plan: reasoning, items, change requests, accept. */
export function PlanProposal({ plan }: { plan: Plan }) {
  const voice = useVoice()
  const edit = usePlanEditing()
  const [request, setRequest] = useState('')
  const announced = useRef<string>('')

  useEffect(() => {
    if (announced.current === plan.createdAt) return
    announced.current = plan.createdAt
    void voice.say(coach.planSummary(plan))
  }, [plan, voice])

  const ask = (text: string) => {
    const m = coach.interpretUtterance(text)
    if (m.yes === true && !m.summary.some((s) => !s.startsWith('“')))
      return edit.accept()
    const { reply } = edit.replan(text)
    void voice.say(reply)
  }
  useVoiceHandler(ask)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Today’s plan</CardTitle>
        <CardDescription>
          Here’s my reasoning — accept it, or ask for changes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {plan.safetyStop ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>No exercise today</AlertTitle>
            <AlertDescription>{plan.safetyStop}</AlertDescription>
          </Alert>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {plan.reasoning.map((r, i) => (
              <li
                key={i}
                className={
                  i === 0 ? 'text-base font-medium' : 'text-muted-foreground'
                }
              >
                {r}
              </li>
            ))}
          </ul>
        )}

        {plan.items.length > 0 && (
          <ol className="space-y-2" aria-label="Planned sessions">
            {plan.items.map((item) => (
              <PlanItemRow
                key={item.id}
                item={item}
                showWhy
                onShift={(m) => edit.shift(item, m)}
                onSwap={() => edit.swap(item)}
                onSkip={() => edit.skip(item)}
              />
            ))}
          </ol>
        )}

        {!plan.safetyStop && (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (request.trim()) ask(request)
              setRequest('')
            }}
          >
            <Label htmlFor="plan-change">Ask for a change</Label>
            <div className="flex gap-2">
              <Input
                id="plan-change"
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                placeholder="e.g. less lower body, no jumping"
              />
              <Button type="submit" variant="secondary">
                Re-plan
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => ask(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          </form>
        )}
      </CardContent>
      <CardFooter>
        <Button size="lg" onClick={edit.accept}>
          <Check /> {plan.safetyStop ? 'Understood' : 'Accept plan'}
        </Button>
      </CardFooter>
    </Card>
  )
}
