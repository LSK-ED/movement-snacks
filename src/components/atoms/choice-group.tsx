import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

interface Option<T extends string | number> {
  value: T
  label: string
  /** Longer accessible label, if the visible one is terse. */
  aria?: string
}

/** A single-choice row of buttons (none/mild/moderate/severe, 1–5, …). */
export function ChoiceGroup<T extends string | number>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: T | undefined
  options: Option<T>[]
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      aria-label={label}
      value={value === undefined ? '' : String(value)}
      onValueChange={(v) => {
        if (!v) return
        const match = options.find((o) => String(o.value) === v)
        if (match) onChange(match.value)
      }}
      className={cn('w-full flex-wrap', className)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={String(o.value)}
          value={String(o.value)}
          aria-label={o.aria ?? o.label}
          className="min-w-11 flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
