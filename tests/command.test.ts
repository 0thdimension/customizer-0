import { expect, test } from 'claude-code/testing'
import { parseMod } from '../hooks/command'

const patchOf = (args: string) => {
  const action = parseMod(args)
  if (action.kind !== 'change') throw new Error(`"${args}" did not parse as a change: ${JSON.stringify(action)}`)
  return action.patch
}

const errorOf = (args: string) => {
  const action = parseMod(args)
  return action.kind === 'error' ? action.message : `no error for "${args}"`
}

test('/mod alone shows or hides the controls, and single words run their action', () => {
  expect(parseMod('')).toEqual({ kind: 'toggle' })
  for (const word of ['open', 'close', 'status', 'preview', 'help', 'reset'] as const) expect(parseMod(word)).toEqual({ kind: word })
})

test('every phrasing in the README parses', () => {
  expect(patchOf('creativity 8')).toEqual({ creativity: { value: 8 } })
  expect(patchOf('5 questions')).toEqual({ questions: { value: 5 } })
  expect(patchOf('questions 0')).toEqual({ questions: { value: 0 } })
  expect(patchOf('expertise vibe')).toEqual({ expertise: { value: 'vibe' } })
  expect(patchOf('recheck on')).toEqual({ recheck: { on: true } })
  expect(patchOf('off')).toEqual({ enabled: false })
  expect(patchOf('on')).toEqual({ enabled: true })
})

test('other phrasings and the names on the controls work too', () => {
  expect(patchOf('set creativity 3')).toEqual({ creativity: { value: 3 } })
  expect(patchOf('on safety')).toEqual({ safety: { on: true } })
  expect(patchOf('off painpoints')).toEqual({ painPoints: { on: false } })
  expect(patchOf('pain points off')).toEqual({ painPoints: { on: false } })
  expect(patchOf('possible issues on')).toEqual({ painPoints: { on: true } })
  expect(patchOf('possible safety issues off')).toEqual({ safety: { on: false } })
  expect(patchOf('recheck response on')).toEqual({ recheck: { on: true } })
  expect(patchOf('questions to ask 2')).toEqual({ questions: { value: 2 } })
  expect(patchOf('vibe coder')).toEqual({ expertise: { value: 'vibe' } })
  expect(patchOf('checks on')).toEqual({ recheck: { on: true }, painPoints: { on: true }, safety: { on: true } })
  expect(patchOf('scripted on')).toEqual({ headless: true })
  expect(patchOf('creativity 8 and recheck on')).toEqual({ creativity: { value: 8 }, recheck: { on: true } })
})

test('bad values and unknown words explain themselves', () => {
  expect(errorOf('questions 25')).toMatch(/0 to 20/)
  expect(errorOf('creativity eleven')).toMatch(/0 to 10/)
  expect(errorOf('expertise wizard')).toMatch(/vibe, novice, intermediate, expert/)
  expect(errorOf('recheck')).toMatch(/on or off/)
  expect(errorOf('banana on')).toMatch(/"banana" isn't something \/mod knows/)
})
