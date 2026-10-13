import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAppState } from '@/state/app-state'
import {
  abortListening,
  listenOnce,
  speak,
  stopSpeaking,
  voiceSupport,
} from './engine'

// Voice as React state: what the mic is doing, what the coach said (captions),
// and who handles the next thing the person says or types.

export type MicState = 'idle' | 'listening' | 'thinking' | 'speaking'

export interface Caption {
  id: number
  who: 'coach' | 'you' | 'system'
  text: string
}

interface Handler {
  onText: (text: string) => void | Promise<void>
  /** Keep listening after each utterance in hands-free mode (session runner). */
  continuous?: boolean
}

interface VoiceApi {
  supported: typeof voiceSupport
  inputAvailable: boolean
  outputEnabled: boolean
  handsFree: boolean
  denied: boolean
  mic: MicState
  interim: string
  captions: Caption[]
  /** Latest coach line, for the caption bar. */
  lastCoachLine?: string
  say(
    text: string,
    opts?: { quiet?: boolean; noListen?: boolean },
  ): Promise<void>
  listen(): void
  submitText(text: string): void
  stopAll(): void
  setHandsFree(on: boolean): void
  register(handler: Handler): () => void
}

const Ctx = createContext<VoiceApi | null>(null)

export function VoiceProvider({ children }: { children: ReactNode }) {
  const { settings, updateSettings } = useAppState()
  const [mic, setMic] = useState<MicState>('idle')
  const [interim, setInterim] = useState('')
  const [captions, setCaptions] = useState<Caption[]>([])
  const [denied, setDenied] = useState(false)

  const inputAvailable = voiceSupport.input && settings.voiceInput && !denied
  const outputEnabled = voiceSupport.output && settings.voiceOutput

  // Refs so async loops always see current values.
  const handler = useRef<Handler | null>(null)
  const listening = useRef(false)
  const speaking = useRef(false)
  const cfg = useRef({
    inputAvailable,
    outputEnabled,
    handsFree: settings.handsFree,
    rate: settings.speechRate,
  })
  cfg.current = {
    inputAvailable,
    outputEnabled,
    handsFree: settings.handsFree,
    rate: settings.speechRate,
  }
  const nextId = useRef(1)
  const speechSeq = useRef(0)

  const addCaption = useCallback((who: Caption['who'], text: string) => {
    setCaptions((cs) => [...cs.slice(-60), { id: nextId.current++, who, text }])
  }, [])

  const handleText = useCallback(
    async (text: string) => {
      addCaption('you', text)
      setMic('thinking')
      await handler.current?.onText(text)
      setMic((m) => (m === 'thinking' ? 'idle' : m))
      if (
        cfg.current.handsFree &&
        handler.current?.continuous &&
        !speaking.current
      )
        startListening()
    },
    [addCaption],
  )

  const startListening = useCallback(async () => {
    if (!cfg.current.inputAvailable || listening.current || speaking.current)
      return
    listening.current = true
    setMic('listening')
    setInterim('')
    const res = await listenOnce(setInterim)
    listening.current = false
    setInterim('')
    if (res.ok) return void handleText(res.text)
    setMic((m) => (m === 'listening' ? 'idle' : m))
    if (res.reason === 'denied') {
      setDenied(true)
      addCaption(
        'system',
        'Microphone access was blocked, so I’ll use buttons and typing. You can allow the mic in your browser’s site settings.',
      )
    } else if (
      res.reason === 'no-speech' &&
      cfg.current.handsFree &&
      handler.current?.continuous
    ) {
      setTimeout(() => void startListening(), 250)
    }
  }, [handleText, addCaption])

  const maybeAutoListen = useCallback(() => {
    if (cfg.current.handsFree && handler.current) void startListening()
  }, [startListening])

  const say = useCallback<VoiceApi['say']>(
    async (text, opts = {}) => {
      if (!opts.quiet) addCaption('coach', text)
      if (!cfg.current.outputEnabled) {
        if (!opts.quiet && !opts.noListen) maybeAutoListen()
        return
      }
      // Stop listening so the recogniser doesn't hear the coach. Short counts
      // ("one", "two") are harmless and don't interrupt.
      if (!opts.quiet && listening.current) abortListening()
      const seq = ++speechSeq.current
      speaking.current = true
      if (!listening.current) setMic('speaking')
      await speak(text, cfg.current.rate)
      // A newer line interrupted this one — let that one own the state.
      if (seq !== speechSeq.current) return
      speaking.current = false
      setMic((m) => (m === 'speaking' ? 'idle' : m))
      if (!opts.quiet && !opts.noListen) maybeAutoListen()
    },
    [addCaption, maybeAutoListen],
  )

  const stopAll = useCallback(() => {
    stopSpeaking()
    abortListening()
    speaking.current = false
    setMic('idle')
  }, [])

  useEffect(() => stopAll, [stopAll])

  const register = useCallback((h: Handler) => {
    handler.current = h
    return () => {
      if (handler.current === h) handler.current = null
    }
  }, [])

  const api = useMemo<VoiceApi>(
    () => ({
      supported: voiceSupport,
      inputAvailable,
      outputEnabled,
      handsFree: settings.handsFree && inputAvailable,
      denied,
      mic,
      interim,
      captions,
      lastCoachLine: [...captions].reverse().find((c) => c.who !== 'you')?.text,
      say,
      listen: () => {
        if (listening.current) abortListening()
        else {
          stopSpeaking()
          speaking.current = false
          void startListening()
        }
      },
      submitText: (text) => void handleText(text),
      stopAll,
      setHandsFree: (on) => updateSettings({ handsFree: on }),
      register,
    }),
    [
      inputAvailable,
      outputEnabled,
      settings.handsFree,
      denied,
      mic,
      interim,
      captions,
      say,
      startListening,
      handleText,
      stopAll,
      updateSettings,
      register,
    ],
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useVoice(): VoiceApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useVoice must be used inside VoiceProvider')
  return ctx
}

/** Route spoken or typed input to this component while it's mounted. */
export function useVoiceHandler(
  onText: Handler['onText'],
  opts: { continuous?: boolean } = {},
) {
  const { register } = useVoice()
  const ref = useRef(onText)
  ref.current = onText
  useEffect(
    () =>
      register({ onText: (t) => ref.current(t), continuous: opts.continuous }),
    [register, opts.continuous],
  )
}
