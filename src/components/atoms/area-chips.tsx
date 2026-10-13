import { BODY_AREAS, type BodyArea } from '@/domain/types'
import { Toggle } from '@/components/ui/toggle'
import { areaLabel } from '@/lib/labels'

/** Multi-select body areas as toggle chips. */
export function AreaChips({
  label,
  value,
  onChange,
  areas = BODY_AREAS,
}: {
  label: string
  value: BodyArea[]
  onChange: (areas: BodyArea[]) => void
  areas?: readonly BodyArea[]
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {areas.map((a) => {
        const on = value.includes(a)
        return (
          <Toggle
            key={a}
            size="sm"
            variant="outline"
            pressed={on}
            onPressedChange={(p) =>
              onChange(p ? [...value, a] : value.filter((x) => x !== a))
            }
            className="rounded-full px-3 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {areaLabel(a)}
          </Toggle>
        )
      })}
    </div>
  )
}
