# Movement Snacks

A voice-first personal movement coach for desk days. It checks in each morning,
plans 4–6 short "movement snacks" (plus an optional 10–15 minute session when it
makes sense), runs you through them by voice, and learns from how you feel
before and after.

Runs entirely in the browser. No accounts, no analytics, no servers.

> **General fitness guidance, not medical advice.** The app never diagnoses.
> If you report sharp or worsening pain, dizziness, chest pain, numbness or
> swelling, it stops suggesting exercise for that area (or entirely) and tells
> you to seek appropriate advice.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # planner, interpreter and storage tests (vitest)
npm run build    # type-check + production build
```

Use **Chrome or Edge** for voice input. Other browsers get voice output and
text/buttons.

## How it works

| Step       | What happens                                                                                                                                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First open | Disclaimer, and an optional week of **demo history** (labelled, removable in Settings).                                                                                                                                                |
| Morning    | Yesterday's recap and a check-in covering soreness, stiffness (each with body areas), energy, and optionally sleep, time and warning signs. Say it in one go, e.g. "tight lower back, knees a bit sore, energy about a three", or tap. |
| Plan       | The coach explains its reasoning. Shift, swap or skip any item, or ask for a change ("less lower body", "no jumping", "I only have ten minutes", "skip the long session").                                                             |
| Session    | Spoken exercise, cue and target, a visible timer or rep counter, and reps counted aloud. Commands: _done, skip, repeat, easier, harder, pause, resume, stop, how many left_. You can also say a count: "I did twelve, done".           |
| After      | Effort (RPE 1–10), energy, soreness and stiffness changes, and a note. All of it feeds tomorrow's plan.                                                                                                                                |
| History    | 7- and 30-day trends (days moved, minutes, completion, energy, soreness, stiffness) and a day-by-day log including app usage. Consistency is shown without streaks, so a missed day is never a penalty.                                |

## Voice: what works how

| Feature                                            | Voice | Tap / type  |
| -------------------------------------------------- | :---: | :---------: |
| Coach speech (greeting, recap, plan, cues, counts) |  ✅   | captions ✅ |
| Morning check-in                                   |  ✅   |     ✅      |
| Plan changes and accept ("yes")                    |  ✅   |     ✅      |
| Session commands and rep counts                    |  ✅   |     ✅      |
| Post-session check-in                              |  ✅   |     ✅      |
| Shift / swap / skip items, settings, history       |   —   |     ✅      |

- **Tap-to-talk:** the mic button in the coach bar. **Hands-free:** a switch in
  the coach bar. In hands-free mode the app listens after every question, and
  keeps listening for commands throughout a session.
- After each utterance, a **"Heard / Understood"** chip shows how it was
  interpreted. Correct it with the controls or tap Undo.
- Everything typed into the coach bar goes through the same interpreter as
  speech, so the whole app can be driven without a microphone.
- If speech recognition is unsupported, turned off, or the mic is blocked, the
  mic button disables itself with an explanation, and buttons and typing keep
  working.

## Browser limitations (honest list)

- **Notifications only fire while the app is open** in a tab, even a background
  one. A plain web page cannot wake itself up once closed, and there is no
  service worker or push server here. When the tab is visible, the coach says
  the reminder instead of sending a notification.
- The **9 am check-in** is triggered by whichever comes first: opening the app
  that day, or 9:00 while it's open.
- **Speech recognition privacy:** Chrome and Edge send microphone audio to the
  vendor's cloud for transcription. This is stated in Settings, and voice input
  can be turned off there.
- Speech recognition stops after silence. Hands-free mode restarts it, so you
  may see the mic state flicker. Recognition pauses while the coach speaks, so
  it doesn't hear itself. Rep counts ("one", "two"…) are the exception, since
  they can't be mistaken for commands.
- Voice availability and quality vary by OS and browser.

## Code map

```
src/
  domain/types.ts        data model: check-in, plan, session, exercise, log entry, settings
  data/exercises.ts      the exercise library (38 exercises)
  data/demo.ts           demo history, generated by running the real planner
  coach/
    rules.ts             ← the coaching rules: every safety/recovery/intensity decision
    planner.ts           turns the rules into a concrete, scheduled plan (+ swap)
    interpret.ts         forgiving text/speech interpreter (numbers, areas, severities, commands)
    coach.ts             the `Coach` interface + rules-based implementation (recap, wording)
    index.ts             picks the active coach implementation
  lib/storage.ts         storage module (key-value backend; localStorage by default)
  voice/                 Web Speech wrapper + React provider (captions, mic state, hands-free)
  hooks/                 session runner, plan editing, reminders
  components/            atoms → molecules → organisms → pages (shadcn/ui underneath)
```

### Changing the coaching rules

Everything lives in `src/coach/rules.ts`, and the numbers are in the `RULES`
object at the top. These are the conservative defaults chosen:

- No loading a muscle group worked hard **yesterday**. Hard work two days ago
  plus soreness today is treated as **DOMS**, so only gentle movement for those
  areas.
- High-intensity intervals are never on consecutive days (`hiitMinDaysApart: 2`),
  at most **2 per week**, and only on a "good" day with no soreness or notable
  stiffness.
- **Low day** (energy ≤ 2, moderate+ soreness, severe stiffness, or feeling worse
  after yesterday): low-intensity movement only, doses × 0.75, no long session,
  and an optional easy walk is offered instead.
- **Progression:** +10% reps/time (max +2 reps) after a complete session at RPE
  ≤ 6. **Back-off:** −20% after RPE ≥ 8, a partial session, or feeling worse.
- **Red flags:** chest pain or dizziness means no exercise today. Sharp,
  worsening, numb or swollen areas are excluded entirely, and flags from
  post-session checks carry forward for 3 days. "Tight chest" counts as a red
  flag; "chest is sore after push-ups" does not.
- Any sore area gets no loading that day. Gentle mobility for it is still
  allowed.

### Swapping in a language-model coach (extension point, not built)

`src/coach/coach.ts` defines the `Coach` interface (`getPlan`, `replan`,
`swapItem`, `getCue`, `interpretUtterance`, recap and summaries). To add a model:

1. Run a **small local server/proxy** that holds the API key. **Never put keys
   in browser code.**
2. Implement `Coach` in e.g. `src/coach/llm-coach.ts`, calling that proxy.
3. Keep `getPlan` delegating to the rules planner, so safety decisions stay
   rule-based and testable. Let the model reword reasoning, cues and replies,
   and fall back to `interpretUtterance` when it can't parse something.
4. Switch the export in `src/coach/index.ts`.

### Storage

`createStore(backend)` in `src/lib/storage.ts` wraps a four-method key-value
backend. Swap `localStorageBackend()` for an IndexedDB one without touching the
UI. Keys are prefixed `ms:`. Settings has **Export JSON / CSV** and **Delete all
data**.
