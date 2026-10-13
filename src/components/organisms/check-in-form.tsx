import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ChevronDown, X } from 'lucide-react'
import { coach, type Expect, type Interpretation } from '@/coach'
import { AreaChips } from '@/components/atoms/area-chips'
import { ChoiceGroup } from '@/components/atoms/choice-group'
import { HeardChip } from '@/components/molecules/heard-chip'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type {
  CheckIn,
  Level,
  RedFlag,
  RedFlagKind,
  Severity,
  TimeAvailable,
} from '@/domain/types'
import { SEVERITY_LABELS, areaLabel } from '@/lib/labels'
import { useVoice, useVoiceHandler } from '@/voice/voice-provider'

type Draft = Omit<CheckIn, 'date' | 'at' | 'energy'> & { energy?: Level }

const EMPTY: Draft = {
  pain: 0,
  painAreas: [],
  stiffness: 0,
  stiffAreas: [],
  redFlags: [],
}

const SEVERITIES = ([0, 1, 2, 3] as Severity[]).map((v) => ({
  value: v,
  label: SEVERITY_LABELS[v],
}))
const LEVELS = ([1, 2, 3, 4, 5] as Level[]).map((v) => ({
  value: v,
  label: String(v),
}))

const FLAG_OPTIONS: { kind: RedFlagKind; label: string }[] = [
  { kind: 'sharp-pain', label: 'Sharp, shooting or stabbing pain' },
  { kind: 'worsening-pain', label: 'Pain that keeps getting worse' },
  { kind: 'numbness', label: 'Numbness or tingling' },
  { kind: 'swelling', label: 'New swelling' },
  { kind: 'dizziness', label: 'Dizziness or feeling faint' },
  { kind: 'chest-pain', label: 'Chest pain, pressure or tightness' },
]

export function CheckInForm({
  date,
  intro,
  onSave,
}: {
  date: string
  intro?: string
  onSave: (c: CheckIn) => void
}) {
  const voice = useVoice()
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [heard, setHeard] = useState<{
    meaning: Interpretation
    before: Draft
  }>()
  const [expect, setExpect] = useState<Expect>()
  const [showMore, setShowMore] = useState(false)
  const greeted = useRef(false)

  useEffect(() => {
    if (greeted.current) return
    greeted.current = true
    void voice.say(coach.greeting(intro))
  }, [voice])

  const save = (d: Draft = draft) => {
    if (!d.energy) return
    onSave({ ...d, energy: d.energy, date, at: new Date().toISOString() })
  }

  useVoiceHandler((text) => {
    const m = coach.interpretUtterance(text, expect)
    if (m.yes === true && draft.energy && !m.summary.length) return save()
    const before = draft
    const next = merge(draft, m)
    setDraft(next)
    setHeard({ meaning: m, before })
    if (m.redFlags.length) {
      return voice.say(
        'That sounds like more than normal soreness, so I’ve noted it and I won’t load that area. Please don’t push through it. Anything else?',
      )
    }
    if (!next.energy) {
      setExpect('energy')
      return voice.say(
        m.summary.length
          ? 'Got it. And your energy, one to five?'
          : 'Sorry, I missed that. How’s your energy, one to five?',
      )
    }
    setExpect(undefined)
    void voice.say(
      `Got it: ${m.summary.join(', ') || 'no changes'}. Say yes to save, or correct me.`,
    )
  })

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const toggleFlag = (kind: RedFlagKind, on: boolean) =>
    set({
      redFlags: on
        ? [...draft.redFlags, { kind, text: 'Selected in check-in' }]
        : draft.redFlags.filter((f) => f.kind !== kind),
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Morning check-in</CardTitle>
        <CardDescription>
          Say it in one go — “tight lower back, knees a bit sore, energy about a
          three” — or use the buttons.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {heard && (
          <HeardChip
            text={heard.meaning.text}
            summary={heard.meaning.summary}
            onUndo={() => {
              setDraft(heard.before)
              setHeard(undefined)
            }}
          />
        )}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Muscle soreness</legend>
          <ChoiceGroup
            label="Muscle soreness"
            value={draft.pain}
            options={SEVERITIES}
            onChange={(pain) =>
              set({ pain, painAreas: pain ? draft.painAreas : [] })
            }
          />
          {draft.pain > 0 && (
            <AreaChips
              label="Where is it sore?"
              value={draft.painAreas}
              onChange={(painAreas) => set({ painAreas })}
            />
          )}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Stiffness</legend>
          <ChoiceGroup
            label="Stiffness"
            value={draft.stiffness}
            options={SEVERITIES}
            onChange={(stiffness) =>
              set({ stiffness, stiffAreas: stiffness ? draft.stiffAreas : [] })
            }
          />
          {draft.stiffness > 0 && (
            <AreaChips
              label="Where is it stiff?"
              value={draft.stiffAreas}
              onChange={(stiffAreas) => set({ stiffAreas })}
            />
          )}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">
            Energy{' '}
            <span className="font-normal text-muted-foreground">
              (1 low – 5 high)
            </span>
          </legend>
          <ChoiceGroup
            label="Energy, 1 low to 5 high"
            value={draft.energy}
            options={LEVELS}
            onChange={(energy) => set({ energy })}
          />
        </fieldset>

        <div>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={showMore}
            onClick={() => setShowMore((s) => !s)}
            className="-ml-2"
          >
            <ChevronDown className={showMore ? 'rotate-180' : ''} /> Sleep, time
            and warning signs (optional)
          </Button>
          {showMore && (
            <div className="mt-3 space-y-6">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  Sleep quality (1 poor – 5 great)
                </legend>
                <ChoiceGroup
                  label="Sleep quality"
                  value={draft.sleep}
                  options={LEVELS}
                  onChange={(sleep) => set({ sleep })}
                />
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Time today</legend>
                <ChoiceGroup<TimeAvailable>
                  label="Time available today"
                  value={draft.timeAvailable}
                  options={[
                    { value: 'little', label: 'Very busy' },
                    { value: 'some', label: 'Normal' },
                    { value: 'plenty', label: 'Plenty' },
                  ]}
                  onChange={(timeAvailable) => set({ timeAvailable })}
                />
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  Anything beyond normal soreness?
                </legend>
                {FLAG_OPTIONS.map((o) => (
                  <div key={o.kind} className="flex items-center gap-2">
                    <Checkbox
                      id={`flag-${o.kind}`}
                      checked={draft.redFlags.some((f) => f.kind === o.kind)}
                      onCheckedChange={(c) => toggleFlag(o.kind, c === true)}
                    />
                    <Label htmlFor={`flag-${o.kind}`} className="font-normal">
                      {o.label}
                    </Label>
                  </div>
                ))}
              </fieldset>
            </div>
          )}
        </div>

        {draft.redFlags.length > 0 && (
          <RedFlagAlert
            flags={draft.redFlags}
            onRemove={(i) =>
              set({ redFlags: draft.redFlags.filter((_, j) => j !== i) })
            }
          />
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-3">
        <Button size="lg" disabled={!draft.energy} onClick={() => save()}>
          Save and plan my day
        </Button>
        {!draft.energy && (
          <p className="text-sm text-muted-foreground">
            Pick an energy level to continue.
          </p>
        )}
      </CardFooter>
    </Card>
  )
}

function RedFlagAlert({
  flags,
  onRemove,
}: {
  flags: RedFlag[]
  onRemove: (i: number) => void
}) {
  const systemic = flags.some(
    (f) => f.kind === 'chest-pain' || f.kind === 'dizziness',
  )
  return (
    <Alert variant="destructive">
      <AlertTriangle />
      <AlertTitle>
        {systemic
          ? 'Please don’t exercise today'
          : 'Noted — I’ll leave that area alone'}
      </AlertTitle>
      <AlertDescription>
        <p>
          {systemic
            ? 'Chest pain or dizziness needs checking by a doctor. If it’s severe or sudden, call emergency services.'
            : 'Sharp, worsening pain, numbness or swelling isn’t normal soreness. If it persists, see a GP or physio.'}
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {flags.map((f, i) => (
            <li key={i}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRemove(i)}
                aria-label={`Remove: ${flagText(f)}`}
                className="h-7 text-foreground"
              >
                {flagText(f)} <X />
              </Button>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

function flagText(f: RedFlag) {
  return `${f.kind.replace('-', ' ')}${f.area ? ` — ${areaLabel(f.area).toLowerCase()}` : ''}`
}

function merge(d: Draft, m: Interpretation): Draft {
  const next = { ...d }
  if (m.pain) {
    next.pain = m.pain.severity
    next.painAreas = m.pain.severity
      ? [...new Set([...d.painAreas, ...m.pain.areas])]
      : []
  }
  if (m.stiffness) {
    next.stiffness = m.stiffness.severity
    next.stiffAreas = m.stiffness.severity
      ? [...new Set([...d.stiffAreas, ...m.stiffness.areas])]
      : []
  }
  if (m.energy) next.energy = m.energy
  if (m.sleep) next.sleep = m.sleep
  if (m.timeAvailable) next.timeAvailable = m.timeAvailable
  if (m.redFlags.length) {
    next.redFlags = [...d.redFlags, ...m.redFlags]
    // Red-flag areas count as painful too, so they show up in the form.
    const areas = m.redFlags.flatMap((f) => (f.area ? [f.area] : []))
    if (areas.length) {
      next.pain = Math.max(next.pain, 2) as Severity
      next.painAreas = [...new Set([...next.painAreas, ...areas])]
    }
  }
  return next
}
