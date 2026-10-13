import { useState } from 'react'
import { ChevronUp, RotateCcw, Send } from 'lucide-react'
import { MicButton, micStatusText } from '@/components/molecules/mic-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useVoice } from '@/voice/voice-provider'

/**
 * The coach's voice made visible: the latest line as a caption, the mic, a
 * hands-free switch and a text box. Everything the coach says appears here.
 */
export function CoachBar() {
  const voice = useVoice()
  const [draft, setDraft] = useState('')
  const [showLog, setShowLog] = useState(false)

  const send = () => {
    const text = draft.trim()
    if (!text) return
    voice.submitText(text)
    setDraft('')
  }

  return (
    <section
      aria-label="Coach"
      className="sticky bottom-0 z-20 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="mx-auto max-w-3xl px-4 py-3">
        {showLog && (
          <ol
            aria-label="Conversation transcript"
            className="mb-3 max-h-52 space-y-1.5 overflow-y-auto rounded-md border bg-muted/40 p-3 text-sm"
          >
            {voice.captions.length === 0 && (
              <li className="text-muted-foreground">Nothing yet.</li>
            )}
            {voice.captions.map((c) => (
              <li key={c.id} className={cn(c.who === 'you' && 'text-right')}>
                <span className="font-medium">
                  {c.who === 'coach'
                    ? 'Coach'
                    : c.who === 'you'
                      ? 'You'
                      : 'Note'}
                  :
                </span>{' '}
                <span
                  className={cn(c.who === 'system' && 'text-muted-foreground')}
                >
                  {c.text}
                </span>
              </li>
            ))}
          </ol>
        )}

        <div className="flex items-start gap-3">
          <MicButton className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p aria-live="polite" className="text-sm leading-snug sm:text-base">
              {voice.lastCoachLine ??
                'Your coach will talk here. Every spoken line is captioned.'}
            </p>
            <p
              className="mt-1 min-h-5 text-xs text-muted-foreground"
              aria-live="polite"
            >
              {voice.mic === 'listening' && voice.interim ? (
                <>Hearing: “{voice.interim}”</>
              ) : (
                micStatusText(voice.mic, voice.handsFree)
              )}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            {voice.lastCoachLine && voice.outputEnabled && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Say that again"
                title="Say that again"
                onClick={() =>
                  void voice.say(voice.lastCoachLine!, {
                    noListen: true,
                    quiet: true,
                  })
                }
              >
                <RotateCcw />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label={showLog ? 'Hide transcript' : 'Show transcript'}
              aria-expanded={showLog}
              onClick={() => setShowLog((s) => !s)}
            >
              <ChevronUp
                className={cn('transition-transform', showLog && 'rotate-180')}
              />
            </Button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <form
            className="flex min-w-0 flex-1 basis-60 gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <Label htmlFor="coach-input" className="sr-only">
              Type to the coach
            </Label>
            <Input
              id="coach-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type instead — e.g. “knees a bit sore”, “done”"
              autoComplete="off"
            />
            <Button
              type="submit"
              variant="secondary"
              size="icon"
              aria-label="Send"
            >
              <Send />
            </Button>
          </form>
          {voice.inputAvailable && (
            <div className="flex items-center gap-2">
              <Switch
                id="hands-free"
                checked={voice.handsFree}
                onCheckedChange={voice.setHandsFree}
              />
              <Label htmlFor="hands-free" className="text-sm">
                Hands-free
              </Label>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
