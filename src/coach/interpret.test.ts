import { describe, expect, it } from 'vitest'
import { interpretUtterance as parse } from './interpret'

describe('interpretUtterance', () => {
  it('understands a typical spoken check-in', () => {
    const r = parse(
      'tight lower back, knees a bit sore, energy is about a three',
    )
    expect(r.stiffness).toEqual({ severity: 1, areas: ['lower-back'] })
    expect(r.pain).toEqual({ severity: 1, areas: ['knees'] })
    expect(r.energy).toBe(3)
  })

  it('handles severity words and homophones', () => {
    const r = parse('my shoulders are really stiff and energy is a for')
    expect(r.stiffness?.severity).toBe(3)
    expect(r.stiffness?.areas).toContain('shoulders')
    expect(r.energy).toBe(4)
  })

  it('handles negation', () => {
    const r = parse('no pain, no stiffness, feeling good')
    expect(r.pain?.severity).toBe(0)
    expect(r.stiffness?.severity).toBe(0)
  })

  it('flags red-flag symptoms', () => {
    expect(parse('I have a sharp pain in my knee').redFlags[0]).toMatchObject({
      kind: 'sharp-pain',
      area: 'knees',
    })
    expect(parse('feeling a bit dizzy').redFlags[0].kind).toBe('dizziness')
    expect(parse('my chest feels tight').redFlags[0].kind).toBe('chest-pain')
    expect(parse('chest is a bit sore from push ups').redFlags).toHaveLength(0)
  })

  it('recognises session commands', () => {
    expect(parse('done').commands).toEqual(['done'])
    expect(parse('this is too easy').commands).toEqual(['harder'])
    expect(parse('how many left').commands).toEqual(['how-many-left'])
    expect(parse('hang on').commands).toEqual(['pause'])
  })

  it('parses reps and effort', () => {
    expect(parse('I did twelve', 'reps').number).toBe(12)
    expect(parse('effort was about a seven').rpe).toBe(7)
    expect(parse('six out of ten').rpe).toBe(6)
  })

  it('parses plan change requests', () => {
    expect(parse('less lower body please').adjustments.lessAreas).toContain(
      'quads',
    )
    expect(parse('no jumping').adjustments.noJumping).toBe(true)
    expect(parse('I only have ten minutes').adjustments.maxMinutes).toBe(10)
  })
})
