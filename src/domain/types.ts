// The data model. Everything stored or passed between the coach and the UI is
// typed here so the shapes stay in one place.

/** A calendar day in local time, formatted YYYY-MM-DD. */
export type DateKey = string

/** Muscle groups and joints. Used both for "what an exercise works" and "where it hurts". */
export const BODY_AREAS = [
  'neck',
  'shoulders',
  'upper-back',
  'lower-back',
  'chest',
  'arms',
  'wrists',
  'core',
  'hip-flexors',
  'glutes',
  'quads',
  'hamstrings',
  'knees',
  'calves',
  'ankles',
] as const
export type BodyArea = (typeof BODY_AREAS)[number]

/** 0 none · 1 mild · 2 moderate · 3 severe */
export type Severity = 0 | 1 | 2 | 3
/** 1 low … 5 high */
export type Level = 1 | 2 | 3 | 4 | 5

export type Intensity = 'low' | 'moderate' | 'high'
export type Category = 'mobility' | 'activation' | 'strength' | 'cardio'
export type Pattern =
  | 'mobility'
  | 'stretch'
  | 'activation'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'push'
  | 'pull'
  | 'core'
  | 'cardio'

export const EQUIPMENT = [
  'chair',
  'wall',
  'table',
  'step',
  'band',
  'dumbbells',
] as const
export type Equipment = (typeof EQUIPMENT)[number]

export type Dose =
  | { kind: 'reps'; reps: number; perSide?: boolean }
  | { kind: 'time'; seconds: number; perSide?: boolean }

export interface Exercise {
  id: string
  name: string
  /** One short sentence the coach can say aloud. */
  cue: string
  primary: BodyArea[]
  secondary: BodyArea[]
  pattern: Pattern
  category: Category
  intensity: Intensity
  /** Empty means bodyweight only. Every item listed is required. */
  equipment: Equipment[]
  dose: Dose
  easier: string
  harder: string
  cautions: string
  /** Involves jumping or impact — excluded by "no jumping". */
  impact?: boolean
}

export type RedFlagKind =
  | 'sharp-pain'
  | 'worsening-pain'
  | 'dizziness'
  | 'chest-pain'
  | 'numbness'
  | 'swelling'

export interface RedFlag {
  kind: RedFlagKind
  area?: BodyArea
  /** What the person said, kept for the record. */
  text: string
}

export type TimeAvailable = 'little' | 'some' | 'plenty'

export interface CheckIn {
  date: DateKey
  at: string
  pain: Severity
  painAreas: BodyArea[]
  stiffness: Severity
  stiffAreas: BodyArea[]
  energy: Level
  sleep?: Level
  timeAvailable?: TimeAvailable
  redFlags: RedFlag[]
  note?: string
}

export type Variation = 'easier' | 'standard' | 'harder'

export interface PlannedExercise {
  exerciseId: string
  dose: Dose
  role: 'warmup' | 'main' | 'cooldown'
  /** Target effort on the 1–10 RPE scale. */
  rpe: number
  /** For intervals: rounds of work/rest. */
  rounds?: number
  restSeconds?: number
}

export type ItemStatus = 'pending' | 'completed' | 'partial' | 'skipped'

export interface PlannedItem {
  id: string
  kind: 'snack' | 'session'
  title: string
  /** HH:MM, local. */
  time: string
  focus: BodyArea[]
  category: Category | 'mixed'
  intensity: Intensity
  minutes: number
  exercises: PlannedExercise[]
  status: ItemStatus
  /** One-line "why" for this item. */
  why: string
}

export interface PlanAdjustments {
  lessAreas: BodyArea[]
  noJumping: boolean
  maxMinutes?: number
  noLongSession: boolean
  moreIntensity?: boolean
}

export interface Plan {
  date: DateKey
  createdAt: string
  accepted: boolean
  /** Short, plain-language reasons. The first is the headline. */
  reasoning: string[]
  items: PlannedItem[]
  longSession: { offered: boolean; note: string }
  adjustments: PlanAdjustments
  /** Set when a red flag means the coach is not suggesting exercise. */
  safetyStop?: string
}

export interface ExerciseLog {
  exerciseId: string
  primary: BodyArea[]
  intensity: Intensity
  variation: Variation
  target: Dose
  repsDone?: number
  secondsDone?: number
  status: 'done' | 'skipped'
}

export type Change = 'better' | 'same' | 'worse'

export interface PostCheck {
  energy: Level
  painChange: Change
  stiffnessChange: Change
  rpe: number
  note?: string
  redFlags: RedFlag[]
}

export interface SessionLog {
  id: string
  date: DateKey
  itemId: string
  kind: PlannedItem['kind']
  category: PlannedItem['category']
  startedAt: string
  endedAt: string
  durationSec: number
  status: Exclude<ItemStatus, 'pending'>
  exercises: ExerciseLog[]
  post?: PostCheck
}

export interface Usage {
  firstOpen: string
  lastInteraction: string
  opens: number
  sessionsStarted: number
}

export interface DayRecord {
  date: DateKey
  checkIn?: CheckIn
  plan?: Plan
  sessions: SessionLog[]
  usage?: Usage
  /** Seeded demo data — removed by "clear demo history". */
  demo?: boolean
}

export interface Settings {
  equipment: Equipment[]
  excludedExercises: string[]
  excludedAreas: BodyArea[]
  voiceOutput: boolean
  voiceInput: boolean
  handsFree: boolean
  speechRate: number
  notifications: boolean
  dayStart: string
  dayEnd: string
  disclaimerAccepted: boolean
  demoData: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  equipment: ['chair', 'wall', 'table'],
  excludedExercises: [],
  excludedAreas: [],
  voiceOutput: true,
  voiceInput: true,
  handsFree: false,
  speechRate: 1,
  notifications: false,
  dayStart: '09:00',
  dayEnd: '17:30',
  disclaimerAccepted: false,
  demoData: false,
}
