import { useState, type ReactNode } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { AreaChips } from '@/components/atoms/area-chips'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { EXERCISES } from '@/data/exercises'
import { EQUIPMENT } from '@/domain/types'
import { EQUIPMENT_LABELS } from '@/lib/labels'
import {
  notificationsSupported,
  requestNotificationPermission,
} from '@/lib/notifications'
import { useAppState } from '@/state/app-state'
import { voiceSupport } from '@/voice/engine'
import { DisclaimerText } from '@/components/organisms/disclaimer-dialog'

export function SettingsPage() {
  const app = useAppState()
  const s = app.settings
  const [notifNote, setNotifNote] = useState('')

  const download = (name: string, text: string, type: string) => {
    const url = URL.createObjectURL(new Blob([text], { type }))
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: name,
    })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <Section
        title="Voice"
        description="The coach speaks and listens using your browser’s built-in speech features."
      >
        <Toggle
          id="voice-out"
          label="Coach speaks aloud"
          checked={s.voiceOutput}
          disabled={!voiceSupport.output}
          onChange={(v) => app.updateSettings({ voiceOutput: v })}
          hint={
            voiceSupport.output
              ? undefined
              : 'Not supported in this browser — captions only.'
          }
        />
        <Toggle
          id="voice-in"
          label="Voice input (microphone)"
          checked={s.voiceInput}
          disabled={!voiceSupport.input}
          onChange={(v) => app.updateSettings({ voiceInput: v })}
          hint={
            voiceSupport.input
              ? undefined
              : 'Not supported in this browser — try Chrome or Edge. Buttons and typing still work.'
          }
        />
        <Toggle
          id="hands-free-setting"
          label="Hands-free (listen automatically after the coach speaks)"
          checked={s.handsFree}
          disabled={!voiceSupport.input || !s.voiceInput}
          onChange={(v) => app.updateSettings({ handsFree: v })}
        />
        <div className="space-y-2">
          <Label htmlFor="rate">
            Speaking speed: {s.speechRate.toFixed(1)}×
          </Label>
          <Slider
            id="rate"
            min={0.7}
            max={1.4}
            step={0.1}
            value={[s.speechRate]}
            onValueChange={([v]) => app.updateSettings({ speechRate: v })}
            className="max-w-xs"
          />
        </div>
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          Privacy note: in some browsers (including Chrome), speech recognition
          sends your audio to the browser vendor’s cloud service to be
          transcribed. Nothing else leaves your device. Turn voice input off
          above if you’d rather avoid that.
        </p>
      </Section>

      <Section
        title="Reminders"
        description="The 9 am check-in prompt and snack reminders."
      >
        <Toggle
          id="notifications"
          label="Browser notifications"
          checked={s.notifications}
          disabled={!notificationsSupported}
          onChange={async (on) => {
            if (!on) return app.updateSettings({ notifications: false })
            const p = await requestNotificationPermission()
            app.updateSettings({ notifications: p === 'granted' })
            setNotifNote(
              p === 'granted'
                ? 'Notifications on.'
                : 'Permission wasn’t granted — reminders will show in the app only.',
            )
          }}
        />
        {notifNote && (
          <p className="text-sm" role="status">
            {notifNote}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Reminders only work while this app is open in a tab (it can be in the
          background). Browsers don’t let a closed web page wake itself up.
        </p>
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1">
            <Label htmlFor="day-start">Work day starts</Label>
            <Input
              id="day-start"
              type="time"
              value={s.dayStart}
              onChange={(e) =>
                e.target.value &&
                app.updateSettings({ dayStart: e.target.value })
              }
              className="w-32"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="day-end">Work day ends</Label>
            <Input
              id="day-end"
              type="time"
              value={s.dayEnd}
              onChange={(e) =>
                e.target.value && app.updateSettings({ dayEnd: e.target.value })
              }
              className="w-32"
            />
          </div>
        </div>
      </Section>

      <Section
        title="Equipment"
        description="Exercises that need something you don’t have are left out."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {EQUIPMENT.map((e) => (
            <div key={e} className="flex items-center gap-2">
              <Checkbox
                id={`eq-${e}`}
                checked={s.equipment.includes(e)}
                onCheckedChange={(c) =>
                  app.updateSettings({
                    equipment:
                      c === true
                        ? [...s.equipment, e]
                        : s.equipment.filter((x) => x !== e),
                  })
                }
              />
              <Label htmlFor={`eq-${e}`} className="font-normal">
                {EQUIPMENT_LABELS[e]}
              </Label>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Exclusions"
        description="Body areas and exercises to always leave out."
      >
        <AreaChips
          label="Excluded body areas"
          value={s.excludedAreas}
          onChange={(excludedAreas) => app.updateSettings({ excludedAreas })}
        />
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            Exercises ({EXERCISES.length - s.excludedExercises.length} of{' '}
            {EXERCISES.length} included)
          </summary>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {EXERCISES.map((ex) => (
              <li key={ex.id} className="flex items-start gap-2">
                <Checkbox
                  id={`ex-${ex.id}`}
                  checked={!s.excludedExercises.includes(ex.id)}
                  onCheckedChange={(c) =>
                    app.updateSettings({
                      excludedExercises:
                        c === true
                          ? s.excludedExercises.filter((x) => x !== ex.id)
                          : [...s.excludedExercises, ex.id],
                    })
                  }
                />
                <Label
                  htmlFor={`ex-${ex.id}`}
                  className="flex-col items-start gap-0 font-normal"
                >
                  <span>{ex.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {ex.category} · {ex.intensity}
                    {ex.equipment.length ? ` · ${ex.equipment.join(', ')}` : ''}
                  </span>
                </Label>
              </li>
            ))}
          </ul>
        </details>
      </Section>

      <Section
        title="Your data"
        description="Everything is stored in this browser only. No accounts, no analytics."
      >
        <Toggle
          id="demo"
          label="Show a week of demo history"
          checked={s.demoData}
          onChange={(v) => app.setDemoData(v)}
          hint="Demo days are labelled and never overwrite real ones. Turning this off removes them."
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              download(
                `movement-snacks-${app.today}.json`,
                app.exportJson(),
                'application/json',
              )
            }
          >
            <Download /> Export JSON
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              download(
                `movement-snacks-${app.today}.csv`,
                app.exportCsv(),
                'text/csv',
              )
            }
          >
            <Download /> Export CSV
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 /> Delete all data
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete everything?</DialogTitle>
                <DialogDescription>
                  This removes every check-in, plan, session and setting from
                  this browser. It can’t be undone — export first if you want a
                  copy.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="destructive" onClick={app.deleteAll}>
                    Delete all data
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Section>

      <Section
        title="About"
        description="General fitness guidance, not medical advice."
      >
        <DisclaimerText />
      </Section>
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

function Toggle({
  id,
  label,
  checked,
  onChange,
  disabled,
  hint,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  hint?: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled}
        />
        <Label htmlFor={id} className="font-normal">
          {label}
        </Label>
      </div>
      {hint && <p className="pl-12 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
