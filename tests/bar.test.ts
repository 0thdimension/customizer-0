import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { COMPOSER, PRESENTATION, world } from './world'

const BAND = (hasSurvey = false) => ({
  plugin: 'customizer-0',
  component: 'AbovePrompt' as const,
  props: { hasSurvey, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 11 }, view: {} },
})

const mod = async ($: Engine, args: string) => (await $.command.run({ command: 'mod', args, origin: COMPOSER, presentation: PRESENTATION })).text ?? ''

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the controls stay hidden until /mod, then change every setting on the ${surface}`, async ($, on) => {
    world(on)
    const ui = await $.ui.mount({ ...BAND(), surface })
    expect(await ui.find({ type: 'Text', text: 'Customizer 0' }), 'hidden until asked').toBeUndefined()

    await mod($, '')
    expect(await ui.find({ type: 'Text', text: 'Customizer 0' })).toBeDefined()

    await ui.select({ key: 'creativity', value: '8' })
    await ui.select({ key: 'questions', value: '0' })
    await ui.select({ key: 'expertise', value: 'vibe' })
    await ui.press({ key: 'check-recheck' })
    let s = await mod($, 'status')
    expect(s).toMatch(/Creativity\s+on\s+8\/10 Bold/)
    expect(s).toMatch(/Questions to ask\s+on\s+0/)
    expect(s).toMatch(/Coding expertise\s+on\s+Vibe coder/)
    expect(s).toMatch(/Recheck response\s+on/)
    expect((await ui.find({ key: 'check-recheck' }))?.text).toBe('☑ Recheck response')
    expect((await ui.find({ key: 'check-painPoints' }))?.text).toBe('☐ Possible issues')
    expect((await ui.find({ key: 'check-safety' }))?.text).toBe('☐ Possible safety issues')
    expect((await ui.find({ key: 'questions' }))?.props.label).toBe('Questions to ask: ')
    expect((await ui.find({ key: 'creativity' }))?.props.value).toBe('8')

    await ui.select({ key: 'creativity', value: 'off' })
    expect(await mod($, 'status')).toMatch(/Creativity\s+off/)
    expect((await ui.find({ key: 'creativity' }))?.props.value).toBe('off')

    await ui.press({ key: 'master' })
    expect((await ui.find({ key: 'master' }))?.text).toBe('Turn on')
    expect(await mod($, 'status')).toMatch(/Customizer 0 is OFF/)
    await ui.press({ key: 'master' })

    await ui.press({ key: 'reset' })
    expect((await ui.find({ key: 'reset' }))?.text).toBe('Confirm reset')
    await ui.press({ key: 'reset' })
    s = await mod($, 'status')
    for (const line of [/Creativity\s+off/, /Questions to ask\s+off/, /Coding expertise\s+off/, /Recheck response\s+off/]) expect(s).toMatch(line)

    await ui.press({ key: 'close' })
    expect(await ui.find({ type: 'Text', text: 'Customizer 0' }), 'Close hides them').toBeUndefined()
    await ui.unmount()
  })
}

test('the controls step aside while a survey holds the band', async ($, on) => {
  world(on)
  await mod($, 'open')
  const ui = await $.ui.mount({ ...BAND(true), surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Customizer 0' })).toBeUndefined()
})

test('the status line follows the settings', async ($, on) => {
  const w = world(on, { settings: { creativity: { on: true, value: 3 } } })
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  expect(w.statuses.at(-1)).toBe('Customizer 0 · creativity 3')
  await mod($, 'checks on')
  expect(w.statuses.at(-1)).toBe('Customizer 0 · creativity 3 · checks: recheck response, possible issues, possible safety issues')
  await mod($, 'off')
  expect(w.statuses.at(-1)).toBeUndefined()
})
