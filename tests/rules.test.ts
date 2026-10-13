import { expect, test } from 'claude-code/testing'
import { editedFile, hasRecheck, isClarifyingQuestion, missingChecks } from '../hooks/checks'
import { compactLine, fullBlock, offNotice, preview, statusLine, stopReason } from '../hooks/rules'
import { applyPatch, defaults, normalize } from '../hooks/settings'

test('nothing switched on means nothing is sent', () => {
  const s = defaults()
  expect(fullBlock(s)).toBeNull()
  expect(compactLine(s)).toBeNull()
  expect(preview(s)).toMatch(/Every setting is off/)
  expect(preview({ ...s, enabled: false })).toMatch(/Customizer 0 is off/)
  expect(fullBlock(s, { changed: true })).toMatch(/every Customizer 0 rule is now off/)
})

test('every setting adds its rule', () => {
  const s = applyPatch(defaults(), {
    creativity: { value: 8 },
    questions: { value: 6 },
    expertise: { value: 'vibe' },
    recheck: { on: true },
    painPoints: { on: true },
    safety: { on: true },
  })
  const block = fullBlock(s) ?? ''
  expect(block).toStartWith('Customizer 0 is on.')
  for (const piece of [
    'Creativity 8/10 (Bold)',
    'ask the user 6 clarifying questions',
    'ask in batches',
    'Audience (vibe coder)',
    'whatever its kind',
    'At the end of every reply, however short',
    '`◆ recheck ✓ · facts checked, 1 fix`',
    '"Possible issues"',
    '"Possible safety issues"',
  ]) {
    expect(block).toContain(piece)
  }
})

test('zero questions, the one-line reminder, the change header, and the off notice', () => {
  const s = applyPatch(defaults(), { questions: { value: 0 }, recheck: { on: true } })
  expect(fullBlock(s)).toMatch(/don't ask any/)
  expect(compactLine(s)).toBe(
    'Customizer 0 is still on with the same settings: no clarifying questions; end every reply with a recheck. Follow the full Customizer 0 rules from earlier in this session.',
  )
  expect(fullBlock(s, { changed: true })).toStartWith('Customizer 0 settings changed.')
  expect(offNotice()).toMatch(/switched off/)
})

test('the status line says what is on, and nothing when nothing is', () => {
  expect(statusLine(defaults())).toBeUndefined()
  const s = applyPatch(defaults(), { creativity: { value: 3 }, questions: { value: 0 }, expertise: { value: 'vibe' }, recheck: { on: true } })
  expect(statusLine(s)).toBe('Customizer 0 · creativity 3 · no questions · vibe coder · checks: recheck response')
  expect(statusLine({ ...s, enabled: false })).toBeUndefined()
})

test('no combination produces undefined, null, or NaN text', () => {
  const levels = ['vibe', 'novice', 'intermediate', 'expert']
  for (let i = 0; i < 400; i++) {
    const r = (n: number) => Math.floor(Math.random() * n)
    const coin = () => Math.random() < 0.5
    const s = normalize({
      creativity: { on: coin(), value: r(11) },
      questions: { on: coin(), value: r(21) },
      expertise: { on: coin(), value: levels[r(4)] },
      painPoints: { on: coin() },
      safety: { on: coin() },
      recheck: { on: coin() },
    })
    for (const out of [fullBlock(s), compactLine(s), fullBlock(s, { changed: true }), statusLine(s)]) {
      if (out) expect(/undefined|null|NaN|\[object/.test(out), out).toBe(false)
    }
  }
})

test('the Stop reason names the files and only the missing checks', () => {
  const reason = stopReason(['recheck', 'safety'], ['C:\\a\\server.js', '/b/panel.css', '/c/1.js', '/d/2.js', '/e/3.js'])
  expect(reason).toContain('server.js, panel.css, 1.js, 2.js, and 1 more')
  expect(reason).toContain('Possible safety issues')
  expect(reason).not.toContain('Possible issues')
  const noFiles = stopReason(['recheck'])
  expect(noFiles).toContain('recheck your response: re-read it, check that it answers what was asked')
  expect(noFiles).not.toContain('files you changed')
})

test('a recheck line counts only on its own line, outside code blocks', () => {
  expect(hasRecheck('All set.\n`◆ recheck ✓ · 3 files reviewed`')).toBe(true)
  expect(hasRecheck('- ◆ recheck ✓ done')).toBe(true)
  expect(hasRecheck('I will write `◆ recheck ✓` when done.')).toBe(false)
  expect(hasRecheck('```\n◆ recheck ✓\n```')).toBe(false)
  expect(hasRecheck('')).toBe(false)
})

test('the missing checks are read from the final message, and edits name their file', () => {
  const s = applyPatch(defaults(), { recheck: { on: true }, painPoints: { on: true }, safety: { on: true } })
  expect(missingChecks(s, 'Done!')).toEqual(['recheck', 'painPoints', 'safety'])
  expect(missingChecks(s, '`◆ recheck ✓ · 1 file`\n\n**Possible issues**\n- x\n\n**Possible safety issues**\n- none')).toEqual([])
  expect(missingChecks(s, '`◆ recheck ✓ · 1 file`\n\n**Possible pain points**\n- x\n\n**Possible safety issues**\n- none'), 'the old section name still counts').toEqual([])
  expect(missingChecks(s, '`◆ recheck ✓ · 1 file`\n\n**Possible safety issues**\n- none'), 'the safety section alone is not the issues section').toEqual(['painPoints'])
  expect(isClarifyingQuestion('Which page do you mean, the home page or a sim page?')).toBe(true)
  expect(isClarifyingQuestion(`${'A full answer. '.repeat(50)}Want me to draft it?`), 'a long answer that ends with an offer is a reply').toBe(false)
  expect(isClarifyingQuestion('Done.')).toBe(false)
  expect(editedFile({ tool: 'Edit', file_path: '/a.js' })).toBe('/a.js')
  expect(editedFile({ tool: 'NotebookEdit', notebook_path: '/n.ipynb' })).toBe('/n.ipynb')
  expect(editedFile({ tool: 'Write' })).toBeUndefined()
})
