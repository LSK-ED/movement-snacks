import { useState } from 'react'
import { formatDay } from '@/lib/dates'
import type { DayStat } from '@/lib/trends'

// Small single-series charts. Each one names its own series in the heading, so
// there's no legend; every value is reachable by hover/focus and in a table.

const H = 96

export function MinutesBars({ stats }: { stats: DayStat[] }) {
  const [hover, setHover] = useState<number>()
  const max = Math.max(5, ...stats.map((s) => s.minutes))
  const w = 100 / stats.length
  const gap = stats.length > 14 ? 0.4 : 1
  return (
    <figure className="space-y-1">
      <div className="relative">
        <svg
          viewBox={`0 0 100 ${H}`}
          preserveAspectRatio="none"
          className="h-24 w-full"
          role="img"
          aria-label={`Movement minutes per day, up to ${max} minutes`}
        >
          <line
            x1="0"
            x2="100"
            y1={H - 0.5}
            y2={H - 0.5}
            stroke="var(--border)"
            vectorEffect="non-scaling-stroke"
          />
          {stats.map((s, i) => {
            const h = s.minutes ? Math.max(3, (s.minutes / max) * (H - 4)) : 0
            return (
              <g
                key={s.date}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(undefined)}
              >
                <rect x={i * w} y={0} width={w} height={H} fill="transparent" />
                {h > 0 && (
                  <rect
                    x={i * w + gap / 2}
                    y={H - h}
                    width={w - gap}
                    height={h}
                    rx={Math.min(1.2, (w - gap) / 2)}
                    fill="var(--highlight)"
                    opacity={hover === undefined || hover === i ? 1 : 0.55}
                  />
                )}
              </g>
            )
          })}
        </svg>
        {hover !== undefined && (
          <Tip
            stat={stats[hover]}
            left={(hover + 0.5) * w}
            text={`${stats[hover].minutes} min · ${stats[hover].done} done`}
          />
        )}
      </div>
      <Axis stats={stats} />
    </figure>
  )
}

export function TrendLine({
  stats,
  pick,
  min,
  max,
  label,
}: {
  stats: DayStat[]
  pick: (s: DayStat) => number | undefined
  min: number
  max: number
  label: string
}) {
  const [hover, setHover] = useState<number>()
  const w = 100 / stats.length
  const x = (i: number) => (i + 0.5) * w
  const y = (v: number) => H - 6 - ((v - min) / (max - min)) * (H - 12)
  const points = stats
    .map((s, i) => ({ i, v: pick(s) }))
    .filter((p): p is { i: number; v: number } => p.v !== undefined)
  // Break the line across days with no check-in.
  const segments: string[] = []
  let d = ''
  stats.forEach((s, i) => {
    const v = pick(s)
    if (v === undefined) {
      if (d) segments.push(d)
      d = ''
    } else d += `${d ? 'L' : 'M'}${x(i)},${y(v)}`
  })
  if (d) segments.push(d)

  return (
    <figure className="space-y-1">
      <div className="relative">
        <svg
          viewBox={`0 0 100 ${H}`}
          preserveAspectRatio="none"
          className="h-20 w-full"
          role="img"
          aria-label={`${label}, scale ${min} to ${max}`}
        >
          {[min, max].map((g) => (
            <line
              key={g}
              x1="0"
              x2="100"
              y1={y(g)}
              y2={y(g)}
              stroke="var(--border)"
              strokeDasharray="2 2"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {segments.map((p, k) => (
            <path
              key={k}
              d={p}
              fill="none"
              stroke="var(--foreground)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {hover !== undefined && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1="0"
              y2={H}
              stroke="var(--muted-foreground)"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {stats.map((s, i) => (
            <rect
              key={s.date}
              x={i * w}
              y="0"
              width={w}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(undefined)}
            />
          ))}
        </svg>
        {/* Markers in HTML so they stay round when the SVG stretches. */}
        {points.map((p) => (
          <span
            key={p.i}
            aria-hidden
            className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground ring-2 ring-card"
            style={{ left: `${x(p.i)}%`, top: `${(y(p.v) / H) * 100}%` }}
          />
        ))}
        {hover !== undefined && (
          <Tip
            stat={stats[hover]}
            left={x(hover)}
            text={
              pick(stats[hover]) === undefined
                ? 'No check-in'
                : `${label}: ${pick(stats[hover])}`
            }
          />
        )}
      </div>
    </figure>
  )
}

function Tip({
  stat,
  left,
  text,
}: {
  stat: DayStat
  left: number
  text: string
}) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-sm"
      style={{ left: `${Math.min(85, Math.max(15, left))}%` }}
    >
      <span className="font-medium">{formatDay(stat.date)}</span> · {text}
    </div>
  )
}

function Axis({ stats }: { stats: DayStat[] }) {
  const first = stats[0]
  const last = stats[stats.length - 1]
  return (
    <div className="flex justify-between text-xs text-muted-foreground">
      <span>{formatDay(first.date)}</span>
      <span>Today</span>
      <span className="sr-only">{formatDay(last.date)}</span>
    </div>
  )
}

/** Gentle consistency: a dot per day, filled when you moved. No streak to break. */
export function ConsistencyDots({ stats }: { stats: DayStat[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Days you moved">
      {stats.map((s) => (
        <li
          key={s.date}
          title={`${formatDay(s.date)}: ${s.moved ? 'moved' : 'rest day'}`}
          className={
            s.moved
              ? 'size-3.5 rounded-full bg-highlight'
              : 'size-3.5 rounded-full border border-muted-foreground/40'
          }
        >
          <span className="sr-only">
            {formatDay(s.date)}: {s.moved ? 'moved' : 'rest day'}
          </span>
        </li>
      ))}
    </ul>
  )
}
