import { rulesCoach, type Coach } from './coach'

// Swap this for another `Coach` implementation (see the note in coach.ts).
export const coach: Coach = rulesCoach

export * from './coach'
export type { Interpretation, SessionCommand, Expect } from './interpret'
