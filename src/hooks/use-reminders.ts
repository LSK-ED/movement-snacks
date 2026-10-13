import { useEffect, useRef } from 'react'
import { nowMinutes, toMinutes } from '@/lib/dates'
import { notify, once } from '@/lib/notifications'
import { useAppState } from '@/state/app-state'

const CHECK_IN_TIME = '09:00'
/** A snack is "due" for this long after its planned time. */
const DUE_WINDOW = 30

/**
 * While the app is open: the 9 am check-in prompt and snack reminders.
 * Notifications go out when the tab is hidden; when it's visible the coach
 * just says it (via `onDue`).
 */
export function useReminders(onDue: (text: string) => void) {
  const { today, todayRecord, settings } = useAppState()
  const onDueRef = useRef(onDue)
  onDueRef.current = onDue

  useEffect(() => {
    const check = () => {
      const now = nowMinutes()
      const visible = document.visibilityState === 'visible'
      const tell = (key: string, title: string, body: string) => {
        if (!once(`${today}:${key}`)) return
        if (visible) onDueRef.current(body)
        else if (settings.notifications) notify(title, body, key)
      }
      if (!todayRecord.checkIn && now >= toMinutes(CHECK_IN_TIME)) {
        tell(
          'checkin',
          'Morning check-in',
          'Morning! How are you feeling today? Thirty seconds and I’ll plan your movement.',
        )
      }
      const plan = todayRecord.plan
      if (!plan?.accepted) return
      for (const item of plan.items) {
        const t = toMinutes(item.time)
        if (item.status === 'pending' && now >= t && now < t + DUE_WINDOW) {
          tell(
            item.id,
            'Movement snack',
            `Time for your ${item.title.toLowerCase()} — about ${item.minutes} minute${item.minutes === 1 ? '' : 's'}.`,
          )
        }
      }
    }
    check()
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [today, todayRecord, settings.notifications])
}
