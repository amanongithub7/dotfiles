/**
 * Headless test for the host half.
 *
 * `llm` and `subprocess` are stubbed, so this runs the whole host side without a
 * network: the tool, the /chat command, every panel route, Tavily grounding,
 * attachment text extraction, the multi-turn message shapes and the failure
 * paths. It is the only way to exercise the panel's routes, which a browser
 * reaches through an authenticated Fetch channel.
 *
 *   node host-smoke.mjs
 */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { apply, inject, name } from './index.js'

assert.equal(name, 'chat')
assert.deepEqual(inject, ['tools', 'commands', 'subprocess'], 'the plugin declares its services; subprocess must be injected to be readable')

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aman-chat-test-'))
const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aman-chat-files-'))

let chunks = []
const streamCalls = []
const searches = []
let tavilyPayload = { query: 'x', results: [{ title: 'A source', url: 'https://example.test/a', content: 'Snippet text', score: 0.9 }] }
let failSearch = false

const llm = {
  stream(request) {
    streamCalls.push(request)
    return (async function* generate() {
      for (const chunk of chunks) yield chunk
    })()
  },
}

let imageInputs = ['text', 'image']
llm.resolveModelInfo = async () => ({ inputModalities: imageInputs })

const savedImages = []
let failSaveImage = false
const attachments = {
  async saveImage({ data, mediaType, name }) {
    if (failSaveImage) throw new Error('Unsupported or malformed image data.')
    savedImages.push({ mediaType, name, bytes: data.length })
    return { attachmentId: `att-${savedImages.length}`, mediaType, bytes: data.length, width: 4, height: 4 }
  },
}

const subprocess = {
  async resolveExecutable(command) {
    return command
  },
  spawn(spec) {
    searches.push(spec.argv)
    if (failSearch !== false) {
      const jsonFailure = failSearch === 'json'
      return {
        collected: {
          stdout: {
            readFrom: () => ({
              text: jsonFailure
                ? JSON.stringify({ error: { code: 'ip_rate_limit_exceeded', message: 'Too many keyless requests from this IP address. Retry later' } })
                : '',
              lossy: false,
            }),
          },
          stderr: { readFrom: () => ({ text: jsonFailure ? '' : 'tvly: not authenticated\n', lossy: false }) },
        },
        done: Promise.resolve({ exitCode: 3 }),
      }
    }
    const body = JSON.stringify(tavilyPayload)
    return {
      collected: {
        stdout: { readFrom: () => ({ text: body, lossy: false }) },
        stderr: { readFrom: () => ({ text: '', lossy: false }) },
      },
      done: Promise.resolve({ exitCode: 0 }),
    }
  },
}

const warnings = []
const routes = new Map()
const connection = {
  fetch: {
    register(definition) {
      routes.set(definition.path, definition)
      return () => {}
    },
  },
  requestRejection: () => undefined,
}

const get = (key) => {
  if (key === 'llm') return llm
  if (key === 'connection') return connection
  if (key === 'subprocess') return subprocess
  if (key === 'attachments') return attachments
  return undefined
}

const registrations = {}
const ctx = {
  get,
  inject: (dependencies, callback) => callback({ get }),
  effect: () => {},
  logger: { warn: (message) => warnings.push(message), info: () => {} },
  tools: { register: (definition) => { registrations.tool = definition; return () => {} } },
  commands: { register: (definition) => { registrations.command = definition; return () => {} } },
}

apply(ctx, { dataDir, maxUploadBytes: 4096, maxChars: 20, timeoutMs: 5000, webResults: 3 })

assert.ok(registrations.tool, 'the chat tool is registered')
assert.ok(registrations.command, 'the /chat command is registered')
assert.equal(routes.size, 9, `every panel route is registered (got ${[...routes.keys()].join(', ')})`)
assert.deepEqual(warnings, [], 'registration warned about nothing')

const text = (value) => ({ type: 'text-delta', text: value })
const stop = { type: 'finish', reason: { kind: 'stop' } }
const sent = () => streamCalls.at(-1)
const route = (suffix) => routes.get(`/api/aman-chat${suffix}`)
const request = (body) => ({ headers: {}, signal: undefined, json: async () => body })

// ── the tool ────────────────────────────────────────────────────────────────
chunks = [
  { type: 'block-start', index: 0, blockType: 'reasoning' },
  { type: 'reasoning-delta', index: 0, text: 'PRIVATE PLANNING' },
  { type: 'block-start', index: 1, blockType: 'text' },
  text('Hello'),
  text(' world'),
  { type: 'usage', usage: {} },
  stop,
]
const reply = await registrations.tool.execute({ prompt: 'hi' }, {})
assert.equal(reply.text, 'Hello world', 'the reply is the visible text, with no reasoning')
assert.equal(reply.provider, 'paratera')
assert.equal(sent().messages[0].content[0].text, 'hi')
assert.deepEqual(registrations.tool.output.schema.required, ['text'])
assert.match(registrations.tool.description, /no agent, no tools and no loop/)

chunks = [text('x'.repeat(50)), stop]
assert.equal((await registrations.tool.execute({ prompt: 'hi' }, {})).text.length, 20, 'maxChars caps the reply')

chunks = [text('partial'), { type: 'finish', reason: { kind: 'max-tokens' } }]
assert.match((await registrations.tool.execute({ prompt: 'hi' }, {})).text, /truncated/, 'a cut-off reply keeps its note')

chunks = [{ type: 'finish', reason: { kind: 'error', failure: { code: 'llm/boom', message: 'upstream exploded' } } }]
await assert.rejects(() => registrations.tool.execute({ prompt: 'hi' }, {}), /llm\/boom: upstream exploded/)

// ── the tool with a web search ──────────────────────────────────────────────
chunks = [text('Grounded answer [1]'), stop]
const grounded = await registrations.tool.execute({ prompt: 'what is new?', web: true }, {})
assert.equal(grounded.text, 'Grounded answer [1]')
assert.deepEqual(grounded.sources, [{ title: 'A source', url: 'https://example.test/a' }])
assert.deepEqual(searches.at(-1), ['tvly', 'search', 'what is new?', '--json', '--max-results', '3', '--depth', 'basic'])
assert.match(sent().messages[0].content[0].text, /\[web results from Tavily for "x"\]/, 'the results are added to the prompt')
assert.match(sent().messages[0].content[0].text, /\[1\] A source/, 'the grounding block numbers its sources')
assert.match(sent().system, /Cite the ones you use by number/, 'grounding adds the citation instruction')

tavilyPayload = { query: 'x', results: [] }
chunks = [text('no results'), stop]
await registrations.tool.execute({ prompt: 'quiet query', web: true }, {})
assert.match(sent().messages[0].content[0].text, /returned no results/, 'an empty search is reported to the model')

failSearch = true
chunks = [text('no search'), stop]
const ungrounded = await registrations.tool.execute({ prompt: 'blocked query', web: true }, {})
assert.match(sent().messages[0].content[0].text, /a web search was requested but failed: tvly: not authenticated/, 'a failed search says why')
assert.equal('sources' in ungrounded, false, 'a failed search offers no sources key at all')
failSearch = false
tavilyPayload = { query: 'x', results: [{ title: 'A source', url: 'https://example.test/a', content: 'Snippet text', score: 0.9 }] }

// The real keyless tier fails this way: JSON on stdout, empty stderr, exit 3.
failSearch = 'json'
chunks = [text('capped'), stop]
await registrations.tool.execute({ prompt: 'capped query', web: true }, {})
assert.match(
  sent().messages[0].content[0].text,
  /failed: Too many keyless requests from this IP address\. Retry later/,
  'a JSON failure on stdout is reported instead of the bare exit code',
)
failSearch = false

// ── the tool with a file ────────────────────────────────────────────────────
const notePath = path.join(workDir, 'notes.md')
await fs.writeFile(notePath, '# Findings\n\nSea level rose.', 'utf8')
chunks = [text('read it'), stop]
await registrations.tool.execute({ prompt: 'summarise', files: [notePath] }, {})
assert.match(sent().messages[0].content[0].text, /\[attached file notes\.md\]/, 'the file name reaches the prompt')
assert.match(sent().messages[0].content[0].text, /Sea level rose\./, 'the file text reaches the prompt')

chunks = [text('unreadable'), stop]
await registrations.tool.execute({ prompt: 'summarise', files: [path.join(workDir, 'missing.md')] }, {})
assert.match(sent().messages[0].content[0].text, /could not be read/, 'a missing file is reported, not thrown')

// ── the tool with an image ──────────────────────────────────────────────────
const pngPath = path.join(workDir, 'chart.png')
await fs.writeFile(pngPath, Buffer.from('89504e470d0a1a0a', 'hex'))
chunks = [text('seen'), stop]
await registrations.tool.execute({ prompt: 'what is in the chart?', files: [pngPath] }, {})
assert.equal(savedImages.length, 1, 'an image goes to the attachment service when the model accepts images')
assert.equal(savedImages[0].mediaType, 'image/png')
assert.deepEqual(
  sent().messages[0].content.filter((block) => block.type === 'image').map((block) => block.attachment.attachmentId),
  ['att-1'],
  'the request carries the image as a block, after the text',
)
assert.equal(sent().messages[0].content[0].type, 'text', 'the text block stays first')
assert.match(sent().messages[0].content[0].text, /\[attached image chart\.png: attached as an image\]/)

imageInputs = ['text']
chunks = [text('blind'), stop]
await registrations.tool.execute({ prompt: 'what is in the chart?', files: [pngPath] }, {})
assert.equal(sent().messages[0].content.length, 1, 'a text-only model is sent no image block')
assert.match(sent().messages[0].content[0].text, /does not accept images/, 'a text-only model is told why the image is missing')
assert.equal(savedImages.length, 1, 'nothing is stored for a model that cannot read it')

imageInputs = ['text', 'image']
failSaveImage = true
chunks = [text('no image'), stop]
await registrations.tool.execute({ prompt: 'what is in the chart?', files: [pngPath] }, {})
assert.match(
  sent().messages[0].content[0].text,
  /\[attached image chart\.png: the image could not be attached \(Unsupported or malformed image data\.\)\]/,
  'an image the attachment store rejects is reported with its reason',
)
assert.equal(sent().messages[0].content.length, 1, 'a rejected image is not sent as a block')
failSaveImage = false
imageInputs = ['text', 'image']

// ── the /chat command ───────────────────────────────────────────────────────
chunks = [text('from the command'), stop]
assert.deepEqual(
  await registrations.command.handler({ rawInput: '  /chat   say hi  ' }),
  { kind: 'success', text: 'from the command' },
)
assert.equal(sent().messages[0].content[0].text, 'say hi', 'the command name is stripped from the prompt')
assert.deepEqual(await registrations.command.handler({ rawInput: '/chat   ' }), { kind: 'error', text: 'Usage: /chat <prompt>' })
chunks = [{ type: 'finish', reason: { kind: 'aborted', failure: { message: 'cancelled' } } }]
const cancelled = await registrations.command.handler({ rawInput: '/chat x' })
assert.equal(cancelled.kind, 'error')
assert.match(cancelled.text, /cancelled/, 'a cancelled call is reported, not thrown')

// ── the panel routes ────────────────────────────────────────────────────────
chunks = [text('panel reply'), stop]
const status = await (await route('/status').fetch(request({}))).json()
assert.equal(status.ok, true)
assert.equal(status.tavily.command, 'tvly')
assert.equal(status.tavily.path, 'tvly', 'the status reports where tvly was found')
assert.equal(status.llm.available, true)
assert.equal(status.dataDir, dataDir)

assert.deepEqual((await (await route('/list').fetch(request({}))).json()).chats, [], 'a fresh store lists no chats')

const created = await (await route('/new').fetch(request({}))).json()
assert.ok(created.chat.id, 'a new chat has an id')
assert.equal(created.chats.length, 1)

assert.equal((await route('/get').fetch(request({ id: 'nope' }))).status, 404, 'an unknown chat is a 404')

const uploadBody = { name: 'notes.md', mime: 'text/markdown', dataBase64: Buffer.from('# Notes\n\nHello file.').toString('base64') }
const uploaded = await (await route('/upload').fetch(request(uploadBody))).json()
assert.ok(uploaded.file.id, 'the upload returns a file id')
assert.equal(uploaded.file.bytes, Buffer.byteLength('# Notes\n\nHello file.'))

const fileBack = await (await route('/file').fetch(request({ id: uploaded.file.id }))).json()
assert.equal(Buffer.from(fileBack.dataBase64, 'base64').toString('utf8'), '# Notes\n\nHello file.')

const asked = await (await route('/ask').fetch(request({ id: created.chat.id, prompt: 'read my note', files: [uploaded.file.id] }))).json()
assert.equal(asked.chat.messages.length, 2, 'the turn stores the question and the reply')
assert.equal(asked.chat.messages[1].text, 'panel reply')
assert.deepEqual(asked.chat.messages[0].attachments.map((file) => [file.name, file.text]), [['notes.md', '# Notes\n\nHello file.']], 'attachment text is stored with the question')
assert.equal(asked.summary.messages, 2)
assert.equal(asked.chat.title, 'read my note', 'the first prompt titles the chat')

// ── multi-turn shapes ───────────────────────────────────────────────────────
chunks = [text('second reply'), stop]
await route('/ask').fetch(request({ id: created.chat.id, prompt: 'and again', web: false }))
const history = sent().messages
assert.equal(history.length, 3, 'the second turn replays the first exchange')
assert.deepEqual(Object.keys(history[0]).sort(), ['content', 'role'], 'a user turn uses the direct-call shape')
assert.equal(history[1].role, 'assistant')
assert.ok(history[1].id, 'an assistant turn carries a message id')
assert.deepEqual(history[1].source, { kind: 'model', provider: 'paratera', model: 'DeepSeek-V4.1-Flash' })
assert.equal(history[1].content[0].text, 'panel reply')
assert.equal(history[2].content[0].text, 'and again')

// ── route errors ────────────────────────────────────────────────────────────
assert.equal((await route('/ask').fetch(request({ id: created.chat.id, prompt: '   ' }))).status, 400, 'an empty prompt is a client error')
assert.equal((await route('/ask').fetch({ headers: {}, json: async () => { throw new Error('not json') } })).status, 400, 'an unparsable body is a client error')
const tooBig = { name: 'big.bin', mime: 'application/octet-stream', dataBase64: Buffer.alloc(9000).toString('base64') }
assert.equal((await route('/upload').fetch(request(tooBig))).status, 413, 'an oversized upload is rejected')

connection.requestRejection = () => 403
assert.equal((await route('/list').fetch(request({}))).status, 403, 'every route applies the connection trust check')
connection.requestRejection = () => undefined

chunks = [{ type: 'finish', reason: { kind: 'error', failure: { message: 'provider down' } } }]
const failedTurn = await (await route('/ask').fetch(request({ id: created.chat.id, prompt: 'will fail', web: false }))).json()
assert.equal(failedTurn.failure.message, 'provider down')
assert.equal(failedTurn.chat.messages.at(-1).error, 'provider down', 'a failed reply is stored so the thread shows it')

const renamed = await (await route('/rename').fetch(request({ id: created.chat.id, title: 'Renamed' }))).json()
assert.equal(renamed.chat.title, 'Renamed')
const removed = await (await route('/delete').fetch(request({ id: created.chat.id }))).json()
assert.deepEqual(removed.chats, [], 'deleting the only chat empties the list')

// The store validates ids before they reach a path, so traversal reads nothing.
const store = apply(ctx, { dataDir }).store
assert.equal(await store.get('../../etc/passwd'), null, 'a traversal id resolves to nothing')

// ── a profile without the connection service ────────────────────────────────
const bare = {
  get: (key) => (key === 'llm' ? llm : undefined),
  inject: (dependencies, callback) => callback({ get: () => undefined }),
  effect: () => {},
  logger: { warn: (message) => warnings.push(message) },
  tools: { register: () => () => {} },
  commands: { register: () => () => {} },
}
apply(bare, { dataDir })
assert.equal(warnings.length, 1, 'a missing connection service is reported once')
assert.match(warnings[0], /Fetch registry/)

await fs.rm(dataDir, { recursive: true, force: true })
await fs.rm(workDir, { recursive: true, force: true })
console.log('index.js host test passed: tool, command, routes, grounding, attachments, history, failures')
