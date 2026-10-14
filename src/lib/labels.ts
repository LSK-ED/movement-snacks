import type { BodyArea, Equipment, ItemStatus, Severity } from '@/domain/types'

export const SEVERITY_LABELS: Record<Severity, string> = {
  0: 'None',
  1: 'Mild',
  2: 'Moderate',
  3: 'Severe',
}

const AREA_LABELS: Record<BodyArea, string> = {
  neck: 'Neck',
  shoulders: 'Shoulders',
  'upper-back': 'Upper back',
  'lower-back': 'Lower back',
  chest: 'Chest',
  arms: 'Arms',
  wrists: 'Wrists & hands',
  core: 'Core',
  'hip-flexors': 'Hips',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  knees: 'Knees',
  calves: 'Calves',
  ankles: 'Ankles & feet',
}

export const areaLabel = (a: BodyArea) => AREA_LABELS[a]

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  chair: 'Sturdy chair',
  wall: 'Wall / doorway',
  table: 'Sturdy desk or table',
  step: 'Step or low stair',
  band: 'Resistance band',
  dumbbells: 'Light dumbbells',
}

export const STATUS_LABELS: Record<ItemStatus, string> = {
  pending: 'Planned',
  completed: 'Done',
  partial: 'Partly done',
  skipped: 'Skipped',
  missed: 'Missed',
}
