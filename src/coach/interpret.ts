import type {
  BodyArea,
  Change,
  Level,
  PlanAdjustments,
  RedFlag,
  Severity,
  TimeAvailable,
} from '@/domain/types'

// Turns free text (typed, or from speech recognition) into structured meaning.
// Speech recognisers mishear, so matching is forgiving: number words and a few
// common homophones, plenty of body-area synonyms, and severity words.

export type SessionCommand =
  | 'done'
  | 'skip'
  | 'repeat'
  | 'easier'
  | 'harder'
  | 'pause'
  | 'resume'
  | 'stop'
  | 'how-many-left'

export type Expect = 'energy' | 'pain' | 'stiffness' | 'sleep' | 'rpe' | 'reps'

export interface Interpretation {
  text: string
  commands: SessionCommand[]
  energy?: Level
  pain?: { severity: Severity; areas: BodyArea[] }
  stiffness?: { severity: Severity; areas: BodyArea[] }
  sleep?: Level
  timeAvailable?: TimeAvailable
  rpe?: number
  number?: number
  painChange?: Change
  stiffnessChange?: Change
  redFlags: RedFlag[]
  yes?: boolean
  adjustments: Partial<PlanAdjustments>
  /** Human-readable list of what was understood, for the confirm chip. */
  summary: string[]
}

// ── Vocabulary ─────────────────────────────────────────────────────────────

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  none: 0,
  nil: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
}
/** Mishearings accepted only where a number is expected. */
const HOMOPHONES: Record<string, number> = {
  won: 1,
  to: 2,
  too: 2,
  tu: 2,
  free: 3,
  tree: 3,
  for: 4,
  fore: 4,
  fiver: 5,
  sex: 6,
  ate: 8,
  nein: 9,
  tin: 10,
}

const AREA_SYNONYMS: [RegExp, BodyArea[]][] = [
  [/\b(lower|low) back\b|\blumbar\b|\blower spine\b/, ['lower-back']],
  [
    /\b(upper|mid|middle) back\b|\bthoracic\b|\bbetween (my )?shoulder blades\b/,
    ['upper-back'],
  ],
  [/\bneck\b/, ['neck']],
  [/\bshoulders?\b|\btraps\b|\brotator cuff\b/, ['shoulders']],
  [/\bchest\b|\bpecs?\b/, ['chest']],
  [/\barms?\b|\bbiceps?\b|\btriceps?\b|\belbows?\b/, ['arms']],
  [/\bwrists?\b|\bhands?\b|\bforearms?\b/, ['wrists']],
  [/\bcore\b|\babs\b|\bstomach\b|\btummy\b|\bobliques\b/, ['core']],
  [/\bhip flexors?\b|\bhips?\b|\bgroin\b/, ['hip-flexors']],
  [
    /\bglutes?\b|\bgluts\b|\bbum\b|\bbutt\b|\bbottom\b|\bbackside\b/,
    ['glutes'],
  ],
  [/\bquads?\b|\bquadriceps\b|\bthighs?\b|\bfront of (my )?legs?\b/, ['quads']],
  [
    /\bham ?strings?\b|\bhammies\b|\bback of (my )?(legs?|thighs?)\b/,
    ['hamstrings'],
  ],
  [/\bknees?\b|\bknee's\b/, ['knees']],
  [/\bcal(f|ves)\b|\bcarves\b|\bshins?\b/, ['calves']],
  [/\bankles?\b|\bfeet\b|\bfoot\b|\bachilles\b/, ['ankles']],
  [/\blegs\b/, ['quads', 'hamstrings']],
]
// "back" on its own almost always means the lower back.
const BARE_BACK = /\b(my |the )?back\b/

const REGIONS: [RegExp, BodyArea[]][] = [
  [
    /\blower body\b|\blegs?\b/,
    ['quads', 'hamstrings', 'glutes', 'calves', 'knees', 'ankles'],
  ],
  [/\bupper body\b|\barms\b/, ['chest', 'shoulders', 'arms', 'upper-back']],
]

const PAIN_WORDS =
  /\b(sore|soreness|ache|aches|achy|aching|pain|painful|hurts?|hurting|tender|doms)\b/
const STIFF_WORDS = /\b(stiff|stiffness|tight|tightness|locked|rigid|creaky)\b/
const MILD =
  /\b(a bit|a little|bit|little|slightly|slight|mild|mildly|kind of|kinda|somewhat|touch)\b/
const MODERATE = /\b(quite|fairly|pretty|moderate|moderately|rather|properly)\b/
const SEVERE =
  /\b(very|really|super|severe|severely|extremely|badly|seriously|awful|terrible|killing)\b/
const NONE = /\b(no|not|nothing|zero|none|without)\b/

const RED_FLAGS: [RegExp, RedFlag['kind']][] = [
  [
    /\bchest (pain|hurts|pressure|is tight|tightness|feels tight)|\b(pain|tightness|pressure) in (my )?chest\b|\btight chest\b/,
    'chest-pain',
  ],
  [
    /\bdizzy\b|\bdizziness\b|\blight ?headed\b|\bfaint\b|\bvertigo\b|\bwoozy\b/,
    'dizziness',
  ],
  [
    /\bsharp\b|\bshooting\b|\bstabbing\b|\belectric\b|\bcan'?t put weight\b/,
    'sharp-pain',
  ],
  [
    /\bgetting worse\b|\bworsening\b|\bworse and worse\b|\bkeeps? getting worse\b/,
    'worsening-pain',
  ],
  [/\bnumb\b|\bnumbness\b|\btingl(e|ing|y)\b|\bpins and needles\b/, 'numbness'],
  [/\bswollen\b|\bswelling\b|\bpuffy\b/, 'swelling'],
]

const COMMANDS: [RegExp, SessionCommand][] = [
  [
    /\bhow (many|much|long) (more|left|to go)\b|\bwhat'?s left\b|\bremaining\b/,
    'how-many-left',
  ],
  [/\btoo hard\b|\beasier\b|\bmake it easy\b|\btone it down\b/, 'easier'],
  [/\btoo easy\b|\bharder\b|\bmake it hard\b|\bstep it up\b/, 'harder'],
  [
    /\b(un ?pause|resume|carry on|continue|keep going|i'?m ready|ready|let'?s go|go)\b/,
    'resume',
  ],
  [
    /\b(pause|hold on|hang on|wait|one sec(ond)?|give me a (sec|minute))\b/,
    'pause',
  ],
  [
    /\b(repeat|again|say that again|what was that|pardon|come again)\b/,
    'repeat',
  ],
  [/\b(skip|pass|next one|not this one|can'?t do (this|that))\b/, 'skip'],
  [/\b(stop|end (the )?session|quit|cancel|i'?m out)\b/, 'stop'],
  [/\b(done|finished|that'?s it|complete|completed|next)\b/, 'done'],
]

// ── Public API ─────────────────────────────────────────────────────────────

export function interpretUtterance(
  raw: string,
  expect?: Expect,
): Interpretation {
  const text = normalise(raw)
  const out: Interpretation = {
    text: raw,
    commands: [],
    redFlags: [],
    adjustments: {},
    summary: [],
  }

  for (const [re, cmd] of COMMANDS) {
    if (re.test(text) && !(cmd === 'resume' && out.commands.length))
      out.commands.push(cmd)
  }
  // "go" inside "let's go easier" etc. shouldn't also mean resume.
  if (out.commands.length > 1)
    out.commands = out.commands.filter((c) => c !== 'resume')

  out.redFlags = findRedFlags(text)
  parseBody(text, out)
  parseEnergy(text, out, expect)
  parseSleep(text, out, expect)
  parseTime(text, out)
  parseEffort(text, out, expect)
  parseChanges(text, out)
  parseAdjustments(text, out)

  if (
    /\b(yes|yeah|yep|yup|sure|ok|okay|sounds good|accept|do it|perfect|great|let'?s do it)\b/.test(
      text,
    )
  )
    out.yes = true
  else if (/^(no|nope|nah|not now|no thanks)\b/.test(text)) out.yes = false

  const num = firstNumber(text, !!expect)
  if (num !== undefined) out.number = num
  if (expect === 'reps' && num !== undefined) out.summary.push(`${num} reps`)

  describe(out)
  return out
}

// ── Parsers ────────────────────────────────────────────────────────────────

function normalise(s: string): string {
  const clean = s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[,.;!?]+/g, ' , ')
    .replace(/[^a-z0-9', ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return ` ${clean} `
}

function findRedFlags(text: string): RedFlag[] {
  const flags: RedFlag[] = []
  for (const clause of clauses(text)) {
    for (const [re, kind] of RED_FLAGS) {
      if (!re.test(clause)) continue
      const systemic = kind === 'chest-pain' || kind === 'dizziness'
      const areas = systemic ? [] : areasIn(clause)
      if (areas.length)
        areas.forEach((area) => flags.push({ kind, area, text: clause.trim() }))
      else flags.push({ kind, text: clause.trim() })
    }
  }
  return flags
}

/** Pain and stiffness by clause; each area goes to the nearest pain/stiffness word. */
function parseBody(text: string, out: Interpretation) {
  const pain = { severity: -1, areas: new Set<BodyArea>() }
  const stiff = { severity: -1, areas: new Set<BodyArea>() }

  if (
    /\bno (pain|soreness|aches?)\b|\bnot sore\b|\bnothing (hurts|sore)\b|\bpain (is )?(zero|none|nil)\b/.test(
      text,
    )
  )
    pain.severity = 0
  if (
    /\bno (stiffness|tightness)\b|\bnot stiff\b|\bnot tight\b|\bstiffness (is )?(zero|none|nil)\b/.test(
      text,
    )
  )
    stiff.severity = 0

  for (const clause of clauses(text)) {
    const tokens = clause.trim().split(' ')
    const painAt = indexOfMatch(tokens, PAIN_WORDS)
    const stiffAt = indexOfMatch(tokens, STIFF_WORDS)
    if (painAt < 0 && stiffAt < 0) continue
    const chestFlag = RED_FLAGS[0][0].test(clause)

    for (const { area, at } of areasWithPositions(clause)) {
      if (chestFlag && area === 'chest') continue
      const toPain =
        painAt >= 0 &&
        (stiffAt < 0 || Math.abs(at - painAt) <= Math.abs(at - stiffAt))
      ;(toPain ? pain : stiff).areas.add(area)
    }
    if (painAt >= 0 && !NONE.test(before(tokens, painAt, 2)))
      pain.severity = Math.max(
        pain.severity,
        severityNear(tokens, painAt, clause),
      )
    if (stiffAt >= 0 && !NONE.test(before(tokens, stiffAt, 2)))
      stiff.severity = Math.max(
        stiff.severity,
        severityNear(tokens, stiffAt, clause),
      )
  }

  if (pain.severity >= 0 || pain.areas.size)
    out.pain = {
      severity: Math.max(pain.areas.size ? 1 : 0, pain.severity) as Severity,
      areas: [...pain.areas],
    }
  if (stiff.severity >= 0 || stiff.areas.size)
    out.stiffness = {
      severity: Math.max(stiff.areas.size ? 1 : 0, stiff.severity) as Severity,
      areas: [...stiff.areas],
    }
}

function severityNear(tokens: string[], at: number, clause: string): Severity {
  const near = window(tokens, at, 4)
  const n = numberIn(near, true)
  if (n !== undefined) return toSeverity(n)
  for (const scope of [near, clause]) {
    if (SEVERE.test(scope)) return 3
    if (MODERATE.test(scope)) return 2
    if (MILD.test(scope)) return 1
  }
  return 1
}

function toSeverity(n: number): Severity {
  if (n <= 3) return n as Severity
  return Math.min(3, Math.round((n / 10) * 3)) as Severity
}

function parseEnergy(text: string, out: Interpretation, expect?: Expect) {
  const m = text.match(/\benergy\b(.{0,30})/)
  const scope = m ? m[1] : expect === 'energy' ? text : undefined
  if (scope === undefined) {
    if (/\b(exhausted|knackered|wiped|shattered|drained)\b/.test(text))
      out.energy = 1
    else if (/\b(tired|low energy|sluggish|flat)\b/.test(text)) out.energy = 2
    else if (
      /\b(full of beans|buzzing|raring to go|energised|energized)\b/.test(text)
    )
      out.energy = 5
    return
  }
  const n = numberIn(scope, true)
  if (n !== undefined) return void (out.energy = toLevel(n))
  if (
    /\b(very low|exhausted|knackered|wiped|shattered|drained|terrible|awful)\b/.test(
      scope,
    )
  )
    out.energy = 1
  else if (/\b(low|tired|meh|flat|sluggish|not great)\b/.test(scope))
    out.energy = 2
  else if (
    /\b(ok|okay|alright|medium|average|middling|fine|so so)\b/.test(scope)
  )
    out.energy = 3
  else if (/\b(very high|great|excellent|amazing|full)\b/.test(scope))
    out.energy = 5
  else if (/\b(good|high|decent|pretty good)\b/.test(scope)) out.energy = 4
}

function parseSleep(text: string, out: Interpretation, expect?: Expect) {
  const m = text.match(/\b(slept|sleep|night)\b(.{0,30})/)
  const scope = m ? m[2] : expect === 'sleep' ? text : undefined
  if (scope === undefined) return
  const n = numberIn(scope, true)
  if (n !== undefined) return void (out.sleep = toLevel(n))
  if (/\b(terribl[ey]|awful|barely|hardly)\b/.test(scope)) out.sleep = 1
  else if (/\b(badly|poor(ly)?|rough|bad|not great|not well)\b/.test(scope))
    out.sleep = 2
  else if (/\b(ok|okay|alright|fine|so so)\b/.test(scope)) out.sleep = 3
  else if (/\b(great|brilliant|amazing|like a log)\b/.test(scope)) out.sleep = 5
  else if (/\b(well|good)\b/.test(scope)) out.sleep = 4
}

function parseTime(text: string, out: Interpretation) {
  const mins = text.match(
    /\b(?:only|just|got|have|about)?\s?(?:have |got )?(\d+|[a-z]+) minutes?\b/,
  )
  if (mins) {
    const n = /^\d+$/.test(mins[1]) ? Number(mins[1]) : NUMBER_WORDS[mins[1]]
    if (n) {
      out.adjustments.maxMinutes = n
      out.timeAvailable = n < 20 ? 'little' : n < 45 ? 'some' : 'plenty'
    }
  }
  if (
    /\b(busy|slammed|back to back|not much time|short on time|little time|no time|hectic)\b/.test(
      text,
    )
  )
    out.timeAvailable = 'little'
  else if (
    /\b(plenty|lots of time|loads of time|quiet day|free day|wide open)\b/.test(
      text,
    )
  )
    out.timeAvailable = 'plenty'
  else if (
    !out.timeAvailable &&
    /\b(some time|normal day|usual|a bit of time)\b/.test(text)
  )
    out.timeAvailable = 'some'
}

function parseEffort(text: string, out: Interpretation, expect?: Expect) {
  const m = text.match(/\b(effort|rpe|exertion|rated?|rating)\b(.{0,25})/)
  const outOfTen = text.match(/\b(\d+|[a-z]+) out of ten\b/)
  let n: number | undefined
  if (outOfTen && !/\benergy\b/.test(text)) n = numberIn(outOfTen[1], true)
  else if (m) n = numberIn(m[2], true)
  else if (expect === 'rpe') n = numberIn(text, true)
  if (n !== undefined && n >= 1 && n <= 10) out.rpe = n
  else if (expect === 'rpe') {
    if (/\b(very easy|easy|light)\b/.test(text)) out.rpe = 3
    else if (/\b(moderate|ok|okay|medium)\b/.test(text)) out.rpe = 5
    else if (/\b(very hard|brutal|max|maximal)\b/.test(text)) out.rpe = 9
    else if (/\b(hard|tough|challenging)\b/.test(text)) out.rpe = 7
  }
}

function parseChanges(text: string, out: Interpretation) {
  const better =
    /\b(better|looser|less stiff|less sore|eased|easier now|relieved|good)\b/
  const worse = /\b(worse|more sore|hurts more|tighter|more stiff|aggravated)\b/
  const same = /\b(same|no change|no different|unchanged|similar)\b/
  const stiffy = /\b(stiff|tight|loose|looser|tighter)/
  const changeOf = (s: string): Change | undefined =>
    worse.test(s)
      ? 'worse'
      : better.test(s)
        ? 'better'
        : same.test(s)
          ? 'same'
          : undefined
  for (const clause of clauses(text)) {
    const c = changeOf(clause)
    if (!c) continue
    if (stiffy.test(clause)) out.stiffnessChange = c
    else if (PAIN_WORDS.test(clause)) out.painChange = c
    else {
      out.painChange ??= c
      out.stiffnessChange ??= c
    }
  }
}

function parseAdjustments(text: string, out: Interpretation) {
  const adj = out.adjustments
  const less = text.match(
    /\b(less|fewer|no|skip|avoid|easy on|go easy on|nothing for|rest)( the| my)? (.{0,25})/,
  )
  if (less) {
    const target = less[3]
    const areas = new Set<BodyArea>()
    for (const [re, as] of REGIONS)
      if (re.test(target)) as.forEach((a) => areas.add(a))
    if (!areas.size) areasIn(target).forEach((a) => areas.add(a))
    if (areas.size) adj.lessAreas = [...areas]
  }
  if (
    /\bno (jump(ing|s)?|impact|hopping)\b|\b(quiet|low impact|downstairs neighbou?rs?)\b/.test(
      text,
    )
  )
    adj.noJumping = true
  if (
    /\b(no|skip|drop|without)( the)? (long(er)? session|workout|weights|intervals|big session)\b/.test(
      text,
    )
  )
    adj.noLongSession = true
  if (
    /\b(push me|more intense|harder day|more intensity|challenge me)\b/.test(
      text,
    )
  )
    adj.moreIntensity = true
}

function describe(out: Interpretation) {
  const s = out.summary
  const sev = ['none', 'mild', 'moderate', 'severe']
  const areas = (as: BodyArea[]) =>
    as.length ? ` (${as.map((a) => a.replace('-', ' ')).join(', ')})` : ''
  if (out.pain)
    s.push(`Soreness ${sev[out.pain.severity]}${areas(out.pain.areas)}`)
  if (out.stiffness)
    s.push(
      `Stiffness ${sev[out.stiffness.severity]}${areas(out.stiffness.areas)}`,
    )
  if (out.energy) s.push(`Energy ${out.energy}/5`)
  if (out.sleep) s.push(`Sleep ${out.sleep}/5`)
  if (out.timeAvailable) s.push(`Time: ${out.timeAvailable}`)
  if (out.rpe) s.push(`Effort RPE ${out.rpe}`)
  if (out.painChange) s.push(`Soreness ${out.painChange}`)
  if (out.stiffnessChange && out.stiffnessChange !== out.painChange)
    s.push(`Stiffness ${out.stiffnessChange}`)
  if (out.adjustments.lessAreas)
    s.push(
      `Less ${out.adjustments.lessAreas.map((a) => a.replace('-', ' ')).join(', ')}`,
    )
  if (out.adjustments.noJumping) s.push('No jumping')
  if (out.adjustments.maxMinutes)
    s.push(`${out.adjustments.maxMinutes} minutes`)
  if (out.adjustments.noLongSession) s.push('No longer session')
  for (const f of out.redFlags)
    s.push(
      `⚠ ${f.kind.replace('-', ' ')}${f.area ? ` (${f.area.replace('-', ' ')})` : ''}`,
    )
  for (const c of out.commands) s.push(`“${c.replace(/-/g, ' ')}”`)
}

// ── Low-level helpers ──────────────────────────────────────────────────────

function clauses(text: string): string[] {
  return text
    .split(/ , | but | although | though | whereas | also | plus /)
    .map((c) => ` ${c.trim()} `)
    .filter((c) => c.trim())
}

function areasWithPositions(clause: string): { area: BodyArea; at: number }[] {
  const tokens = clause.trim().split(' ')
  const found: { area: BodyArea; at: number }[] = []
  let rest = clause
  for (const [re, areas] of AREA_SYNONYMS) {
    const m = rest.match(re)
    if (!m || m.index === undefined) continue
    const at = rest.slice(0, m.index).trim().split(' ').filter(Boolean).length
    areas.forEach((area) => found.push({ area, at }))
    rest = rest.replace(new RegExp(re.source, 'g'), (x) => '_'.repeat(x.length))
  }
  if (!found.some((f) => f.area === 'lower-back') && BARE_BACK.test(rest)) {
    const idx = tokens.indexOf('back')
    found.push({ area: 'lower-back', at: idx })
  }
  return found
}

export function areasIn(text: string): BodyArea[] {
  return [...new Set(areasWithPositions(` ${text} `).map((f) => f.area))]
}

function indexOfMatch(tokens: string[], re: RegExp): number {
  return tokens.findIndex((t) => re.test(` ${t} `))
}

function before(tokens: string[], at: number, size: number): string {
  return ` ${tokens.slice(Math.max(0, at - size), at).join(' ')} `
}

function window(tokens: string[], at: number, size: number): string {
  return ` ${tokens.slice(Math.max(0, at - size), at + size + 1).join(' ')} `
}

function numberIn(text: string, allowHomophones: boolean): number | undefined {
  return firstNumber(text, allowHomophones)
}

function firstNumber(
  text: string,
  allowHomophones: boolean,
): number | undefined {
  for (const t of text.trim().split(' ')) {
    if (/^\d+(\.\d+)?$/.test(t)) return Math.round(Number(t))
    if (t in NUMBER_WORDS && t !== 'none') return NUMBER_WORDS[t]
    if (allowHomophones && t in HOMOPHONES) return HOMOPHONES[t]
  }
  return undefined
}

function toLevel(n: number): Level {
  const v = n > 5 ? Math.round(n / 2) : n
  return Math.max(1, Math.min(5, v)) as Level
}
