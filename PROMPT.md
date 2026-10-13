# \# Build brief: a voice-first personal trainer for "movement snacks"

#

# Working title: \*\*Movement Snacks\*\* (rename if you have a better idea).

#

# \## 1. What this is

#

# A personal movement coach for one person (me) who works at a desk most of the day. It reminds me to move, plans short "movement snacks" through the day, runs me through them, and learns from how I feel before and after. It should behave like a knowledgeable, warm, no-nonsense personal trainer with a solid grounding in exercise physiology, not like a generic habit tracker.

#

# This is a proof of concept running locally on my laptop. Build on the existing starter project (React, Vite, TypeScript, Tailwind, shadcn/ui) and follow `CLAUDE.md` and `DESIGN.md` for structure and styling.

#

# \## 2. Voice first, with a text fallback

#

# The primary way I interact with the app is by \*\*voice\*\*. The coach speaks to me and I answer by speaking. Everything must also work by tapping/typing, because voice can fail.

#

# \- Use the browser's built-in Web Speech APIs (speech recognition for input, speech synthesis for output). Feature-detect them and degrade gracefully to text and buttons if they are unavailable or microphone permission is denied.

# \- Include a clear microphone control with listening / thinking / speaking states. Offer both hands-free mode and tap-to-talk.

# \- During a session the coach should count reps aloud, announce rest and next exercise, and listen for simple commands: "done", "skip", "repeat", "easier", "harder", "pause", "stop", "how many left".

# \- After I speak, show what the app understood and let me correct it quickly. Voice recognition for numbers and body areas must be forgiving (for example "tight lower back", "knees a bit sore", "energy is about a three").

# \- If full voice input proves too complex for the first pass, build the full experience with voice \*\*output\*\* plus button/text input first, structure the code so voice input slots in cleanly, and tell me clearly in your summary what is and isn't voice-enabled.

# \- Add a note in settings that browser speech recognition may send audio to the browser vendor's cloud service, and let me turn voice input off.

#

# \## 3. The daily check-in

#

# At the start of each day, either at \*\*9:00 am\*\* or \*\*the first time I open the app that day\*\* (whichever comes first), the coach greets me and asks how I'm feeling:

#

# \- \*\*Muscle pain\*\* (none to severe), with which body areas

# \- \*\*Stiffness\*\* (none to severe), with which body areas

# \- \*\*Energy\*\* (low to high)

# \- Optionally: sleep quality and how much time I have today (one quick question, skippable)

#

# Capture this quickly, ideally under 30 seconds by voice, and store it as that day's baseline. A browser app cannot reliably fire notifications when closed, so: trigger the check-in on first open, and use the Notification API for the 9 am prompt and mid-day reminders while the app (or installed PWA) is running. Document that limitation in the README rather than hiding it.

#

# \## 4. Planning the day

#

# After the check-in, the coach proposes a plan for the day and explains its reasoning in plain language, briefly.

#

# \- \*\*Movement snacks:\*\* typically 4 to 6 short bouts (1 to 3 minutes each) spread through the working day, using no or minimal equipment (bodyweight, optionally a chair, wall, light dumbbells or a resistance band). Schedule them with sensible gaps and let me shift, swap or skip any of them.

# \- \*\*One longer session (optional):\*\* a \*\*10 to 15 minute\*\* session, either a \*\*weights session\*\* or a \*\*higher-intensity cardio session\*\* (for example intervals). Offer it only when today's check-in and recent history make it sensible. Otherwise say why not and offer a lighter alternative.

# \- I can accept the plan, ask for changes ("less lower body", "I only have ten minutes", "no jumping") and the coach re-plans.

#

# \### Planning rules (encode these as explicit, readable logic, not hidden magic)

#

# Put the coaching rules in one well-organised module so I can read and change them. They should reflect mainstream exercise physiology and be conservative:

#

# \- Take \*\*yesterday's movement into account\*\*: what was planned versus completed, the muscle groups worked, the intensity, and how I reported feeling afterwards. Avoid training the same muscle groups hard on consecutive days. Account for delayed onset muscle soreness, which typically peaks 24 to 72 hours after unaccustomed effort.

# \- Space out high-intensity cardio (for example, not on back-to-back days) and don't schedule it when energy is low or soreness/stiffness is high.

# \- On low-energy or high-soreness days, bias towards mobility, gentle movement, walking and light activation. Don't just skip the day: a small win still counts.

# \- Use effort ratings (RPE, 1 to 10) for intensity, plan a short warm-up before harder work, and progress load or reps gradually (small increments, not jumps) when recent sessions were completed comfortably. Back off if I report poor recovery.

# \- Counter prolonged sitting: vary posture and body regions across the day (hips, upper back/thoracic spine, neck/shoulders, calves/ankles, glutes).

# \- If I report sharp or worsening pain, dizziness, chest pain, or anything that sounds like more than normal muscle soreness, the coach stops suggesting exercise for that area, advises me to stop and seek appropriate medical advice, and does not diagnose.

# \- The app gives general fitness guidance, not medical advice. Include a short, unobtrusive disclaimer on first run and in settings.

#

# \## 5. The coach's persona and knowledge

#

# \- Warm, encouraging, direct and practical. A good personal trainer: gives clear cues, explains the "why" in one or two sentences, never shames, and celebrates consistency over perfection.

# \- Knowledgeable about exercise physiology: muscle groups and movement patterns, warm-up and recovery, soreness versus pain, progressive overload, interval structure and heart-rate/RPE intensity, and the evidence for breaking up sedentary time with short activity bouts.

# \- Keep speech short and natural. Don't lecture mid-session.

# \- Build the coach behind a clean interface (for example `getPlan(context)`, `getCue(exercise)`, `interpretUtterance(text)`) with a \*\*rules-based implementation first\*\* that works fully offline. Make it possible to swap in a language-model-backed implementation later. \*\*Do not put any API keys or secrets in the browser code.\*\* If a model is added later it must sit behind a small local server/proxy. Leave this as a documented extension point, not something to build now.

#

# \## 6. Running sessions and tracking

#

# For every snack or longer session:

#

# \- Show and speak the exercise, a one-line cue, and the target (reps or time). Provide a visible timer and rep counter.

# \- Let me log \*\*reps completed\*\* (by voice or tap), and mark the session \*\*completed, partial or skipped\*\*.

# \- Afterwards the coach does a \*\*short check-in\*\*: how do you feel now (energy, any pain or stiffness changes, perceived effort 1 to 10), with one optional free-text or voice note.

# \- Store all of this against the exercise, the muscle groups, and the day.

#

# \## 7. Day-by-day history and app usage

#

# \- Track, \*\*per day\*\*: the morning check-in, the planned versus completed sessions, reps, post-session feelings, and \*\*whether and when I opened or used the app\*\* (first open, number of sessions, last interaction).

# \- Provide a simple daily view and a rolling 7- and 30-day view showing completion, movement minutes, and trends in energy, stiffness and soreness. Keep visuals simple and readable.

# \- Streaks must be gentle: show consistency without guilt, and never penalise a missed day.

# \- Show the coach's "yesterday recap" at the start of each day, which also feeds directly into the plan.

#

# \## 8. Exercise library

#

# Create a typed data file of roughly 25 to 40 exercises, each with: name, short voice-friendly cue, primary and secondary muscle groups, movement pattern, intensity (low/moderate/high), equipment (none by default), time or rep guidance, an easier and a harder variation, and cautions. Include a mix suited to desk workers: mobility and stretches (hip flexors, thoracic extension, neck and shoulders, calves), activation (glute bridges, wall slides), bodyweight strength (sit-to-stands, wall or incline push-ups, split squats, rows with a band or table, planks), and short cardio options (marching, step-ups, low-impact intervals). Settings should let me say which equipment I have and exclude any exercise or body area.

#

# \## 9. Data, privacy and storage

#

# \- Everything stays \*\*on my device\*\*. Store data in the browser (IndexedDB or localStorage) behind a small storage module so it can be swapped later. No accounts, no analytics, no third-party calls other than the browser's own speech services.

# \- Provide \*\*export\*\* (JSON or CSV) and \*\*delete all data\*\* in settings.

# \- Seed a clearly labelled \*\*demo history\*\* (about a week of plausible data) behind a toggle so the app shows something meaningful on first run. It must be easy to clear.

#

# \## 10. Technical and quality requirements

#

# \- Use the existing stack and conventions in the repo. Respect the lint, formatting and file-size rules, and the atoms, molecules, organisms structure. Use shadcn/ui components and the design tokens in `DESIGN.md`.

# \- TypeScript throughout, with strict typing for the data model (check-in, plan, session, exercise, log entry).

# \- Mobile-friendly layout, even though I'll mostly use a laptop. Accessible by keyboard and screen reader, with good contrast and visible focus states. Provide captions or text for everything the coach says.

# \- Add unit tests for the planning rules (at minimum: sore day versus fresh day, consecutive-day muscle group avoidance, high-intensity spacing, low-energy fallback, injury red-flag handling) and for storage.

# \- Keep it simple and readable. Prefer a few well-named modules over clever abstractions.

#

# \## 11. Suggested build order

#

# 1\. Data model, storage module, exercise library and the rules-based planner, with tests.

# 2\. Daily check-in and plan screens (text and buttons) with the yesterday recap.

# 3\. Session runner with timer, rep logging and post-session check-in.

# 4\. History and trends views.

# 5\. Voice output, then voice input and commands, with feature detection and fallbacks.

# 6\. Notifications, settings, export/delete, demo data toggle, README.

#

# \## 12. Out of scope for now

#

# User accounts, cloud sync, wearables or heart-rate integrations, social features, payments, a native mobile app, and any language-model integration (leave a documented extension point only).

#

# \## 13. How to work

#

# Make sensible decisions rather than stopping to ask. At the end, give me a short summary covering what you built, what works by voice versus by tap/typing, any assumptions you made, browser limitations (notifications, speech recognition), and how to run and test it. Where something is a judgement call about exercise or safety, choose the conservative option and note it.
