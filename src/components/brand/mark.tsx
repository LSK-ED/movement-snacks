import { cn } from '@/lib/utils'

/** The Movement Snacks mark: a round "snack" with a bite taken out, and the crumb in motion. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn('size-7 text-highlight', className)}
    >
      <path
        fill="currentColor"
        d="M16 3a13 13 0 1 0 12.6 9.8 4.2 4.2 0 0 1-5.3-4.9A4.2 4.2 0 0 1 19.1 3.4 13 13 0 0 0 16 3Z"
      />
      <circle cx="26.5" cy="5.5" r="2.2" fill="currentColor" />
      <path
        d="M9.5 19.5c2 2.2 4.1 3.2 6.5 3.2s4.5-1 6.5-3.2"
        fill="none"
        stroke="var(--background)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <Mark />
      <span className="font-semibold tracking-tight">Movement Snacks</span>
    </span>
  )
}
