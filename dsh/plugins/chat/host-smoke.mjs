/**
 * Headless test for the host half.
 *
 * The plugin's three callers share one `ask()`, but only the tool has been used
 * against a live provider, and the panel route can only be reached by an
 * authenticated browser. This stubs the plugin context, `llm` and `connection`
 * and exercises every branch: the request the tool builds, the stream collector
 * (visible text only), the truncation note, the /chat command's parsing, the
 * panel route's status codes, and the failure path all three share.
 *
 *   node host-smoke.mjs
 */
import assert from 'node:assert/strict'
import { apply, inject, name } from './index.js'

assert.equal(name, 'chat')
assert.deepEqual(inject, ['tools', 'commands'], 'the plugin declares both services')

// --- a plugin context that records what apply() registers --------------------
const warnings = []
const streamCalls = []
const routes = []
let chunks = []

const llm = {
  stream(request) {
    streamCalls.push(request)
    return (async function* generate() {
      for (const chunk of chunks) yield chunk
    })()
  },
}
const connection = {
  fetch: { register(route) { routes.push(route); return async () => {} } },
  requestRejection: () => undefined,
}
const get = (key) => {
  if (key === 'llm') return llm
  if (key === 'connection') return connection
  return undefined
}
const ctx = {
  get,
  inject: (dependencies, callback) => callback({ get }),
  logger: { warn: (message) => warnings.push(message) },
  tools: { register(definition) { ctx.tool = definition; return () => {} } },
  commands: { register(definition) { ctx.command = definition; return () => {} } },
}

apply(ctx, { provider: 'paratera', model: 'DeepSeek-V4.1-Flash', maxChars: 20, timeoutMs: 5000 })
assert.ok(ctx.tool, 'the chat tool is registered')
assert.ok(ctx.command, 'the /chat command is registered')
assert.equal(routes.length, 1, 'the panel route is registered')
assert.deepEqual(warnings, [], 'registration warned about nothing')

const text = (value) => ({ type: 'text-delta', text: value })
const stop = { type: 'finish', reason: { kind: 'stop' } }
const sent = () => streamCalls.at(-1)

// --- the tool ---------------------------------------------------------------
chunks = [
  { type: 'block-start', index: 0, blockType: 'reasoning' },
  { type: 'reasoning-delta', index: 0, text: 'PRIVATE PLANNING' },
  { type: 'block-start', index: 1, blockType: 'text' },
  text('Hello'),
  text(' world'),
  { type: 'usage', usage: {} },
  stop,
]
const reply = await ctx.tool.execute({ prompt: 'hi' }, {})
assert.equal(reply.text, 'Hello world', 'the reply is the visible text, with no reasoning')
assert.equal(reply.provider, 'paratera')
assert.equal(reply.model, 'DeepSeek-V4.1-Flash')
assert.equal(sent().provider, 'paratera')
assert.equal(sent().model, 'DeepSeek-V4.1-Flash')
assert.equal(sent().messages[0].role, 'user')
assert.equal(sent().messages[0].content[0].type, 'text')
assert.equal(sent().messages[0].content[0].text, 'hi')

chunks = [text('x'.repeat(50)), stop]
assert.equal((await ctx.tool.execute({ prompt: 'hi' }, {})).text.length, 20, 'maxChars caps the reply')

chunks = [text('partial'), { type: 'finish', reason: { kind: 'max-tokens' } }]
assert.match((await ctx.tool.execute({ prompt: 'hi' }, {})).text, /truncated/, 'a cut-off reply says so')

chunks = [text('ok'), stop]
await ctx.tool.execute({ prompt: 'hi', provider: 'other', model: 'other-model' }, {})
assert.equal(sent().provider, 'other', 'the tool can override the provider per call')
assert.equal(sent().model, 'other-model')

chunks = [{ type: 'finish', reason: { kind: 'error', failure: { code: 'llm/boom', message: 'upstream exploded' } } }]
await assert.rejects(() => ctx.tool.execute({ prompt: 'hi' }, {}), /llm\/boom: upstream exploded/)
assert.deepEqual(
  ctx.tool.output.schema.required,
  ['text'],
  'the tool declares its required output',
)
assert.match(ctx.tool.description, /no agent, no tools and no loop/, 'the description sets the expectation')

// --- the /chat command ------------------------------------------------------
chunks = [text('from the command'), stop]
assert.deepEqual(
  await ctx.command.handler({ rawInput: '  /chat   say hi  ' }),
  { kind: 'success', text: 'from the command' },
)
assert.equal(sent().messages[0].content[0].text, 'say hi', 'the command name is stripped from the prompt')

assert.deepEqual(
  await ctx.command.handler({ rawInput: '/chat   ' }),
  { kind: 'error', text: 'Usage: /chat <prompt>' },
  'an empty command teaches its usage',
)

chunks = [{ type: 'finish', reason: { kind: 'aborted', failure: { message: 'cancelled' } } }]
const cancelled = await ctx.command.handler({ rawInput: '/chat x' })
assert.equal(cancelled.kind, 'error')
assert.match(cancelled.text, /cancelled/, 'a cancelled call is reported, not thrown')

// --- the panel route --------------------------------------------------------
const route = routes[0]
assert.equal(route.path, '/api/aman-chat/ask', 'exact routes must live under /api')
assert.deepEqual(route.methods, ['POST'])
assert.equal(route.requestBody, 'buffered')
const request = (body) => ({ headers: {}, json: async () => body })

chunks = [text('from the route'), stop]
const ok = await route.fetch(request({ prompt: 'panel hi' }))
assert.equal(ok.status, 200)
const payload = await ok.json()
assert.equal(payload.text, 'from the route')
assert.equal(payload.model, 'DeepSeek-V4.1-Flash')
assert.equal(sent().messages[0].content[0].text, 'panel hi')

const unparsable = await route.fetch({ headers: {}, json: async () => { throw new Error('not json') } })
assert.equal(unparsable.status, 400, 'a body that is not JSON is a client error')
assert.equal((await route.fetch(request({ prompt: '   ' }))).status, 400, 'an empty prompt is a client error')
assert.equal((await route.fetch(request({}))).status, 400, 'a missing prompt is a client error')

connection.requestRejection = () => 403
assert.equal((await route.fetch(request({ prompt: 'x' }))).status, 403, 'the route applies the connection trust checks')
connection.requestRejection = () => undefined

chunks = [{ type: 'finish', reason: { kind: 'error', failure: { message: 'provider down' } } }]
const failed = await route.fetch(request({ prompt: 'x' }))
assert.equal(failed.status, 502, 'a provider failure is a gateway error')
assert.match((await failed.json()).error, /provider down/)

// --- a profile without the connection service -------------------------------
const bare = {
  get: (key) => (key === 'llm' ? llm : undefined),
  inject: (dependencies, callback) => callback({ get: () => undefined }),
  logger: { warn: (message) => warnings.push(message) },
  tools: { register() { return () => {} } },
  commands: { register() { return () => {} } },
}
apply(bare, {})
assert.equal(warnings.length, 1, 'a missing connection service is reported once')
assert.match(warnings[0], /Fetch registry/)

console.log('index.js host test passed: tool, command, route, failures, degraded profile')
