import { coach, type PlanContext } from '@/coach'
import type { Plan, PlannedItem } from '@/domain/types'
import { fromMinutes, nowMinutes, toMinutes } from '@/lib/dates'
import { useAppState } from '@/state/app-state'

/** Plan context for the coach, built from app state. */
export function usePlanContext(): PlanContext | undefined {
  const { today, todayRecord, history, settings } = useAppState()
  if (!todayRecord.checkIn) return undefined
  return {
    date: today,
    checkIn: todayRecord.checkIn,
    history,
    settings,
    adjustments: todayRecord.plan?.adjustments,
    nowMinutes: nowMinutes(),
  }
}

/** Shift, swap, skip, re-plan and accept — shared by the proposal and the day view. */
export function usePlanEditing() {
  const { todayRecord, savePlan, updateItem } = useAppState()
  const ctx = usePlanContext()
  const plan = todayRecord.plan

  return {
    shift(item: PlannedItem, minutes: number) {
      updateItem(item.id, { time: fromMinutes(toMinutes(item.time) + minutes) })
    },
    swap(item: PlannedItem) {
      if (!ctx) return
      updateItem(item.id, coach.swapItem(ctx, item))
    },
    skip(item: PlannedItem) {
      updateItem(item.id, { status: 'skipped' })
    },
    replan(request: string): { reply: string } {
      if (!ctx || !plan) return { reply: '' }
      const { plan: next, reply } = coach.replan(ctx, plan, request)
      if (next !== plan) {
        // Keep anything already done or skipped today.
        const items = next.items.map(
          (i) =>
            plan.items.find((o) => o.id === i.id && o.status !== 'pending') ??
            i,
        )
        savePlan({ ...next, items, accepted: plan.accepted })
      }
      return { reply }
    },
    accept() {
      if (plan) savePlan({ ...plan, accepted: true } satisfies Plan)
    },
  }
}
