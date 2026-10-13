import { useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { coach, type Interpretation } from '@/coach'
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
import { Textarea } from '@/components/ui/textarea'
import type {
  BodyArea,
  Change,
  Level,
  PostCheck,
  RedFlag,
  SessionLog,
} from '@/domain/types'
import { useVoice, useVoiceHandler } from '@/voice/voice-provider'

const CHANGES: { value: Change; label: string }[] = [
  { value: 'better', label: 'Better' },
  { value: 'same', label: 'Same' },
  { value: 'worse', label: 'Worse' },
]
const LEVELS = ([1, 2, 3, 4, 5] as Level[]).map((v) => ({
  value: v,
  label: String(v),
}))
const RPE = Array.from({ length: 10 }, (_, i) => ({
  value: i + 1,
  label: String(i + 1),
}))

export function PostSessionCheck({
  log,
  onSave,
}: {
  log: Omit<SessionLog, 'post' | 'date'>
  onSave: (post: PostCheck) => void
}) {
  const voice = useVoice()
  const [energy, setEnergy] = useState<Level>()
  const [painChange, setPainChange] = useState<Change>('same')
  const [stiffnessChange, setStiffnessChange] = useState<Change>('same')
  const [rpe, setRpe] = useState<number>()
  const [note, setNote] = useState('')
  const [flagged, setFlagged] = useState(false)
  const [flagAreas, setFlagAreas] = useState<BodyArea[]>([])
  const [heard, setHeard] = useState<Interpretation>()
  const [spokenFlags, setSpokenFlags] = useState<RedFlag[]>([])
  const asked = useRef(false)

  useEffect(() => {
    if (asked.current) return
    asked.current = true
    const done = log.exercises.filter((e) => e.status === 'done').length
    void voice.say(
      `${log.status === 'completed' ? 'Done — nice work.' : `You did ${done} of ${log.exercises.length}. That still counts.`} How hard did that feel, one to ten? And any change in soreness or stiffness?`,
    )
  }, [voice, log])

  const ready = rpe !== undefined
  const save = () => {
    if (!ready) return
    const post: PostCheck = {
      energy: energy ?? 3,
      painChange,
      stiffnessChange,
      rpe,
      note: note.trim() || undefined,
      redFlags: flagged ? flagsFrom(spokenFlags, flagAreas, note) : [],
    }
    void voice.say(coach.afterSession(post), { noListen: true })
    onSave(post)
  }

  useVoiceHandler((text) => {
    const m = coach.interpretUtterance(
      text,
      rpe === undefined ? 'rpe' : undefined,
    )
    if (m.yes && ready && m.summary.length === 0) return save()
    setHeard(m)
    if (m.rpe) setRpe(m.rpe)
    if (m.energy) setEnergy(m.energy)
    if (m.painChange) setPainChange(m.painChange)
    if (m.stiffnessChange) setStiffnessChange(m.stiffnessChange)
    if (m.redFlags.length) {
      setFlagged(true)
      setSpokenFlags((fs) => [...fs, ...m.redFlags])
      setFlagAreas((as) => [
        ...new Set([
          ...as,
          ...m.redFlags.flatMap((f) => (f.area ? [f.area] : [])),
        ]),
      ])
    }
    // Anything that isn't a rating is kept as the note.
    if (!m.rpe && !m.energy && !m.painChange && !m.stiffnessChange)
      setNote((n) => (n ? `${n} ${text}` : text))
    const haveRpe = m.rpe ?? rpe
    void voice.say(
      haveRpe
        ? 'Got it. Say yes to save, or add a note.'
        : 'Thanks. And the effort, one to ten?',
    )
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">How do you feel now?</CardTitle>
        <CardDescription>
          Ten seconds. It shapes tomorrow’s plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {heard && <HeardChip text={heard.text} summary={heard.summary} />}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">
            Effort (RPE){' '}
            <span className="font-normal text-muted-foreground">
              1 very easy – 10 maximal
            </span>
          </legend>
          <ChoiceGroup
            label="Perceived effort, 1 to 10"
            value={rpe}
            options={RPE}
            onChange={setRpe}
          />
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Energy now (1–5)</legend>
          <ChoiceGroup
            label="Energy now"
            value={energy}
            options={LEVELS}
            onChange={setEnergy}
          />
        </fieldset>
        <div className="grid gap-6 sm:grid-cols-2">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Soreness</legend>
            <ChoiceGroup
              label="Soreness change"
              value={painChange}
              options={CHANGES}
              onChange={setPainChange}
            />
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Stiffness</legend>
            <ChoiceGroup
              label="Stiffness change"
              value={stiffnessChange}
              options={CHANGES}
              onChange={setStiffnessChange}
            />
          </fieldset>
        </div>

        <div className="space-y-2">
          <Label htmlFor="post-note">Note (optional)</Label>
          <Textarea
            id="post-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything worth remembering?"
            rows={2}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="post-flag"
              checked={flagged}
              onCheckedChange={(c) => setFlagged(c === true)}
            />
            <Label htmlFor="post-flag" className="font-normal">
              Sharp or worsening pain, numbness, dizziness or chest pain
            </Label>
          </div>
          {flagged && (
            <>
              <AreaChips
                label="Where?"
                value={flagAreas}
                onChange={setFlagAreas}
              />
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>Stop for now</AlertTitle>
                <AlertDescription>
                  That’s more than normal soreness. Don’t push through it — I’ll
                  leave that area out of upcoming plans. If it doesn’t settle,
                  see a GP or physio. For chest pain or dizziness, seek medical
                  help promptly.
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-3">
        <Button size="lg" disabled={!ready} onClick={save}>
          Save
        </Button>
        {!ready && (
          <p className="text-sm text-muted-foreground">
            Pick an effort rating to save.
          </p>
        )}
      </CardFooter>
    </Card>
  )
}

/** Spoken flags keep their kind (e.g. dizziness); ticked areas add sharp-pain flags. */
function flagsFrom(
  spoken: RedFlag[],
  areas: BodyArea[],
  note: string,
): RedFlag[] {
  const text = note || 'Flagged after session'
  const extra = areas
    .filter((a) => !spoken.some((f) => f.area === a))
    .map((area) => ({ kind: 'sharp-pain' as const, area, text }))
  const all = [...spoken, ...extra]
  return all.length ? all : [{ kind: 'sharp-pain', text }]
}
