import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useAppState } from '@/state/app-state'

export function DisclaimerText() {
  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      <p>
        Movement Snacks gives general fitness guidance, not medical advice. It
        doesn’t diagnose anything. If you have a health condition, an injury, or
        you’re unsure whether exercise is right for you, check with a doctor or
        physiotherapist first.
      </p>
      <p>
        Stop if you feel sharp or worsening pain, dizziness, chest pain or
        unusual breathlessness, and seek medical advice. In an emergency, call
        your local emergency number.
      </p>
    </div>
  )
}

/** First-run: the disclaimer, plus an offer to load demo history. */
export function DisclaimerDialog() {
  const app = useAppState()
  const [demo, setDemo] = useState(true)
  const open = !app.settings.disclaimerAccepted
  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Welcome to Movement Snacks</DialogTitle>
          <DialogDescription>
            Your coach for short movement breaks through the working day.
          </DialogDescription>
        </DialogHeader>
        <DisclaimerText />
        <div className="flex items-center gap-2">
          <Checkbox
            id="first-demo"
            checked={demo}
            onCheckedChange={(c) => setDemo(c === true)}
          />
          <Label htmlFor="first-demo" className="font-normal">
            Load a week of demo history (you can clear it in Settings)
          </Label>
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              if (demo) app.setDemoData(true)
              app.updateSettings({ disclaimerAccepted: true, demoData: demo })
            }}
          >
            I understand — let’s start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
