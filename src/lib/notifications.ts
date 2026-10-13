// Browser notifications. These only fire while the app (or installed PWA) is
// open in some tab — a plain web page can't wake itself up when closed.

export const notificationsSupported =
  typeof window !== 'undefined' && 'Notification' in window

export async function requestNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (!notificationsSupported) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

export function notify(title: string, body: string, tag: string) {
  if (!notificationsSupported || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, tag })
  } catch {
    // Some platforms only allow notifications from a service worker.
  }
}

/** Remembers which reminders were already sent today (per tab session). */
export function once(key: string): boolean {
  try {
    if (sessionStorage.getItem(`ms:notified:${key}`)) return false
    sessionStorage.setItem(`ms:notified:${key}`, '1')
    return true
  } catch {
    return true
  }
}
