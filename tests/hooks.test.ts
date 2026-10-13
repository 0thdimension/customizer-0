import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { COMPOSER, PRESENTATION, world } from './world'

const CHECKS_ON = { recheck: { on: true }, painPoints: { on: true }, safety: { on: true } }

const submit = ($: Engine, text = 'hi') => $.prompt.submit({ text, wait: false, origin: COMPOSER })
const mod = async ($: Engine, args: string) => (await $.command.run({ command: 'mod', args, origin: COMPOSER, presentation: PRESENTATION })).text ?? ''
const rulesBlock = async ($: Engine) => (await $.prompt.context({ blocks: [] })).blocks.find((b) => b.name === 'customizer-0')?.text
const edit = ($: Engine, file: string, agentId?: string) =>
  $.tool.call({ tool: 'Edit', tool_use_id: `t-${file}`, file_path: file, old_string: 'a', new_string: 'b', ...(agentId ? { agentId } : {}) })

test('session start registers /mod', async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  expect(w.registered).toEqual(['mod'])
})

test("the desktop menu's /customizer-0:mod is answered by the module too, without a Claude turn", async ($, on) => {
  world(on, { settings: { creativity: { on: true, value: 3 } } })
  const ran = await $.command.run({ command: 'customizer-0:mod', args: 'status', origin: COMPOSER, presentation: PRESENTATION })
  expect(ran.text).toMatch(/Creativity\s+on\s+3\/10 Measured/)
})

test('the first message carries the full rules and later prompts a one-line reminder', async ($, on) => {
  world(on, { settings: { creativity: { on: true, value: 7 } } })
  expect((await submit($)).context, 'the first prompt leaves the rules to the first message').toBeUndefined()
  expect(await rulesBlock($)).toStartWith('Customizer 0 is on.')
  const second = await submit($, 'again')
  expect(second.context).toEqual([expect.stringMatching(/^Customizer 0 is still on with the same settings: creativity 7\/10 \(Inventive\)/)])
})

test('a change resends the rules, and switching off sends one notice, then nothing', async ($, on) => {
  world(on, { settings: { creativity: { on: true, value: 7 } } })
  await submit($)
  await rulesBlock($)
  expect(await mod($, 'creativity 9')).toContain('Creativity: 9/10, Daring.')
  const changed = (await submit($)).context?.[0] ?? ''
  expect(changed).toStartWith('Customizer 0 settings changed.')
  expect(changed).toContain('Creativity 9/10 (Daring)')
  await mod($, 'off')
  expect((await submit($)).context?.[0]).toMatch(/switched off/)
  expect((await submit($)).context).toBeUndefined()
  await mod($, 'on')
  expect((await submit($)).context?.[0]).toStartWith('Customizer 0 is on.')
})

test('nothing switched on sends nothing', async ($, on) => {
  world(on)
  expect(await rulesBlock($)).toBeUndefined()
  expect((await submit($)).context).toBeUndefined()
})

test('scripted runs are left alone', async ($, on) => {
  world(on, { settings: { creativity: { on: true, value: 7 } }, env: { CLAUDE_CODE_ENTRYPOINT: 'sdk-cli' } })
  expect(await rulesBlock($)).toBeUndefined()
})

test('scripted runs get the rules once the user includes them', async ($, on) => {
  world(on, { settings: { creativity: { on: true, value: 7 }, headless: true }, env: { CLAUDE_CODE_ENTRYPOINT: 'sdk-cli' } })
  expect(await rulesBlock($)).toStartWith('Customizer 0 is on.')
})

test('the desktop app is not a scripted run', async ($, on) => {
  world(on, { settings: { creativity: { on: true, value: 7 } }, env: { CLAUDE_CODE_ENTRYPOINT: 'claude-desktop' } })
  expect(await rulesBlock($)).toStartWith('Customizer 0 is on.')
})

test('a resumed conversation gets the rules once, from its start-of-chat context', async ($, on) => {
  world(on, { settings: { creativity: { on: true, value: 7 } } })
  const resumed = await $.classic.SessionStart({ source: 'resume', session_id: 'conv-1' })
  expect(resumed.additionalContext, 'the resume itself adds nothing').toBeUndefined()
  expect(await rulesBlock($)).toStartWith('Customizer 0 is on.')
  expect((await submit($)).context?.[0]).toMatch(/^Customizer 0 is still on/)
})

test('a resumed conversation still gets the rules from its next prompt if the start-of-chat context never comes', async ($, on) => {
  world(on, { settings: { creativity: { on: true, value: 7 } } })
  await $.classic.SessionStart({ source: 'resume', session_id: 'conv-1' })
  expect((await submit($)).context?.[0]).toStartWith('Customizer 0 is on.')
})

test('resuming a conversation that had rules, with the mod now off, carries the off notice', async ($, on) => {
  world(on, { settings: { creativity: { on: true, value: 7 } } })
  await submit($)
  await rulesBlock($)
  await mod($, 'off')
  const resumed = await $.classic.SessionStart({ source: 'resume', session_id: 'conv-1' })
  expect(resumed.additionalContext?.[0]).toMatch(/switched off/)
})

test('/clear starts over: the next prompt is a first prompt again', async ($, on) => {
  world(on, { settings: { creativity: { on: true, value: 7 } } })
  await submit($)
  await rulesBlock($)
  expect((await submit($)).context).toHaveLength(1)
  await $.classic.SessionStart({ source: 'clear' })
  expect((await submit($)).context).toBeUndefined()
})

test('finish checks send Claude back once when it changed files and skipped them', async ($, on) => {
  world(on, { settings: CHECKS_ON })
  await submit($)
  await edit($, 'C:\\proj\\app.js')
  const stop = await $.classic.Stop({ stop_hook_active: false, last_assistant_message: 'Done!' })
  expect(stop.block).toContain('recheck your response')
  expect(stop.block).toContain('app.js')
  expect(stop.block).toContain('"Possible issues"')
  expect(stop.block).toContain('"Possible safety issues"')
  const second = await $.classic.Stop({ stop_hook_active: true, last_assistant_message: 'Done!' })
  expect(second.block, 'never twice in a row').toBeUndefined()
  const good = '`◆ recheck ✓ · 1 file reviewed`\n\n**Possible issues**\n- x\n\n**Possible safety issues**\n- none found'
  expect((await $.classic.Stop({ stop_hook_active: false, last_assistant_message: good })).block).toBeUndefined()
})

test('every reply gets the finish checks, even a plain answer with no files changed', async ($, on) => {
  world(on, { settings: CHECKS_ON })
  await submit($, 'How should I share the site with other teachers?')
  const stop = await $.classic.Stop({ stop_hook_active: false, last_assistant_message: 'Post it in teacher groups and newsletters.' })
  expect(stop.block).toContain('recheck your response: re-read it, check that it answers what was asked')
  expect(stop.block).toContain('"Possible issues"')
  expect(stop.block).toContain('"Possible safety issues"')
})

test('a message that only asks the user a question is not sent back', async ($, on) => {
  world(on, { settings: CHECKS_ON })
  await submit($)
  expect((await $.classic.Stop({ stop_hook_active: false, last_assistant_message: 'Which audience do you mean, students or teachers?' })).block).toBeUndefined()
})

test("the reason names only this turn's own edits, not an earlier turn's or a subagent's", async ($, on) => {
  world(on, { settings: CHECKS_ON })
  await submit($)
  await edit($, '/old.js')
  await submit($, 'a new task')
  await edit($, '/sub.js', 'agent-1')
  await edit($, '/mine.js')
  const block = (await $.classic.Stop({ stop_hook_active: false, last_assistant_message: 'Answer.' })).block ?? ''
  expect(block).toContain('mine.js')
  expect(block).not.toContain('old.js')
  expect(block).not.toContain('sub.js')
})

test('finish checks stay quiet when they are off', async ($, on) => {
  world(on)
  await submit($)
  await edit($, '/a.js')
  expect((await $.classic.Stop({ stop_hook_active: false, last_assistant_message: 'Done.' })).block).toBeUndefined()
})

test('a fresh install starts with every setting off', async ($, on) => {
  world(on)
  const status = await mod($, 'status')
  for (const line of [/Customizer 0 is ON/, /Creativity\s+off/, /Questions to ask\s+off/, /Recheck response\s+off/]) expect(status).toMatch(line)
})

test('/mod shows and hides the controls, changes settings, and explains mistakes', async ($, on) => {
  const w = world(on)
  expect(await mod($, '')).toBe("Customizer 0's controls are above the chat box.")
  expect(await mod($, '')).toBe("Closed Customizer 0's controls.")
  expect(await mod($, '5 questions')).toBe('Questions to ask: 5. Claude gets the new settings with your next message.')
  await mod($, 'expertise vibe')
  expect(await mod($, 'recheck response on')).toMatch(/^Recheck response: on\./)
  expect(await mod($, 'possible issues on')).toMatch(/^Possible issues: on\./)
  expect(await mod($, 'possible safety issues on')).toMatch(/^Possible safety issues: on\./)
  const status = await mod($, 'status')
  expect(status).toMatch(/Questions to ask\s+on\s+5/)
  expect(status).toMatch(/Coding expertise\s+on\s+Vibe coder/)
  for (const line of [/Recheck response\s+on/, /Possible issues\s+on/, /Possible safety issues\s+on/]) expect(status).toMatch(line)
  expect(w.statuses.at(-1)).toBe('Customizer 0 · 5 questions · vibe coder · checks: recheck response, possible issues, possible safety issues')
  expect(await mod($, 'preview')).toContain('Audience (vibe coder)')
  expect(await mod($, 'questions 25')).toMatch(/0 to 20.*\/mod help/)
  await mod($, 'reset')
  expect(await mod($, 'preview')).toMatch(/Every setting is off/)
  expect(w.statuses.at(-1), 'the status line goes away when nothing is on').toBeUndefined()
})
