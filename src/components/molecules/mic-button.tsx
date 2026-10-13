import { Loader2, Mic, MicOff, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useVoice } from '@/voice/voice-provider'

const LABELS = {
  idle: 'Tap to talk',
  listening: 'Listening… tap to stop',
  thinking: 'Thinking…',
  speaking: 'Coach speaking — tap to interrupt and talk',
} as const

export function MicButton({ className }: { className?: string }) {
  const voice = useVoice()
  if (!voice.inputAvailable) {
    const why = !voice.supported.input
      ? 'Voice input isn’t supported in this browser'
      : voice.denied
        ? 'Microphone blocked'
        : 'Voice input is off in settings'
    return (
      <Button
        variant="outline"
        size="icon"
        disabled
        aria-label={why}
        title={why}
        className={cn('size-12 rounded-full', className)}
      >
        <MicOff className="size-5" />
      </Button>
    )
  }
  const { mic } = voice
  const Icon = mic === 'thinking' ? Loader2 : mic === 'speaking' ? Volume2 : Mic
  return (
    <div className={cn('relative', className)}>
      {mic === 'listening' && (
        <span
          aria-hidden
          className="absolute inset-0 animate-ping rounded-full bg-highlight/40"
        />
      )}
      <Button
        size="icon"
        onClick={voice.listen}
        aria-label={LABELS[mic]}
        title={LABELS[mic]}
        aria-pressed={mic === 'listening'}
        className={cn(
          'relative size-12 rounded-full',
          mic === 'listening' &&
            'bg-highlight text-highlight-foreground hover:bg-highlight/90',
        )}
      >
        <Icon className={cn('size-5', mic === 'thinking' && 'animate-spin')} />
      </Button>
    </div>
  )
}

export function micStatusText(mic: string, handsFree: boolean): string {
  if (mic === 'listening') return 'Listening'
  if (mic === 'thinking') return 'Thinking'
  if (mic === 'speaking') return 'Speaking'
  return handsFree ? 'Hands-free' : 'Tap to talk'
}
