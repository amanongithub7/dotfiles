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
import fs from 'node:fs/promises'

// ── a small React ───────────────────────────────────────────────────────────
const hookStore = new Map()
let hooks = []
let cursor = 0
let currentKey = ''
let pendingEffects = []
let dirty = false

function sameDeps(previous, next) {
  if (previous === undefined || next === undefined) return false
  if (previous.length !== next.length) return false
  return previous.every((value, index) => Object.is(value, next[index]))
}

const React = {
  createElement(type, props, ...children) {
    const flat = children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false)
    const node = {
      type,
      // React puts children on props as well as in the element; components that
      // read `props.children` need the same shape here.
      props: flat.length === 0 ? props ?? {} : { ...(props ?? {}), children: flat.length === 1 ? flat[0] : flat },
      children: flat,
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
  useEffect(fn, deps) {
    const store = hooks
    const index = cursor
    cursor += 1
    const previous = store[index]
    if (previous !== undefined && sameDeps(previous.deps, deps)) return
    const slot = { deps, cleanup: undefined }
    store[index] = slot
    pendingEffects.push({
      key: `${currentKey}|${index}`,
      run() {
        if (typeof previous?.cleanup === 'function') previous.cleanup()
        const cleanup = fn()
        slot.cleanup = typeof cleanup === 'function' ? cleanup : undefined
      },
    })
  },
}

// Host elements keep their identity across renders, the way real DOM nodes do,
// so a ref's element and anything written on it survive a state change.
const nodes = new Map()

function renderTree(node, key = 'root') {
  if (node === null || node === undefined || node === false) return null
  if (typeof node === 'string' || typeof node === 'number') return node
  if (Array.isArray(node)) return node.map((child, index) => renderTree(child, `${key}.${index}`))
  if (typeof node.type === 'function' && typeof node.type.prototype?.render === 'function') {
    // A class component, including an error boundary: render it, and on a throw
    // hand it `getDerivedStateFromError` the way React would.
    const componentKey = `${key}|${node.type.name || 'anonymous'}`
    const instance = new node.type(node.props)
    instance.props = node.props
    try {
      // The whole subtree renders inside the try: a boundary catches a child's
      // throw, not only its own render body.
      return renderTree(instance.render(), `${componentKey}.out`)
    } catch (error) {
      const derive = node.type.getDerivedStateFromError
      if (typeof derive !== 'function') throw error
      instance.state = { ...(instance.state ?? {}), ...derive(error) }
      instance.componentDidCatch?.(error)
      return renderTree(instance.render(), `${componentKey}.retry`)
    }
  }
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
  for (const effect of effects) effect.run()
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
// Lets a test hold the answer open and look at the panel while it waits.
let deferAsk = false
let releaseAsk = null
// The layout the host hands back on /status.
let statusUi = {}
// Whether the host half enables the sidebar shadow.
let sidebarFork = false

globalThis.fetch = async (url, options = {}) => {
  const body = typeof options.body === 'string' ? JSON.parse(options.body) : null
  calls.push({ url: String(url), method: options.method ?? 'GET', body })
  const target = String(url)
  if (target.endsWith('/status')) return json({ ok: true, dataDir: '/tmp/x', chats: 1, llm: { available: true }, tavily: { command: 'tvly', path: '/Users/x/.local/bin/tvly' }, web: true, sidebarFork, ui: statusUi })
  if (target.endsWith('/models')) {
    return json({
      providers: [
        { id: 'paratera', name: 'Paratera', models: [{ id: 'DeepSeek-V4.1-Flash', name: 'DeepSeek V4.1 Flash', image: false }, { id: 'GLM-5.3', name: 'GLM 5.3', image: false }] },
        { id: 'openrouter', name: 'OpenRouter', models: [{ id: 'vision-pro', name: 'Vision Pro', image: true }] },
      ],
      default: { provider: 'paratera', model: 'DeepSeek-V4.1-Flash' },
    })
  }
  if (target.endsWith('/search')) {
    return json({ matches: [{ id: 'c2', title: 'Sea ice trends', updatedAt: Date.now(), snippet: 'the phrase panel reply appears here' }] })
  }
  if (target.endsWith('/ui')) {
    statusUi = { ...statusUi, ...body }
    return json({ ui: statusUi })
  }
  if (target.endsWith('/list')) {
    return json({
      chats: [
        { id: 'c1', title: 'CMIP6 scenarios', updatedAt: Date.now(), messages: 2 },
        { id: 'c2', title: 'Sea ice trends', updatedAt: Date.now() - 3_600_000, messages: 4 },
      ],
    })
  }
  if (target.endsWith('/get')) {
    const title = body.id === 'c2' ? 'Sea ice trends' : 'CMIP6 scenarios'
    return json({
      chat: {
        id: body.id,
        title,
        messages: [
          { id: 'm1', role: 'user', at: Date.now(), text: 'Show me the trend' },
          {
            id: 'm2',
            role: 'assistant',
            at: Date.now(),
            provider: 'paratera',
            model: 'DeepSeek-V4.1-Flash',
            text: '## Findings\n\n- a **decline** of `12.2%` per decade\n- see [NSIDC](https://nsidc.test)\n\n```python\nprint(1)\n```',
          },
        ],
      },
    })
  }
  if (target.endsWith('/delete')) {
    return json({ chats: [{ id: 'c1', title: 'CMIP6 scenarios', updatedAt: Date.now(), messages: 2 }] })
  }
  if (target.endsWith('/ask') && askStatus !== 200) return json({ error: 'unauthorized' }, askStatus)
  if (target.endsWith('/ask')) {
    const payload = {
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
    }
    if (deferAsk === true) {
      deferAsk = false
      return new Promise((resolve) => {
        releaseAsk = () => resolve(json(payload))
      })
    }
    return json(payload)
  }
  return json({})
}

globalThis.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
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

assert.equal(slots.length, 3, 'the half claims the icon, the page and the settings row')
assert.deepEqual(slots[0].options, { name: 'sidebar.panellist', id: 'chat', order: 20, label: 'Chat' })
assert.deepEqual(slots[1].options, { name: 'main', key: 'chat' })
assert.equal(slots[2].options.name, 'settings.general.item', 'the fork switch lives in an additive settings seat')
assert.equal(slots[2].options.id, 'chat-sidebar-fork')

const icon = renderTree(React.createElement(slots[0].Component, { size: 22, active: true }))
assert.equal(icon.props.width, 22, 'the icon honours the requested size')
assert.match(String(icon.props.stroke), /brand-primary/, 'the active icon uses the brand token')

// ── the panel renders the chat list ─────────────────────────────────────────
factory = slots[1].Component
renderOnce()
await settle()

assert.deepEqual(
  calls.filter((call) => call.method === 'GET').map((call) => call.url.replace('/api/aman-chat', '')),
  ['/status', '/list', '/models', '/status'],
  'registering probes the fork flag, then the panel loads history, models and status',
)
assert.match(allText(root).join(' '), /CMIP6 scenarios/, 'a previous chat is listed')
assert.match(allText(root).join(' '), /Sea ice trends/, 'every previous chat is listed')
assert.equal(
  findAll(root, (node) => node.props.className === 'aman-chat-item').length,
  2,
  'one list row per chat',
)

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
assert.deepEqual(ask[0].body, {
  id: null,
  prompt: 'What are the SSP scenarios?',
  web: true,
  files: [],
  provider: 'paratera',
  model: 'DeepSeek-V4.1-Flash',
}, 'a turn states the route it runs on')
const rendered = allText(root).join(' ')
assert.match(rendered, /Forty scenarios across five SSPs\./, 'the reply is added to the thread')
assert.match(rendered, /A source/, 'the sources are listed under the reply')
assert.equal(calls.filter((call) => call.url.endsWith('/get')).length, 0, 'the chat the reply arrived in is not fetched again')
assert.equal(editors[0].props.ref.current.innerText, '', 'the composer is cleared by the send')

// ── the composer: a paperclip left of send, an atom on Search ───────────────
const actions = findAll(root, (node) => node.props.className === 'aman-chat-row-actions')
assert.equal(actions.length, 1, 'the composer has one action row')
assert.deepEqual(
  actions[0].children.map((child) => child.props.className),
  ['aman-chat-toggle', 'aman-chat-anchor', 'aman-chat-hidden', 'aman-chat-grow', 'aman-chat-add', 'aman-chat-primary'],
  'the model picker follows Search, and the paperclip sits directly left of send',
)
assert.equal(
  findAll(root, (node) => node.type === 'path' && String(node.props.d).startsWith('M21.44')).length,
  1,
  'the attach button draws a paperclip',
)

const switches = findAll(root, (node) => node.props.role === 'switch')
assert.equal(switches.length, 1, 'one search switch')
assert.equal(allText(switches[0]).join(''), 'Search', 'the toggle is labelled Search')
assert.equal(switches[0].props['aria-checked'], 'true', 'search grounding is on by default')
assert.equal(findAll(switches[0], (node) => node.props.className === 'aman-chat-dot').length, 0, 'the state dot is gone')
const orbits = findAll(switches[0], (node) => node.type === 'ellipse')
assert.equal(orbits.length, 2, 'the icon is two orbits')
assert.ok(orbits.some((node) => String(node.props.transform).includes('rotate(90')), 'the orbits are perpendicular')
assert.equal(findAll(switches[0], (node) => node.type === 'circle' && node.props.fill === 'currentColor').length, 1, 'and one filled nucleus')

// ── the model picker ───────────────────────────────────────────────────────
const modelButton = () => findAll(root, (node) => node.props.className === 'aman-chat-model')[0]
assert.ok(modelButton(), 'the composer carries a model picker')
assert.match(allText(modelButton()).join(''), /DeepSeek-V4\.1-Flash/, 'it shows the model in use')
modelButton().props.onClick()
await settle()
assert.equal(findAll(root, (node) => node.props.className === 'aman-chat-pop-item').length, 3, 'every catalogued model is offered')
assert.deepEqual(
  findAll(root, (node) => node.props.className === 'aman-chat-pop-label').map((node) => allText(node).join('')),
  ['Paratera', 'OpenRouter'],
  'models are grouped by provider',
)
findAll(root, (node) => node.props.className === 'aman-chat-pop-item')
  .find((node) => allText(node).join('') === 'GLM 5.3')
  .props.onClick()
await settle()
assert.match(allText(modelButton()).join(''), /GLM-5\.3/, 'choosing a model updates the composer')

// ── waiting shows animated dots, not a sentence ─────────────────────────────
deferAsk = true
editors[0].props.ref.current.innerText = 'is it thinking?'
forms[0].props.onSubmit({ preventDefault() {} })
await settle()
const pendingRows = findAll(root, (node) => node.props['data-pending'] === 'true')
assert.equal(pendingRows.length, 1, 'a pending assistant row appears while the provider works')
const dots = findAll(pendingRows[0], (node) => node.props.className === 'aman-chat-dots')
assert.equal(dots.length, 1, 'the pending row carries the dot indicator')
assert.equal(dots[0].children.length, 3, 'three dots')
assert.equal(dots[0].props.role, 'status', 'the indicator is announced as a live status')
assert.equal(dots[0].props['aria-label'], 'Waiting for the provider', 'the wording survives as the accessible label')
assert.equal(allText(root).join(' ').includes('Waiting for the provider'), false, 'the sentence is no longer rendered as text')
releaseAsk()
await settle()
assert.equal(findAll(root, (node) => node.props['data-pending'] === 'true').length, 0, 'the indicator goes when the reply lands')

// ── a failed request is reported, not swallowed ─────────────────────────────
askStatus = 401
editors[0].props.ref.current.innerText = 'again'
forms[0].props.onSubmit({ preventDefault() {} })
await settle()
assert.match(allText(root).join(' '), /Request failed: unauthorized/, 'a rejected request is reported')

// ── opening an earlier chat renders its markdown ────────────────────────────
const rows = findAll(root, (node) => node.props.className === 'aman-chat-item')
rows[1].props.onClick()
await settle()
const gets = calls.filter((call) => call.url.endsWith('/get'))
assert.equal(gets.length, 1, 'clicking a chat loads it once')
assert.deepEqual(gets[0].body, { id: 'c2' }, 'the clicked chat is the one requested')

const headings = findAll(root, (node) => node.type === 'h2')
assert.equal(allText(headings[0]).join(''), 'Findings', 'a markdown heading renders as a heading')
assert.equal(findAll(root, (node) => node.type === 'strong').length, 1, 'bold renders as strong, exactly once')
assert.equal(findAll(root, (node) => node.props.className === 'aman-chat-inline-code').length, 1, 'inline code is marked')
const links = findAll(root, (node) => node.type === 'a' && String(node.props.href).startsWith('https://nsidc.test'))
assert.equal(links.length, 1, 'a markdown link renders as an anchor')
assert.equal(allText(links[0]).join(''), 'NSIDC')
const blocks = findAll(root, (node) => node.props.className === 'md-code-block')
assert.equal(blocks.length, 1, 'a fenced block gets the shipped code-block class')
assert.match(allText(blocks[0]).join(''), /print\(1\)/, 'the code keeps its text')
assert.equal(findAll(root, (node) => node.props.className === 'aman-chat-codelang').length, 1, 'the fence language is shown')

// ── the search switch, and deleting a chat ──────────────────────────────────
switches[0].props.onClick()
await settle()
assert.equal(findAll(root, (node) => node.props.role === 'switch')[0].props['aria-checked'], 'false', 'the switch flips')

const removes = findAll(root, (node) => node.props.className === 'aman-chat-file-remove')
assert.equal(removes.length, 2, 'each chat row offers a delete')
removes[0].props.onClick()
await settle()
const deletes = calls.filter((call) => call.url.endsWith('/delete'))
assert.equal(deletes.length, 1, 'deleting posts once')
assert.deepEqual(deletes[0].body, { id: 'c1' }, 'the clicked row is the one deleted')

// ── the history column folds away, and the choice is kept ───────────────────
const aside = () => findAll(root, (node) => node.props.className === 'aman-chat-list')
const folds = () => findAll(root, (node) => node.props.className === 'aman-chat-icon')
const newChat = () => findAll(root, (node) => node.props.className === 'aman-chat-toggle' && allText(node).join('') === 'New chat')
assert.equal(aside().length, 1, 'the history column starts open')
assert.equal(folds().length, 1, 'the thread header carries the fold control')
assert.equal(folds()[0].props['aria-expanded'], 'true')
assert.equal(folds()[0].props['aria-label'], 'Hide chats')

folds()[0].props.onClick()
await settle()
assert.equal(aside().length, 0, 'folding removes the history column')
assert.equal(folds()[0].props['aria-expanded'], 'false', 'the control now offers to show it')
assert.equal(folds()[0].props['aria-label'], 'Show chats')
assert.equal(newChat().length, 1, 'New chat stays reachable while folded')
assert.match(
  String(findAll(root, (node) => node.type === 'path' && String(node.props.d).startsWith('M9 6l6 6'))[0]?.props.d),
  /M9 6l6 6/,
  'the chevron turns to point right',
)
assert.deepEqual(calls.filter((call) => call.url.endsWith('/ui')).at(-1).body, { historyCollapsed: true }, 'the fold is saved on the host')

folds()[0].props.onClick()
await settle()
assert.equal(aside().length, 1, 'the column comes back')
assert.deepEqual(calls.filter((call) => call.url.endsWith('/ui')).at(-1).body, { historyCollapsed: false }, 'unfolding is saved too')

// ── a fresh page opens the way it was left ──────────────────────────────────
statusUi = { historyCollapsed: true }
hookStore.clear()
renderOnce()
await settle()
assert.equal(aside().length, 0, 'a page opened after folding shows no history column')
assert.equal(folds()[0].props['aria-expanded'], 'false', 'and the control starts on show')

// ── the settings row turns the fork off without a config edit ───────────────
const settingRow = slots[2].Component
const offStatus = { ok: true, sidebarFork: true, ui: { sidebarForkOff: false } }
const originalFetch = globalThis.fetch
globalThis.fetch = async (url, options = {}) => {
  const target = String(url)
  if (target.endsWith('/status')) return json(offStatus)
  if (target.endsWith('/ui')) {
    const body = JSON.parse(options.body ?? '{}')
    offStatus.ui = { ...offStatus.ui, ...body }
    return json({ ui: offStatus.ui })
  }
  return json({})
}
hookStore.clear()
factory = () => React.createElement(settingRow, { t: (key) => key })
renderOnce()
await settle()
assert.match(allText(root).join(' '), /Chats in the sidebar/, 'the row is titled')
assert.match(allText(root).join(' '), /The sidebar shows the Chats section/, 'and says the fork is on')
findAll(root, (node) => node.props.role === 'switch')[0].props.onClick()
await settle()
assert.equal(offStatus.ui.sidebarForkOff, true, 'turning it off is saved on the host')
assert.match(allText(root).join(' '), /The shipped sidebar is in use/, 'and the row says the change needs a reload')
// a recorded fallback shows in the row instead of staying invisible
offStatus.ui = { sidebarForkOff: false, sidebarForkError: 'the fork threw while rendering' }
hookStore.clear()
factory = () => React.createElement(settingRow, { t: (key) => key })
renderOnce()
await settle()
assert.match(allText(root).join(' '), /Fell back to the shipped sidebar/, 'a recorded fallback is surfaced in Settings')
assert.match(allText(root).join(' '), /the fork threw while rendering/, 'with the reason')
globalThis.fetch = originalFetch

// ── the sidebar fork: registered only on request ────────────────────────────
sidebarFork = true
const forkSlots = []
const injected = {}
const services = {
  layout: { selectPanel: (id) => { injected.panel = id } },
  uiWorkspace: {
    openSession: (id) => { injected.session = id },
    startSession: () => { injected.started = true },
  },
}
plugin.apply({
  get: (name) => services[name],
  effect: () => {},
  slots: {
    inject: (owner, callback) => callback(),
    register: (options, Component) => {
      forkSlots.push({ options, Component })
      return () => {}
    },
  },
})
await new Promise((resolve) => setImmediate(resolve))
assert.equal(forkSlots.length, 4, 'the shadow joins the icon, the page and the settings row')
const shadow = forkSlots.find((entry) => entry.options.name === 'sidebar.workspaces')
assert.ok(shadow, 'the shadow registers into sidebar.workspaces')
assert.equal(shadow.options.locale, 'chat-panel', 'it reuses the plugin dictionary')
assert.deepEqual(
  Object.keys(shadow.options.children).sort(),
  [
    'sidebar.session.row.hover',
    'sidebar.session.row.leading',
    'sidebar.workspaces.directoryFlow',
    'sidebar.workspaces.session.menu.item',
    'sidebar.workspaces.session.row.action',
  ],
  'it re-declares every seat the shipped browser owns',
)
assert.equal(shadow.options.children['sidebar.workspaces.session.row.action'].kind, 'list')
assert.ok(shadow.options.children['sidebar.workspaces.session.menu.item'].inject, 'the menu list keeps its hook contract')

// with the switch off, the shadow stays out of the sidebar
statusUi = { sidebarForkOff: true }
const stillFork = []
plugin.apply({
  get: (name) => services[name],
  effect: () => {},
  slots: {
    inject: (owner, callback) => callback(),
    register: (options, Component) => { stillFork.push({ options, Component }); return () => {} },
  },
})
await new Promise((resolve) => setImmediate(resolve))
assert.equal(stillFork.filter((entry) => entry.options.name === 'sidebar.workspaces').length, 0, 'the off switch keeps the shipped browser')
statusUi = {}

// the declaration must match the recorded contract exactly
const contract = JSON.parse(await fs.readFile(new URL('./contract/sidebar-workspaces.json', import.meta.url), 'utf8'))
assert.deepEqual(
  Object.keys(shadow.options.children).sort(),
  Object.keys(contract.children).sort(),
  'the shadow declares exactly the seats the contract records',
)
for (const [name, spec] of Object.entries(contract.children)) {
  assert.equal(shadow.options.children[name].kind, spec.kind, `${name} keeps its kind`)
  assert.equal(shadow.options.children[name].scope, spec.scope, `${name} keeps its scope`)
}
const injectedHooks = shadow.options.children['sidebar.workspaces.session.menu.item'].inject.hooks
for (const hook of contract.children['sidebar.workspaces.session.menu.item'].injectHooks) {
  assert.ok(injectedHooks[hook] !== undefined || hook === 'shortcuts', `the menu list provides ${hook}`)
}

// ── and it renders both sections from the framework hooks ───────────────────
const sessionsFixture = {
  ids: ['s1', 's2'],
  byId: {
    s1: { id: 's1', title: 'Sea ice', blank: false, running: false, updatedAt: Date.now(), retainedBy: { mainView: 1 } },
    s2: { id: 's2', title: 'Heatwaves', blank: false, running: true, updatedAt: Date.now() },
  },
  projectionsBySession: {},
}
const workspacesFixture = {
  items: [{ workspaceId: 'w1', path: '/Users/x/phd', title: 'PhD', createdAt: new Date().toISOString(), sessionIds: ['s1', 's2'] }],
  pinnedSessionIds: [],
  archivedSessionIds: [],
}
const statusesFixture = new Map([['s2', { running: true }]])
const slotCalls = []
const forkProps = {
  t: (key) => key,
  renderSlot: (name, owner, options) => {
    slotCalls.push({ name, owner, options })
    return { type: 'slot', props: { name }, children: [] }
  },
  useSessions: (selector) => selector(sessionsFixture),
  useWorkspaces: (selector) => selector(workspacesFixture),
  useSessionStatus: (selector) => selector(statusesFixture),
  openSession: (id) => { injected.session = id },
  startSession: () => { injected.started = true },
  selectChat: (id) => { injected.chat = id },
  searchSessions: (query) => {
    searched.push(query)
    return Promise.resolve({ items: [{ sessionId: 's2', snippet: 'a body match' }] })
  },
}
const searched = []
hookStore.clear()
factory = () => React.createElement(shadow.Component, forkProps)
renderOnce()
await settle()

const rowTitles = findAll(root, (node) => node.props.className === 'aman-sb-title').map((node) => allText(node).join(''))
assert.ok(rowTitles.includes('Sea ice') && rowTitles.includes('Heatwaves'), 'the session rows render from the snapshot')
assert.ok(rowTitles.includes('CMIP6 scenarios'), 'the chats rows render from the host routes')
assert.equal(findAll(root, (node) => node.props.className === 'aman-sb-head-label').length, 2, 'two section headers')
assert.equal(findAll(root, (node) => node.props.className === 'aman-sb-icon').length, 6, 'search, group and new on both sections')
assert.ok(slotCalls.some((call) => call.name === 'sidebar.session.row.leading'), 'the leading seat is rendered')
assert.ok(slotCalls.some((call) => call.name === 'sidebar.workspaces.session.row.action'), 'the row actions seat is rendered')

const sessionRow = findAll(root, (node) => node.props.className === 'aman-sb-row')[0]
sessionRow.props.onClick()
assert.equal(injected.session, 's1', 'clicking a session row opens that session')

const chatRow = findAll(root, (node) => node.props.className === 'aman-sb-row').at(-1)
chatRow.props.onClick()
assert.equal(injected.chat, 'c2', 'clicking the last chat row selects that chat')

// ── a chat row's own menu, and a remembered grouping ────────────────────────
const rowMenuButtons = findAll(root, (node) => node.props.className === 'aman-sb-row-icon')
assert.ok(rowMenuButtons.length >= 3, 'session rows and chat rows all carry a menu button')
rowMenuButtons.at(-1).props.onClick({ stopPropagation() {} })
await settle()
const menuItems = findAll(root, (node) => node.props.className === 'aman-sb-item').map((node) => allText(node).join(''))
assert.deepEqual(menuItems.slice(-2), ['rename', 'delete'], 'a chat row offers rename and delete')

findAll(root, (node) => node.props.className === 'aman-sb-item').at(-2).props.onClick()
await settle()
const renameInput = findAll(root, (node) => node.props.className === 'aman-sb-rename')[0]
assert.ok(renameInput, 'rename turns the row into an input')
renameInput.props.onInput({ target: { value: 'renamed chat' } })
await settle()
// The commit reads the input event's state, so the field is re-read after the
// re-render that a real browser would have had before the keydown.
findAll(root, (node) => node.props.className === 'aman-sb-rename')[0].props.onKeyDown({ key: 'Enter' })
await settle()
assert.ok(
  calls.some((call) => call.url.endsWith('/rename') && call.body.title === 'renamed chat'),
  'committing a rename posts the new title',
)

findAll(root, (node) => node.props.className === 'aman-sb-row-icon').at(-1).props.onClick({ stopPropagation() {} })
await settle()
findAll(root, (node) => node.props.className === 'aman-sb-item').at(-1).props.onClick()
await settle()
assert.ok(calls.some((call) => call.url.endsWith('/delete')), 'delete removes the chat')

// the grouping choice is kept on the host
findAll(root, (node) => node.props.className === 'aman-sb-icon' && node.props.title === 'groupBy')[0].props.onClick()
await settle()
findAll(root, (node) => node.props.className === 'aman-sb-item').find((node) => allText(node).join('') === 'groupByModel').props.onClick()
await settle()
assert.ok(
  calls.some((call) => call.url.endsWith('/ui') && call.body.chatsGroup === 'model'),
  'the grouping preference is remembered on the host',
)

// ── the workspaces half searches and regroups too ──────────────────────────
findAll(root, (node) => node.props.className === 'aman-sb-icon' && node.props.title === 'searchSessions')[0].props.onClick()
await settle()
const sessionField = findAll(root, (node) => node.props.className === 'aman-sb-search')[0]
assert.ok(sessionField, 'the sessions search field opens')
sessionField.props.onInput({ target: { value: 'body match' } })
await settle()
await new Promise((resolve) => setTimeout(resolve, 350))
await settle()
assert.deepEqual(searched, ['body match'], 'the sessions search goes to the host search service')
assert.match(allText(root).join(' '), /matches/, 'session matches are grouped under the heading')
const titlesAfterSearch = findAll(root, (node) => node.props.className === 'aman-sb-title').map((node) => allText(node).join(''))
assert.ok(titlesAfterSearch.includes('Heatwaves'), 'the matching session is listed')
assert.ok(titlesAfterSearch.includes('Sea ice') === false, 'a session that does not match is not listed')

findAll(root, (node) => node.props.className === 'aman-sb-search')[0].props.onKeyDown({ key: 'Escape' })
await settle()
findAll(root, (node) => node.props.className === 'aman-sb-icon' && node.props.title === 'groupSessions')[0].props.onClick()
await settle()
const flatItem = findAll(root, (node) => node.props.className === 'aman-sb-item').find((node) => allText(node).join('') === 'groupByFlat')
flatItem.props.onClick()
await settle()
const flatText = allText(root).join(' ')
assert.ok(flatText.includes('PhD') === false, 'a flat list drops the workspace headers')
const flatTitles = findAll(root, (node) => node.props.className === 'aman-sb-title').map((node) => allText(node).join(''))
assert.ok(flatTitles.includes('Sea ice') && flatTitles.includes('Heatwaves'), 'and keeps every session row')

// ── the fork reports what it actually rendered ─────────────────────────────
const report = calls.filter((call) => call.url.endsWith('/ui') && call.body?.sidebarForkReport).at(-1)
assert.ok(report, 'a mounted fork reports what it rendered')
assert.deepEqual(
  { sessions: report.body.sidebarForkReport.sessions, chats: report.body.sidebarForkReport.chats, workspaces: report.body.sidebarForkReport.workspaces },
  { sessions: 2, chats: 2, workspaces: 1 },
  'with the real counts from both snapshots',
)

// ── the chats search reaches the host, not just the titles ─────────────────
findAll(root, (node) => node.props.className === 'aman-sb-icon' && node.props.title === 'searchChats')[0].props.onClick()
await settle()
const searchField = findAll(root, (node) => node.props.className === 'aman-sb-search')[0]
assert.ok(searchField, 'the chats search field opens')
searchField.props.onInput({ target: { value: 'panel reply' } })
await settle()
await new Promise((resolve) => setTimeout(resolve, 350))
await settle()
assert.ok(
  calls.some((call) => call.url.endsWith('/search') && call.body.query === 'panel reply'),
  'a query of two characters or more is sent to the host',
)
assert.match(allText(root).join(' '), /matches/, 'results are grouped under the matches heading')
assert.match(allText(root).join(' '), /Sea ice trends/, 'and the matched chat is listed')

// the boundary hands the sidebar back instead of leaving it empty
let boundaryFellBack = false
hookStore.clear()
const Boundary = shadow.Component
factory = () => React.createElement(Boundary, { ...forkProps, useSessions: () => { throw new Error('renamed snapshot field') }, onFailure: () => { boundaryFellBack = true } })
renderOnce()
assert.equal(boundaryFellBack, true, 'a throwing fork asks the caller to restore the shipped browser')
assert.match(allText(root).join(' '), /sidebar fork is unavailable/, 'and leaves a visible note rather than a hole')

hookStore.clear()
factory = () => React.createElement(shadow.Component, forkProps)
renderOnce()
await settle()

findAll(root, (node) => node.props.className === 'aman-sb-row-icon')[0].props.onClick({ stopPropagation() {} })
await settle()
const menuCall = slotCalls.filter((call) => call.name === 'sidebar.workspaces.session.menu.item').at(-1)
assert.ok(menuCall, 'the ... menu renders the shipped menu items')
assert.equal(menuCall.options.hookContext[0], true, 'the menu open state is threaded as hookContext')

console.log('client.js smoke test passed: registrations, icon, list render, submit, pending dots, composer layout, atom toggle, markdown, switching, delete, fold, sidebar fork, failure path')
