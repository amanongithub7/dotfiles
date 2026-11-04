/**
 * Headless smoke test for the browser half.
 *
 * The panel cannot be rendered from a shell, so this stubs the module loader,
 * React and fetch, then exercises the three things that would otherwise only
 * fail in the page: the slot registrations, one render, and one submit.
 *
 *   node smoke.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./client.js', import.meta.url), 'utf8')

let loaded
const window = { __ModuleLoader__: { load(entry) { loaded = entry } } }

// A stateful-enough React: hooks keep their value between renders of the same
// component, and createElement returns a plain tree this test can walk.
const states = []
let cursor = 0
let effects = []
const h = (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat() })
const React = {
  createElement: h,
  useState(initial) {
    const index = cursor++
    if (index >= states.length) states[index] = typeof initial === 'function' ? initial() : initial
    return [states[index], (next) => { states[index] = typeof next === 'function' ? next(states[index]) : next }]
  },
  useEffect(effect) { effects.push(effect) },
  useRef() { return { current: null } },
  useCallback(fn) { return fn },
}
const requireStub = (id) => {
  assert.equal(id, 'react', `the browser half must not require(${id})`)
  return React
}

new Function('window', 'require', source)(window, requireStub)
assert.equal(loaded?.id, '@aman/dsh-chat', 'the loader id must be the package name')

const plugin = loaded.factory(requireStub)
assert.deepEqual(plugin.inject, ['slots'], 'the plugin injects slots')

const registrations = []
const owners = []
plugin.apply({
  slots: {
    inject(owner, register) { owners.push(owner); registrations.push(register()) },
    register(options, component) { return { options, component } },
  },
})

const find = (node, predicate) => {
  if (!node || typeof node !== 'object') return undefined
  if (predicate(node)) return node
  for (const child of node.children ?? []) {
    const hit = find(child, predicate)
    if (hit) return hit
  }
  return undefined
}
const collectText = (node) => {
  if (node === null || node === undefined || node === false) return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(collectText).join('')
  return collectText(node.children)
}

const render = (component, props = {}) => { cursor = 0; return component(props) }
// onSubmit hands the work to `void submit()`, so the test must let the promise
// chain drain before reading the state it produced.
const settle = () => new Promise((resolve) => setImmediate(resolve))

// --- registrations -----------------------------------------------------------
assert.deepEqual(owners, ['sidebar.panellist', 'main'], 'both slots are claimed through inject')
const panellist = registrations[0]
const main = registrations[1]
assert.equal(panellist.options.name, 'sidebar.panellist')
assert.equal(panellist.options.id, 'chat', 'the sidebar entry id addresses the main panel')
assert.equal(panellist.options.label, 'Chat')
assert.equal(main.options.name, 'main')
assert.equal(main.options.key, 'chat', 'the main panel answers the sidebar id')

// --- icon --------------------------------------------------------------------
const icon = render(panellist.component, { size: 20, active: true })
assert.equal(icon.props.width, 20, 'the icon honours the requested size')
assert.equal(icon.props.height, 20)

// --- render ------------------------------------------------------------------
let tree = render(main.component)
const textarea = find(tree, (node) => node.type === 'textarea')
const form = find(tree, (node) => node.type === 'form')
assert.ok(textarea, 'the panel renders a prompt box')
assert.ok(form, 'the panel renders a form')
assert.match(collectText(tree), /no agent, no tools, no loop/, 'the empty state explains itself')

// --- one submit --------------------------------------------------------------
const posted = []
globalThis.fetch = async (url, init) => {
  posted.push({ url, init })
  return {
    ok: true,
    status: 200,
    json: async () => ({ text: 'Hello from the provider.', provider: 'paratera', model: 'DeepSeek-V4.1-Flash' }),
  }
}

textarea.props.onChange({ target: { value: '  say hi  ' } })
tree = render(main.component)
find(tree, (node) => node.type === 'form').props.onSubmit({ preventDefault() {} })
await settle()

assert.equal(posted.length, 1, 'one request per submit')
assert.equal(posted[0].url, '/api/aman-chat/ask', 'the request goes to the registered route')
assert.equal(posted[0].init.method, 'POST')
assert.deepEqual(JSON.parse(posted[0].init.body), { prompt: 'say hi' }, 'the prompt is trimmed and sent alone')

tree = render(main.component)
const body = collectText(tree)
assert.match(body, /say hi/, 'the prompt is kept in the log')
assert.match(body, /Hello from the provider\./, 'the reply is appended')
assert.match(body, /paratera\/DeepSeek-V4\.1-Flash/, 'the reply names its target')
assert.doesNotMatch(body, /Waiting for the provider/, 'the pending row is replaced')

// --- a failing route ---------------------------------------------------------
globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) })
textarea.props.onChange({ target: { value: 'again' } })
tree = render(main.component)
find(tree, (node) => node.type === 'form').props.onSubmit({ preventDefault() {} })
await settle()
assert.match(collectText(render(main.component)), /Request failed \(401\): unauthorized/, 'a rejection is reported, not swallowed')

console.log('client.js smoke test passed: registrations, render, submit, failure path')
