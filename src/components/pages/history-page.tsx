import { useState, type ReactNode } from 'react'
import { describeDose } from '@/coach'
import {
  ConsistencyDots,
  MinutesBars,
  TrendLine,
} from '@/components/atoms/mini-charts'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { findExercise } from '@/data/exercises'
import type { DayRecord } from '@/domain/types'
import { formatDay } from '@/lib/dates'
import { SEVERITY_LABELS, STATUS_LABELS, areaLabel } from '@/lib/labels'
import { dayStats, summarise } from '@/lib/trends'
import { useAppState } from '@/state/app-state'

export function HistoryPage() {
  const [tab, setTab] = useState('7')
  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="7">7 days</TabsTrigger>
        <TabsTrigger value="30">30 days</TabsTrigger>
        <TabsTrigger value="days">Day by day</TabsTrigger>
      </TabsList>
      <TabsContent value="7">
        <Trends window={7} />
      </TabsContent>
      <TabsContent value="30">
        <Trends window={30} />
      </TabsContent>
      <TabsContent value="days">
        <DayList />
      </TabsContent>
    </Tabs>
  )
}

function Trends({ window }: { window: number }) {
  const { allDays, today } = useAppState()
  const stats = dayStats(allDays, today, window)
  const sum = summarise(stats)
  const fmt = (n?: number) => (n === undefined ? '—' : n.toFixed(1))
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Days you moved" value={`${sum.daysMoved} of ${window}`} />
        <Stat label="Movement minutes" value={String(sum.minutes)} />
        <Stat
          label="Plan completion"
          value={sum.completion === undefined ? '—' : `${sum.completion}%`}
        />
        <Stat label="Average energy" value={`${fmt(sum.energy)} / 5`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consistency</CardTitle>
          <CardDescription>
            Every day you moved is a filled dot. Rest days are part of the plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConsistencyDots stats={stats} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movement minutes per day</CardTitle>
        </CardHeader>
        <CardContent>
          <MinutesBars stats={stats} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            How you’ve felt each morning
          </CardTitle>
          <CardDescription>Gaps are days without a check-in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <TrendBlock title="Energy" note={`average ${fmt(sum.energy)} (1–5)`}>
            <TrendLine
              stats={stats}
              pick={(s) => s.energy}
              min={1}
              max={5}
              label="Energy"
            />
          </TrendBlock>
          <TrendBlock
            title="Soreness"
            note={`average ${fmt(sum.soreness)} (0 none – 3 severe)`}
          >
            <TrendLine
              stats={stats}
              pick={(s) => s.soreness}
              min={0}
              max={3}
              label="Soreness"
            />
          </TrendBlock>
          <TrendBlock
            title="Stiffness"
            note={`average ${fmt(sum.stiffness)} (0 none – 3 severe)`}
          >
            <TrendLine
              stats={stats}
              pick={(s) => s.stiffness}
              min={0}
              max={3}
              label="Stiffness"
            />
          </TrendBlock>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              Show as a table
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left tabular-nums">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Day</th>
                    <th className="py-1 pr-3 font-medium">Minutes</th>
                    <th className="py-1 pr-3 font-medium">Done / planned</th>
                    <th className="py-1 pr-3 font-medium">Energy</th>
                    <th className="py-1 pr-3 font-medium">Soreness</th>
                    <th className="py-1 font-medium">Stiffness</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => (
                    <tr key={s.date} className="border-t">
                      <td className="py-1 pr-3">{formatDay(s.date)}</td>
                      <td className="py-1 pr-3">{s.minutes}</td>
                      <td className="py-1 pr-3">
                        {s.done} / {s.planned}
                      </td>
                      <td className="py-1 pr-3">{s.energy ?? '—'}</td>
                      <td className="py-1 pr-3">{s.soreness ?? '—'}</td>
                      <td className="py-1">{s.stiffness ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  )
}

function TrendBlock({
  title,
  note,
  children,
}: {
  title: string
  note: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm">
        <span className="font-medium">{title}</span>{' '}
        <span className="text-muted-foreground">· {note}</span>
      </p>
      {children}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function DayList() {
  const { allDays, today } = useAppState()
  const days = [...allDays].reverse()
  if (!days.length)
    return <p className="text-muted-foreground">Nothing logged yet.</p>
  return (
    <ol className="space-y-3">
      {days.map((d) => (
        <li key={d.date}>
          <DayCard day={d} past={d.date < today} />
        </li>
      ))}
    </ol>
  )
}

function DayCard({ day, past }: { day: DayRecord; past: boolean }) {
  const c = day.checkIn
  const time = (iso?: string) =>
    iso
      ? new Date(iso).toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        })
      : '—'
  const done = day.sessions.filter((s) => s.status !== 'skipped')
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {formatDay(day.date)}
          {day.demo && <Badge variant="outline">Demo</Badge>}
        </CardTitle>
        <CardDescription>
          {day.plan
            ? `${done.length} of ${day.plan.items.length} planned done`
            : `${done.length} sessions`}{' '}
          · {Math.round(done.reduce((t, s) => t + s.durationSec, 0) / 60)} min
          {day.usage &&
            ` · first opened ${time(day.usage.firstOpen)}, ${day.usage.opens} opens, last active ${time(day.usage.lastInteraction)}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-4 text-sm">
        {c ? (
          <p>
            <span className="text-muted-foreground">Morning:</span> energy{' '}
            {c.energy}/5 · soreness {SEVERITY_LABELS[c.pain].toLowerCase()}
            {c.painAreas.length > 0 &&
              ` (${c.painAreas.map(areaLabel).join(', ')})`}{' '}
            · stiffness {SEVERITY_LABELS[c.stiffness].toLowerCase()}
            {c.stiffAreas.length > 0 &&
              ` (${c.stiffAreas.map(areaLabel).join(', ')})`}
            {c.sleep && ` · sleep ${c.sleep}/5`}
            {c.redFlags.length > 0 && ' · ⚠ warning signs reported'}
          </p>
        ) : (
          <p className="text-muted-foreground">No check-in.</p>
        )}
        {past && done.length === 0 && (
          <p className="font-medium">
            No exercise this day
            {!day.usage && !c && ' — the app wasn’t opened'}.
          </p>
        )}
        {day.plan && (
          <ul className="space-y-2">
            {day.plan.items.map((item) => {
              const log = day.sessions.find((s) => s.itemId === item.id)
              return (
                <li key={item.id} className="rounded-md border p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {item.time} {item.title}
                    </span>
                    <Badge
                      variant={
                        item.status === 'completed' ? 'default' : 'outline'
                      }
                    >
                      {STATUS_LABELS[item.status]}
                    </Badge>
                  </div>
                  {log && log.status !== 'skipped' && (
                    <>
                      <ul className="mt-1 text-muted-foreground">
                        {log.exercises.map((e, i) => (
                          <li key={i}>
                            {findExercise(e.exerciseId)?.name ?? e.exerciseId}:{' '}
                            {e.status === 'skipped'
                              ? 'skipped'
                              : e.repsDone !== undefined
                                ? `${e.repsDone} reps`
                                : `${e.secondsDone ?? 0} s`}{' '}
                            <span className="text-xs">
                              (target {describeDose(e.target)}
                              {e.variation !== 'standard'
                                ? `, ${e.variation}`
                                : ''}
                              )
                            </span>
                          </li>
                        ))}
                      </ul>
                      {log.post && (
                        <p className="mt-1">
                          After: effort {log.post.rpe}/10 · energy{' '}
                          {log.post.energy}/5 · soreness {log.post.painChange} ·
                          stiffness {log.post.stiffnessChange}
                          {log.post.note && ` · “${log.post.note}”`}
                        </p>
                      )}
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
