import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Wordmark } from '@/components/brand/mark'
import { CoachBar } from '@/components/organisms/coach-bar'
import { DisclaimerDialog } from '@/components/organisms/disclaimer-dialog'
import { HistoryPage } from '@/components/pages/history-page'
import { SettingsPage } from '@/components/pages/settings-page'
import { TodayPage } from '@/components/pages/today-page'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useReminders } from '@/hooks/use-reminders'
import { AppStateProvider } from '@/state/app-state'
import { VoiceProvider, useVoice } from '@/voice/voice-provider'

function Shell() {
  const voice = useVoice()
  const [tab, setTab] = useState('today')
  const [running, setRunning] = useState(false)
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark'),
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light')
    } catch {
      // Storage unavailable — theme just won't persist.
    }
  }, [dark])

  useReminders((text) => {
    if (!running) void voice.say(text, { noListen: true })
  })

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <Tabs
        value={tab}
        onValueChange={setTab}
        className="flex flex-1 flex-col gap-0"
      >
        <header className="border-b">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <Wordmark />
            <div className="flex items-center gap-2">
              <TabsList aria-label="Sections">
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="history" disabled={running}>
                  History
                </TabsTrigger>
                <TabsTrigger value="settings" disabled={running}>
                  Settings
                </TabsTrigger>
              </TabsList>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDark((d) => !d)}
                aria-label={
                  dark ? 'Switch to light theme' : 'Switch to dark theme'
                }
              >
                {dark ? <Sun /> : <Moon />}
              </Button>
            </div>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          <TabsContent value="today" forceMount hidden={tab !== 'today'}>
            <TodayPage onRunningChange={setRunning} />
          </TabsContent>
          <TabsContent value="history">
            <HistoryPage />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsPage />
          </TabsContent>
        </main>
      </Tabs>
      <CoachBar />
      <DisclaimerDialog />
    </div>
  )
}

export default function App() {
  return (
    <AppStateProvider>
      <VoiceProvider>
        <Shell />
      </VoiceProvider>
    </AppStateProvider>
  )
}
