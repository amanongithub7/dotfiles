/**
 * Headless smoke test for the browser half.
 *
 * The panel cannot be rendered from a shell, so this stubs the module loader, a
 * small React and fetch, then exercises what would otherwise only fail in the
 * page: the slot registrations, the icon, a render of the chat list, one submit
 * through the composer's contenteditable, and a failed request.
 *
 *   node client-smoke.mjs
 */
import assert from 'node:assert/strict'

// ── a small React ───────────────────────────────────────────────────────────
const hookStore = new Map()
const ranEffects = new Set()
let hooks = []
let cursor = 0
let currentKey = ''
let pendingEffects = []
let dirty = false

const React = {
  createElement(type, props, ...children) {
    const node = {
      type,
      props: props ?? {},
      children: children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false),
    }
    if (node.props.ref !== undefined && node.props.ref !== null) node.props.ref.current = node
    return node
  },
  useState(initial) {
    const store = hooks
    const index = cursor
    cursor += 1
    if (!(index in store)) store[index] = typeof initial === 'function' ? initial() : initial
    return [store[index], (value) => {
      store[index] = typeof value === 'function' ? value(store[index]) : value
      dirty = true
    }]
  },
  useRef(initial) {
    const store = hooks
    const index = cursor
    cursor += 1
    if (!(index in store)) store[index] = { current: initial }
    return store[index]
  },
  useCallback(fn) {
    cursor += 1
    return fn
  },
  useEffect(fn) {
    const key = `${currentKey}|${cursor}`
    cursor += 1
    if (!ranEffects.has(key)) pendingEffects.push({ key, fn })
  },
}

// Host elements keep their identity across renders, the way real DOM nodes do,
// so a ref's element and anything written on it survive a state change.
const nodes = new Map()

function renderTree(node, key = 'root') {
  if (node === null || node === undefined || node === false) return null
  if (typeof node === 'string' || typeof node === 'number') return node
  if (Array.isArray(node)) return node.map((child, index) => renderTree(child, `${key}.${index}`))
  if (typeof node.type === 'function') {
    const componentKey = `${key}|${node.type.name || 'anonymous'}`
    const outerHooks = hooks
    const outerKey = currentKey
    hooks = hookStore.get(componentKey) ?? []
    cursor = 0
    currentKey = componentKey
    const rendered = node.type(node.props)
    hookStore.set(componentKey, hooks)
    hooks = outerHooks
    currentKey = outerKey
    return renderTree(rendered, `${componentKey}.out`)
  }
  const existing = nodes.get(key)
  const rendered = existing !== undefined && existing.type === node.type ? existing : { type: node.type, props: node.props, children: [] }
  rendered.props = node.props
  if (rendered.props.ref !== undefined && rendered.props.ref !== null) rendered.props.ref.current = rendered
  rendered.children = node.children.map((child, index) => renderTree(child, `${key}.${index}`))
  nodes.set(key, rendered)
  return rendered
}

let root = null
let factory = null

function renderOnce() {
  dirty = false
  pendingEffects = []
  root = renderTree(factory())
  const effects = pendingEffects
  pendingEffects = []
  for (const effect of effects) {
    ranEffects.add(effect.key)
    effect.fn()
  }
}

async function settle(rounds = 10) {
  for (let round = 0; round < rounds; round += 1) {
    await new Promise((resolve) => setImmediate(resolve))
    if (dirty) renderOnce()
  }
}

function findAll(node, predicate, found = []) {
  if (node === null || typeof node !== 'object') return found
  if (node.type !== undefined && predicate(node)) found.push(node)
  for (const child of node.children ?? []) findAll(child, predicate, found)
  return found
}

function allText(node, collected = []) {
  if (typeof node === 'string' || typeof node === 'number') {
    collected.push(String(node))
    return collected
  }
  if (node === null || typeof node !== 'object') return collected
  for (const child of node.children ?? []) allText(child, collected)
  return collected
}

// ── the page's environment ──────────────────────────────────────────────────
let captured = null
globalThis.window = { __ModuleLoader__: { load: (entry) => { captured = entry } } }

const calls = []
const json = (value, status = 200) => ({ ok: status < 400, status, json: async () => value })
let askStatus = 200

globalThis.fetch = async (url, options = {}) => {
  const body = typeof options.body === 'string' ? JSON.parse(options.body) : null
  calls.push({ url: String(url), method: options.method ?? 'GET', body })
  const target = String(url)
  if (target.endsWith('/status')) return json({ ok: true, dataDir: '/tmp/x', chats: 1, llm: { available: true }, tavily: { command: 'tvly', path: '/Users/x/.local/bin/tvly' }, web: true })
  if (target.endsWith('/list')) return json({ chats: [{ id: 'c1', title: 'CMIP6 scenarios', updatedAt: Date.now(), messages: 2 }] })
  if (target.endsWith('/ask') && askStatus !== 200) return json({ error: 'unauthorized' }, askStatus)
  if (target.endsWith('/ask')) {
    return json({
      chat: {
        id: 'c1',
        title: 'CMIP6 scenarios',
        messages: [
          { id: 'm1', role: 'user', at: Date.now(), text: body.prompt },
          { id: 'm2', role: 'assistant', at: Date.now(), text: 'Forty scenarios across five SSPs.', provider: 'paratera', model: 'DeepSeek-V4.1-Flash', sources: [{ title: 'A source', url: 'https://example.test/a' }] },
        ],
      },
      summary: { id: 'c1', title: 'CMIP6 scenarios', updatedAt: Date.now(), messages: 2 },
      search: null,
      failure: null,
    })
  }
  return json({})
}

globalThis.FileReader = class {
  readAsDataURL() {
    this.result = 'data:text/plain;base64,aGk='
    this.onload()
  }
}
globalThis.URL.createObjectURL = () => 'blob:test'

// ── load and register ───────────────────────────────────────────────────────
const requireStub = (id) => {
  if (id === 'react') return React
  throw new Error(`unexpected import: ${id}`)
}

await import('./client.js')
assert.ok(captured !== null, 'the module loader receives the bundle')
assert.equal(captured.id, '@aman/dsh-chat')

const plugin = captured.factory(requireStub)
assert.deepEqual(plugin.inject, ['slots'], 'the half declares the slots service')

const slots = []
plugin.apply({
  get: () => undefined,
  effect: () => {},
  slots: {
    inject: (owner, callback) => callback(),
    register: (options, Component) => slots.push({ options, Component }),
  },
})

assert.equal(slots.length, 2, 'the half claims the icon and the page')
assert.deepEqual(slots[0].options, { name: 'sidebar.panellist', id: 'chat', order: 20, label: 'Chat' })
assert.deepEqual(slots[1].options, { name: 'main', key: 'chat' })

const icon = renderTree(React.createElement(slots[0].Component, { size: 22, active: true }))
assert.equal(icon.props.width, 22, 'the icon honours the requested size')
assert.match(String(icon.props.stroke), /brand-primary/, 'the active icon uses the brand token')

// ── the panel renders the chat list ─────────────────────────────────────────
factory = slots[1].Component
renderOnce()
await settle()

assert.deepEqual(
  calls.filter((call) => call.method === 'GET').map((call) => call.url.replace('/api/aman-chat', '')),
  ['/list', '/status'],
  'the panel loads the history and the host status on mount',
)
assert.match(allText(root).join(' '), /CMIP6 scenarios/, 'a previous chat is listed')

// ── one submit through the composer ─────────────────────────────────────────
const editors = findAll(root, (node) => node.props.contentEditable === true)
assert.equal(editors.length, 1, 'the composer has one contenteditable')
editors[0].props.ref.current.innerText = 'What are the SSP scenarios?'
const forms = findAll(root, (node) => node.type === 'form')
assert.equal(forms.length, 1)
forms[0].props.onSubmit({ preventDefault() {} })
await settle()

const ask = calls.filter((call) => call.url.endsWith('/ask'))
assert.equal(ask.length, 1, 'submitting posts exactly once')
assert.deepEqual(ask[0].body, { id: null, prompt: 'What are the SSP scenarios?', web: true, files: [] })
const rendered = allText(root).join(' ')
assert.match(rendered, /Forty scenarios across five SSPs\./, 'the reply is added to the thread')
assert.match(rendered, /A source/, 'the sources are listed under the reply')
assert.equal(editors[0].props.ref.current.innerText, '', 'the composer is cleared by the send')

// ── a failed request is reported, not swallowed ─────────────────────────────
askStatus = 401
editors[0].props.ref.current.innerText = 'again'
forms[0].props.onSubmit({ preventDefault() {} })
await settle()
assert.match(allText(root).join(' '), /Request failed: unauthorized/, 'a rejected request is reported')

console.log('client.js smoke test passed: registrations, icon, list render, submit, failure path')
