import { Ear, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Shows what the app understood from the last utterance, with a quick undo. */
export function HeardChip({
  text,
  summary,
  onUndo,
}: {
  text: string
  summary: string[]
  onUndo?: () => void
}) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/40 p-3 text-sm"
    >
      <Ear
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground">
          Heard: <span className="text-foreground">“{text}”</span>
        </p>
        <p className="mt-0.5">
          {summary.length ? (
            <>Understood: {summary.join(' · ')}</>
          ) : (
            'I didn’t pick anything up from that — try again, or use the controls.'
          )}
        </p>
        {summary.length > 0 && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Wrong? Fix it with the controls below, or undo.
          </p>
        )}
      </div>
      {onUndo && summary.length > 0 && (
        <Button variant="ghost" size="sm" onClick={onUndo}>
          <Undo2 /> Undo
        </Button>
      )}
    </div>
  )
}
