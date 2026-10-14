import { useEffect, useState } from 'react'
import { coach } from '@/coach'
import { CheckInForm } from '@/components/organisms/check-in-form'
import { DayDashboard } from '@/components/organisms/day-dashboard'
import { PlanProposal } from '@/components/organisms/plan-proposal'
import { SessionRunner } from '@/components/organisms/session-runner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CheckIn, PlannedItem } from '@/domain/types'
import { nowMinutes } from '@/lib/dates'
import { useAppState } from '@/state/app-state'

export function TodayPage({
  onRunningChange,
}: {
  onRunningChange?: (running: boolean) => void
}) {
  const app = useAppState()
  const { todayRecord: day, today, history, settings } = app
  // The day it started on, so a session that runs past midnight stays with its plan.
  const [running, setRunning] = useState<{ item: PlannedItem; date: string }>()

  const setRun = (item?: PlannedItem) => {
    setRunning(item && { item, date: today })
    onRunningChange?.(!!item)
  }

  const onCheckIn = (checkIn: CheckIn) => {
    app.saveCheckIn(checkIn)
    app.savePlan(
      coach.getPlan({
        date: today,
        checkIn,
        history,
        settings,
        nowMinutes: nowMinutes(),
      }),
    )
  }

  // A check-in without a plan (e.g. the plan was cleared) — make one.
  const needsPlan = !!day.checkIn && !day.plan
  useEffect(() => {
    if (needsPlan && day.checkIn) onCheckIn(day.checkIn)
  }, [needsPlan])

  // Wait for the first-run dialog (it may load demo history the recap uses).
  if (!settings.disclaimerAccepted) return null

  if (running) {
    return (
      <SessionRunner
        key={running.item.id}
        item={running.item}
        onCancel={() => setRun()}
        onProgress={(log) => app.logSession({ ...log, date: running.date })}
        onFinish={(log) => {
          app.logSession({ ...log, date: running.date })
          setRun()
        }}
      />
    )
  }

  if (!day.checkIn) {
    return (
      <div className="space-y-4">
        <Card className="bg-muted/40">
          <CardHeader>
            <CardTitle className="text-base">Yesterday</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{coach.yesterdayRecap(today, history)}</p>
          </CardContent>
        </Card>
        <CheckInForm
          date={today}
          intro={coach.yesterdayRecap(today, history)}
          onSave={onCheckIn}
        />
      </div>
    )
  }

  if (!day.plan) return null

  if (!day.plan.accepted) return <PlanProposal plan={day.plan} />

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {coach.yesterdayRecap(today, history)}
      </p>
      <DayDashboard
        day={day}
        onStart={(item) => {
          app.sessionStarted()
          setRun(item)
        }}
      />
    </div>
  )
}
