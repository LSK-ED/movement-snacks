// Thin wrapper over the browser's Web Speech APIs, with feature detection.
// Nothing here is React-specific; VoiceProvider adapts it to state.

interface RecognitionResultEvent {
  resultIndex: number
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
}
interface RecognitionErrorEvent {
  error: string
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: RecognitionResultEvent) => void) | null
  onerror: ((e: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}
type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export const voiceSupport = {
  output: typeof window !== 'undefined' && 'speechSynthesis' in window,
  input: !!recognitionCtor(),
}

export type ListenOutcome =
  | { ok: true; text: string }
  | {
      ok: false
      reason: 'no-speech' | 'denied' | 'aborted' | 'unsupported' | 'error'
    }

// ── Output ────────────────────────────────────────────────────────────────

let preferredVoice: SpeechSynthesisVoice | undefined

function pickVoice(): SpeechSynthesisVoice | undefined {
  if (!voiceSupport.output) return undefined
  if (preferredVoice) return preferredVoice
  const voices = speechSynthesis.getVoices()
  const lang = navigator.language.toLowerCase()
  preferredVoice =
    voices.find((v) => v.lang.toLowerCase() === lang && v.localService) ??
    voices.find((v) => v.lang.toLowerCase() === lang) ??
    voices.find(
      (v) => v.lang.toLowerCase().startsWith('en') && v.localService,
    ) ??
    voices.find((v) => v.lang.toLowerCase().startsWith('en'))
  return preferredVoice
}

if (voiceSupport.output) {
  speechSynthesis.addEventListener?.('voiceschanged', () => {
    preferredVoice = undefined
  })
}

/** Speaks text; resolves when finished (or after a safety timeout). */
export function speak(text: string, rate = 1): Promise<void> {
  if (!voiceSupport.output || !text) return Promise.resolve()
  speechSynthesis.cancel()
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    u.rate = rate
    const voice = pickVoice()
    if (voice) u.voice = voice
    let finished = false
    const done = () => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      resolve()
    }
    // Some browsers never fire `end` — don't hang the app if so.
    const timer = setTimeout(done, 1500 + (text.length * 90) / rate)
    u.onend = done
    u.onerror = done
    speechSynthesis.speak(u)
  })
}

export function stopSpeaking() {
  if (voiceSupport.output) speechSynthesis.cancel()
}

// ── Input ─────────────────────────────────────────────────────────────────

let active: Recognition | undefined

/** One utterance. `onInterim` receives partial transcripts as they arrive. */
export function listenOnce(
  onInterim?: (text: string) => void,
): Promise<ListenOutcome> {
  const Ctor = recognitionCtor()
  if (!Ctor) return Promise.resolve({ ok: false, reason: 'unsupported' })
  active?.abort()
  return new Promise((resolve) => {
    const rec = new Ctor()
    active = rec
    rec.lang = navigator.language || 'en-US'
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1
    let finalText = ''
    let outcome: ListenOutcome | undefined
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interim += r[0].transcript
      }
      onInterim?.((finalText + ' ' + interim).trim())
    }
    rec.onerror = (e) => {
      const reason =
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'denied'
          : e.error === 'no-speech'
            ? 'no-speech'
            : e.error === 'aborted'
              ? 'aborted'
              : 'error'
      outcome = { ok: false, reason }
    }
    rec.onend = () => {
      if (active === rec) active = undefined
      const text = finalText.trim()
      resolve(
        text
          ? { ok: true, text }
          : (outcome ?? { ok: false, reason: 'no-speech' }),
      )
    }
    try {
      rec.start()
    } catch {
      resolve({ ok: false, reason: 'error' })
    }
  })
}

export function stopListening() {
  active?.stop()
}

export function abortListening() {
  active?.abort()
}
