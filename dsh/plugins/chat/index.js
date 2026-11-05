/**
 * Chat: a chat client that talks to model providers directly.
 *
 * Every path here - the `chat` tool, the `/chat` command and the Chat panel -
 * funnels into one call, `converse()`. There is no agent, no tool loop and no
 * session: a prompt goes out, one reply comes back, and the panel keeps its own
 * history on disk under `settings.dataDir`.
 *
 * Grounding shells out to the Tavily CLI (`tvly search --json`). A text or PDF
 * attachment is reduced to text (`pdftotext` for PDFs) before it reaches the
 * prompt; an image is handed to `ctx.attachments.saveImage` and attached as an
 * image block when the chosen model declares image input.
 *
 * Storage is one JSON file per chat with temp-file + rename writes. The profile
 * has no mounted `ctx.storage` form, and `ctx.storageDomain` would require this
 * bundle to import `@deepseek-ai/dsh-storage-domain` and zod by bare name, which
 * a profile-installed bundle cannot resolve; the on-disk result is the same
 * layout the shipped json backend uses.
 */
import fs from 'node:fs/promises'
import path from 'node:path'

import { createStore, defaultDataDir, newId, titleFrom } from './store.js'
import { describeSearch, extractFile, resolveTavily, tavilySearch } from './ground.js'

export const name = 'chat'
// `subprocess` must be injected: Cordis refuses `ctx.subprocess` outright without
// an injection, and the Tavily search and the PDF extractor both need it. `llm`
// and `attachments` are read through the guarded helper instead, so a profile
// without them still gets the tool, the command and the panel.
export const inject = ['tools', 'commands', 'subprocess']

const ROUTE = '/api/aman-chat'
const IMAGE_MEDIA = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

const MIME_TYPES = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  json: 'application/json',
  md: 'text/markdown',
  txt: 'text/plain',
  log: 'text/plain',
  py: 'text/x-python',
  r: 'text/x-r',
  jl: 'text/x-julia',
  ipynb: 'application/json',
  html: 'text/html',
  xml: 'text/xml',
  tex: 'text/x-tex',
  bib: 'text/x-bibtex',
  yml: 'text/yaml',
  yaml: 'text/yaml',
}

const DEFAULTS = {
  provider: 'paratera',
  model: 'DeepSeek-V4.1-Flash',
  systemPrompt: '',
  maxChars: 24_000,
  timeoutMs: 300_000,
  historyMessages: 24,
  historyChars: 120_000,
  web: true,
  webResults: 5,
  webDepth: 'basic',
  webTimeoutMs: 60_000,
  tvlyCommand: 'tvly',
  tvlyPaths: [],
  images: 'auto',
  fileMaxChars: 40_000,
  fileTimeoutMs: 60_000,
  maxUploadBytes: 26_214_400,
  dataDir: '',
  titleChars: 60,
  // The sidebar fork stays off until its chats half is complete: with it off, the
  // shipped workspace browser owns the sidebar and nothing changes for the user.
  sidebarFork: false,
}

function withDefaults(config) {
  const given = config ?? {}
  const merged = { ...DEFAULTS }
  for (const [key, value] of Object.entries(given)) {
    if (value !== undefined && value !== null) merged[key] = value
  }
  if (!merged.dataDir) merged.dataDir = defaultDataDir()
  return merged
}

function text(value) {
  return typeof value === 'string' ? value : String(value ?? '')
}

function mimeFromName(fileName) {
  const extension = path.extname(text(fileName)).replace('.', '').toLowerCase()
  return MIME_TYPES[extension] ?? 'application/octet-stream'
}

function describeFailure(reason) {
  if (reason === null || reason === undefined) return 'the provider returned no failure detail'
  const code = text(reason.code)
  const message = text(reason.message) || 'unknown provider failure'
  return code === '' ? message : `${code}: ${message}`
}

/**
 * Read a service by name.
 *
 * `ctx.get(name)` is always safe; reading `ctx.<name>` throws outright when the
 * service was not injected, so it is only tried inside a guard. Callers that
 * need an optional service therefore never crash on a profile without it.
 */
function service(ctx, name) {
  try {
    const found = ctx.get?.(name)
    if (found !== undefined && found !== null) return found
  } catch {
    // fall through to the property
  }
  try {
    return ctx?.[name]
  } catch {
    return undefined
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/**
 * The connection service decides whether a request may be served at all. Its
 * rejection is returned verbatim when it is already a response, and turned into
 * one otherwise, so this guard does not depend on which shape it uses.
 */
function guard(rejection) {
  if (rejection === undefined || rejection === null) return null
  if (typeof rejection?.status === 'number' && typeof rejection?.json === 'function') return rejection
  return json({ error: 'this request was rejected by the connection policy' }, typeof rejection === 'number' ? rejection : 403)
}

class RequestError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

async function readBody(request) {
  let payload
  try {
    payload = await request.json()
  } catch {
    throw new RequestError('the request body must be JSON')
  }
  if (payload === null || typeof payload !== 'object') throw new RequestError('the request body must be a JSON object')
  return payload
}

// ── the model call ──────────────────────────────────────────────────────────

/**
 * Stream one call and return its visible text. Only `text-delta` carries reply
 * text: `reasoning-delta` holds the model's private planning, and accepting text
 * from any chunk that has a `text` field pastes that planning into the answer.
 */
async function converse(ctx, settings, request, signal) {
  const provider = text(request.provider) || settings.provider
  const model = text(request.model) || settings.model
  const llm = service(ctx, 'llm')
  if (llm === undefined || llm === null) {
    return {
      text: '',
      truncated: false,
      provider,
      model,
      failure: { code: 'llm/missing', message: 'the llm service is not mounted in this profile' },
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error(`the call timed out after ${settings.timeoutMs}ms`)), settings.timeoutMs)
  const onAbort = () => controller.abort(signal?.reason)
  if (signal !== undefined) {
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }

  let collected = ''
  let truncated = false
  let failure = null
  try {
    const options = { provider, model, messages: request.messages, signal: controller.signal }
    if (text(request.system) !== '') options.system = request.system
    for await (const chunk of llm.stream(options)) {
      if (chunk?.type === 'text-delta') {
        collected += text(chunk.text)
        continue
      }
      if (chunk?.type !== 'finish') continue
      const reason = chunk.reason ?? {}
      if (reason.kind === 'max-tokens') truncated = true
      if (reason.kind === 'error' || reason.kind === 'aborted') {
        failure = { code: text(reason.failure?.code) || reason.kind, message: describeFailure(reason.failure) }
      }
    }
  } catch (error) {
    failure = { code: 'llm/threw', message: text(error?.message ?? error) || 'the call failed' }
  } finally {
    clearTimeout(timer)
    if (signal !== undefined) signal.removeEventListener('abort', onAbort)
  }

  // Cap the model's own text, then add the note: slicing afterwards would cut
  // the note off instead, which is how a truncated reply lost its explanation.
  const reply = collected.trim().slice(0, settings.maxChars)
  const body = reply === '' ? (failure === null ? '(the provider returned no text)' : '') : reply
  const note = truncated ? '\n\n[reply truncated: the model reached its output limit]' : ''
  return { text: `${body}${note}`, truncated, provider, model, failure }
}

/** One-shot: a single user prompt, no history. Used by the tool and command. */
async function ask(ctx, settings, prompt, override, signal) {
  const result = await converse(ctx, settings, {
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    provider: override?.provider,
    model: override?.model,
    system: settings.systemPrompt,
  }, signal)
  if (result.failure !== null) throw new Error(`${result.provider}/${result.model} failed - ${result.failure.message}`)
  return { text: result.text, provider: result.provider, model: result.model, truncated: result.truncated }
}

/** Does the chosen route accept images? Cheap enough to ask every turn. */
async function imageSupport(ctx, settings, provider, model) {
  if (settings.images === false || settings.images === 'off') return false
  if (settings.images === true) return true
  const llm = service(ctx, 'llm')
  if (llm?.resolveModelInfo === undefined) return false
  try {
    const info = await llm.resolveModelInfo(provider, model)
    return Array.isArray(info?.inputModalities) && info.inputModalities.includes('image')
  } catch {
    return false
  }
}

/** Store image bytes through the attachment service and return its reference. */
async function attachImage(ctx, attachment, mediaType, name) {
  const attachments = service(ctx, 'attachments')
  if (attachments?.saveImage === undefined) return { ref: null, note: 'this profile has no attachment store for images' }
  try {
    const data = await fs.readFile(attachment.path)
    const ref = await attachments.saveImage({ data, mediaType, name })
    return { ref, note: '' }
  } catch (error) {
    return { ref: null, note: `the image could not be attached (${text(error?.message ?? error)})` }
  }
}

// ── chat history ────────────────────────────────────────────────────────────

/**
 * Turn stored messages into request messages.
 *
 * A user turn uses the direct-call shape `{role, content}`; an assistant turn
 * has no such variant, so it is sent as a durable Message with the id and the
 * model source it came from. The newest user turn carries the attachment text
 * and the web results; older turns are replayed as text, and once the character
 * budget is spent the older turns are dropped rather than truncated mid-thread.
 */
function buildMessages(settings, chat, extra) {
  const history = chat.messages.filter((message) => message.role === 'user' || message.role === 'assistant')
  const selected = []
  let budget = settings.historyChars
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    const newest = index === history.length - 1
    const body = message.role === 'user' ? userBody(message, newest ? extra : null) : assistantBody(message)
    if (selected.length > 0 && body.length > budget) break
    budget -= body.length
    selected.unshift(requestMessage(message, body, extra))
    if (selected.length >= settings.historyMessages) break
  }
  return selected
}

function requestMessage(message, body, extra) {
  const newest = extra?.messageId !== undefined && message.id === extra.messageId
  const content = [{ type: 'text', text: body }]
  if (newest) {
    for (const image of extra.images ?? []) content.push({ type: 'image', attachment: image.ref })
  }
  if (message.role === 'assistant') {
    return {
      id: message.id,
      role: 'assistant',
      source: { kind: 'model', provider: message.provider || extra?.provider || '', model: message.model || extra?.model || '' },
      content,
    }
  }
  return { role: 'user', content }
}

function userBody(message, extra) {
  const parts = [text(message.text)]
  for (const file of message.attachments ?? []) {
    if (text(file.image?.attachmentId) !== '') {
      parts.push(`[attached image ${file.name}]`)
      continue
    }
    if (text(file.text).trim() === '') {
      if (text(file.note) !== '') parts.push(`[attached file ${file.name}: ${file.note}]`)
      continue
    }
    parts.push(`[attached file ${file.name}]\n${file.text}`)
  }
  if (extra?.search?.ok === true && extra.search.results.length > 0) {
    parts.push(`[web results from Tavily for "${extra.search.query}"]\n${describeSearch(extra.search.results)}`)
  } else if (extra?.search !== null && extra?.search !== undefined && extra.search.ok === false) {
    parts.push(`[a web search was requested but failed: ${extra.search.reason}]`)
  } else if (extra?.search?.ok === true) {
    parts.push(`[a web search for "${extra.search.query}" returned no results]`)
  }
  return parts.join('\n\n')
}

function assistantBody(message) {
  if (text(message.error) !== '') return `[the previous reply failed: ${message.error}]`
  return text(message.text)
}

function systemFor(settings, extra) {
  const parts = []
  if (settings.systemPrompt !== '') parts.push(settings.systemPrompt)
  parts.push('You are the assistant inside a chat panel. Answer directly and concisely, in the language the question was asked in. You have no tools and cannot run commands; when the answer depends on something you were not given, say what is missing instead of guessing.')
  if (extra?.search?.ok === true && extra.search.results.length > 0) {
    parts.push('Web results are included in the user message, numbered [1], [2], ... Cite the ones you use by number and give their URLs. Say plainly when the results do not answer the question.')
  }
  return parts.join('\n\n')
}

/**
 * One panel turn: load or create the chat, gather grounding, call the model and
 * persist both messages. A failed call is stored as an assistant message so the
 * thread shows what happened instead of losing the question.
 */
async function runTurn(ctx, settings, store, input, signal) {
  const prompt = input.prompt
  const provider = text(input.provider) || settings.provider
  const model = text(input.model) || settings.model

  let chat = input.id ? await store.get(input.id) : null
  if (chat === null) chat = await store.create({ title: titleFrom(prompt, settings.titleChars), provider, model })

  const wantsImages = await imageSupport(ctx, settings, provider, model)
  const attachments = []
  for (const fileId of Array.isArray(input.files) ? input.files : []) {
    const meta = await store.getFile(fileId)
    if (meta === null) continue
    const attachment = { id: meta.id, name: meta.name, bytes: meta.bytes, mime: meta.mime, text: '', note: '' }
    if (IMAGE_MEDIA.has(meta.mime)) {
      if (wantsImages) {
        const outcome = await attachImage(ctx, meta, meta.mime, meta.name)
        attachment.image = outcome.ref ?? undefined
        attachment.note = outcome.note
      } else {
        attachment.note = `the model ${model} does not accept images, so it was not attached`
      }
    } else {
      const extracted = await extractFile(ctx, settings, meta)
      attachment.text = extracted.text
      attachment.note = extracted.note
    }
    attachments.push(attachment)
  }

  const wantsWeb = input.web === undefined ? settings.web === true : input.web === true
  const search = wantsWeb ? await tavilySearch(ctx, settings, prompt, signal) : null

  const userMessage = {
    id: newId(),
    role: 'user',
    at: Date.now(),
    text: prompt,
    attachments,
    web: search === null ? undefined : (search.ok ? { query: search.query, results: search.results } : { error: search.reason }),
  }
  chat.messages.push(userMessage)

  const extra = {
    search,
    messageId: userMessage.id,
    images: attachments.filter((attachment) => attachment.image !== undefined).map((attachment) => ({ ref: attachment.image, name: attachment.name })),
    provider,
    model,
  }
  const messages = buildMessages(settings, chat, extra)
  const result = await converse(ctx, settings, { messages, system: systemFor(settings, extra), provider, model }, signal)

  const assistantMessage = {
    id: newId(),
    role: 'assistant',
    at: Date.now(),
    text: result.failure === null ? result.text : '',
    error: result.failure === null ? undefined : result.failure.message,
    provider: result.provider,
    model: result.model,
    truncated: result.truncated === true ? true : undefined,
    sources: search !== null && search.ok ? search.results.map((entry) => ({ title: entry.title, url: entry.url })) : undefined,
  }
  chat.messages.push(assistantMessage)
  chat.provider = result.provider
  chat.model = result.model
  if (text(chat.title) === '' || chat.title === 'New chat') chat.title = titleFrom(prompt, settings.titleChars)
  const saved = await store.save(chat)

  return { chat: saved, summary: store.summary(saved), search, failure: result.failure }
}

// ── registration ────────────────────────────────────────────────────────────

/** File paths given to the tool, reduced to text the same way an upload is. */
/**
 * Read the tool's `files`: text and PDFs become prompt text, and an image goes
 * through the attachment service when the chosen model takes image input. The
 * two callers therefore hand a model the same thing for the same file.
 */
async function readToolFiles(ctx, settings, locations, provider, model) {
  const wantsImages = await imageSupport(ctx, settings, provider, model)
  const attachments = []
  for (const location of Array.isArray(locations) ? locations : []) {
    const resolved = path.resolve(text(location))
    const name = path.basename(resolved)
    try {
      const stats = await fs.stat(resolved)
      if (!stats.isFile()) throw new Error('not a file')
      const mime = mimeFromName(resolved)
      if (IMAGE_MEDIA.has(mime)) {
        if (!wantsImages) {
          attachments.push({ name, mime, text: '', note: `the model ${model} does not accept images, so it was not attached` })
          continue
        }
        const attached = await attachImage(ctx, { path: resolved }, mime, name)
        const entry = { name, mime, text: '', note: attached.note === '' ? 'attached as an image' : attached.note }
        if (attached.ref !== null) entry.image = attached.ref
        attachments.push(entry)
        continue
      }
      const extracted = await extractFile(ctx, settings, { path: resolved, name, mime, bytes: stats.size })
      attachments.push({ name, text: extracted.text, note: extracted.note, mime })
    } catch (error) {
      attachments.push({ name, text: '', note: `could not be read (${text(error?.message ?? error)})`, mime: '' })
    }
  }
  return attachments
}

function registerTool(ctx, settings) {
  return ctx.tools.register({
    name: 'chat',
    description:
      'Ask a model provider one question directly and get its reply as text. This is a plain chat completion: no agent, no tools and no loop, so it cannot act on the answer. Use `web` to ground the answer in a Tavily web search, and `files` to attach local files without loading them into your own context: text is read, a PDF is extracted with pdftotext, and an image is sent as an image when the chosen model accepts one.',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The question or instruction to send.' },
        provider: { type: 'string', description: `Provider route. Defaults to ${settings.provider}.` },
        model: { type: 'string', description: `Model id. Defaults to ${settings.model}.` },
        web: { type: 'boolean', description: 'Search the web with Tavily and ground the answer in the results, cited by number.' },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Absolute paths of local files to include as text in the prompt.',
        },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The reply.' },
          provider: { type: 'string' },
          model: { type: 'string' },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              properties: { title: { type: 'string' }, url: { type: 'string' } },
              required: ['title', 'url'],
              additionalProperties: false,
            },
            description: 'Web results used, when grounding was requested.',
          },
        },
        required: ['text'],
        additionalProperties: false,
      },
      render: (_args, value) => {
        const rows = [{ type: 'text', text: text(value?.text) }]
        for (const source of value?.sources ?? []) rows.push({ type: 'text', text: `- ${text(source.title)} - ${text(source.url)}` })
        return rows
      },
    },
    async execute(args, exec) {
      const provider = text(args?.provider) || settings.provider
      const model = text(args?.model) || settings.model
      const attachments = await readToolFiles(ctx, settings, args?.files, provider, model)
      const parts = [text(args?.prompt)]
      const images = []
      for (const file of attachments) {
        const kind = text(file.mime).startsWith('image/') ? 'image' : 'file'
        if (file.image !== undefined) {
          images.push({ type: 'image', attachment: file.image })
          parts.push(`[attached ${kind} ${file.name}: ${file.note}]`)
          continue
        }
        parts.push(text(file.text).trim() === '' ? `[attached ${kind} ${file.name}: ${file.note}]` : `[attached file ${file.name}]\n${file.text}`)
      }

      const search = args?.web === true ? await tavilySearch(ctx, settings, text(args?.prompt), exec?.signal) : null
      const grounded = search !== null && search.ok && search.results.length > 0
      if (grounded) parts.push(`[web results from Tavily for "${search.query}"]\n${describeSearch(search.results)}`)
      else if (search !== null && !search.ok) parts.push(`[a web search was requested but failed: ${search.reason}]`)
      else if (search !== null) parts.push(`[a web search for "${search.query}" returned no results]`)

      const system = [
        settings.systemPrompt,
        grounded
          ? 'Web results are included in the user message, numbered [1], [2], ... Cite the ones you use by number and give their URLs. Say plainly when the results do not answer the question.'
          : '',
      ].filter((part) => text(part) !== '').join('\n\n')

      const result = await converse(ctx, settings, {
        messages: [{ role: 'user', content: [{ type: 'text', text: parts.join('\n\n') }, ...images] }],
        system,
        provider,
        model,
      }, exec?.signal)

      if (result.failure !== null) throw new Error(`${result.provider}/${result.model} failed - ${result.failure.message}`)
      // A present-but-undefined key is not lossless JSON, so absent means absent.
      const output = { text: result.text, provider: result.provider, model: result.model }
      if (grounded) output.sources = search.results.map((entry) => ({ title: entry.title, url: entry.url }))
      return output
    },
  })
}

function registerCommand(ctx, settings) {
  return ctx.commands.register({
    name: 'chat',
    description: 'Ask a model provider one question, with no agent loop. Usage: /chat <prompt>',
    async handler(invocation) {
      const raw = text(invocation?.rawInput).replace(/^\s*\/?chat\s*/i, '').trim()
      if (raw === '') return { kind: 'error', text: 'Usage: /chat <prompt>' }
      try {
        const result = await ask(ctx, settings, raw, {}, invocation?.signal)
        return { kind: 'success', text: result.text }
      } catch (error) {
        return { kind: 'error', text: text(error?.message ?? error) }
      }
    },
  })
}

/**
 * The panel's own API. Exact Fetch routes must live under `/api` and every path
 * segment has to match the endpoint pattern, so every action is a POST with a
 * JSON body and only the parameterless reads are GETs.
 */
function registerRoutes(ctx, settings, store) {
  if (typeof ctx.inject !== 'function') {
    ctx.logger?.warn?.('chat: this build has no ctx.inject, so the Chat panel routes are unavailable')
    return
  }
  ctx.inject(['connection'], (scope) => {
    const connection = scope.get?.('connection') ?? scope.connection
    const registry = connection?.fetch
    if (registry === undefined || registry === null) {
      ctx.logger?.warn?.('chat: the connection Fetch registry is unavailable, so the Chat panel routes are unavailable')
      return
    }

    const route = (methods, routePath, handler) => ({
      path: `${ROUTE}${routePath}`,
      methods,
      requestBody: 'buffered',
      async fetch(request) {
        const rejected = guard(connection.requestRejection?.(request))
        if (rejected !== null) return rejected
        void store.touch()
        try {
          return await handler(request)
        } catch (error) {
          const status = error instanceof RequestError ? error.status : 500
          if (status >= 500) ctx.logger?.warn?.(`chat: ${routePath} failed - ${text(error?.message ?? error)}`)
          return json({ error: status >= 500 ? 'the Chat panel route failed' : text(error?.message ?? error) }, status)
        }
      },
    })

    const definitions = [
      route(['GET'], '/status', async () => json({
        ok: true,
        dataDir: store.dataDir,
        chats: (await store.list()).length,
        llm: { provider: settings.provider, model: settings.model, available: service(ctx, 'llm') !== undefined },
        tavily: { command: settings.tvlyCommand, path: await resolveTavily(ctx, settings) },
        web: settings.web === true,
        images: settings.images,
        sidebarFork: settings.sidebarFork === true,
        ui: (await store.panel()).ui ?? {},
      })),

      route(['POST'], '/ui', async (request) => {
        const payload = await readBody(request)
        const patch = {}
        if (typeof payload.historyCollapsed === 'boolean') patch.historyCollapsed = payload.historyCollapsed
        // The browser half records a fallback here, so a failed shadow is visible
        // in panel.json instead of only in a console nobody is watching.
        if (typeof payload.sidebarForkError === 'string') patch.sidebarForkError = payload.sidebarForkError.slice(0, 200)
        if (typeof payload.sidebarForkMounted === 'number') patch.sidebarForkMounted = payload.sidebarForkMounted
        if (Object.keys(patch).length === 0) throw new RequestError('nothing to save')
        const record = await store.savePanel({ ui: { ...((await store.panel()).ui ?? {}), ...patch } })
        return json({ ui: record.ui ?? {} })
      }),

      route(['GET'], '/list', async () => json({ chats: await store.list() })),

      route(['POST'], '/get', async (request) => {
        const payload = await readBody(request)
        const chat = await store.get(text(payload.id))
        if (chat === null) throw new RequestError('that chat does not exist', 404)
        return json({ chat })
      }),

      route(['POST'], '/new', async (request) => {
        const payload = await readBody(request)
        const chat = await store.create({
          provider: text(payload.provider) || settings.provider,
          model: text(payload.model) || settings.model,
        })
        return json({ chat, chats: await store.list() })
      }),

      route(['POST'], '/rename', async (request) => {
        const payload = await readBody(request)
        const chat = await store.get(text(payload.id))
        if (chat === null) throw new RequestError('that chat does not exist', 404)
        const title = text(payload.title).trim()
        if (title !== '') chat.title = title.slice(0, 200)
        return json({ chat: await store.save(chat), chats: await store.list() })
      }),

      route(['POST'], '/delete', async (request) => {
        const payload = await readBody(request)
        await store.remove(text(payload.id))
        return json({ chats: await store.list() })
      }),

      route(['POST'], '/upload', async (request) => {
        const payload = await readBody(request)
        const encoded = text(payload.dataBase64)
        if (encoded === '') throw new RequestError('the upload carried no data')
        const bytes = Buffer.from(encoded, 'base64')
        if (bytes.length === 0) throw new RequestError('the upload carried no data')
        if (bytes.length > settings.maxUploadBytes) {
          throw new RequestError(`that file is larger than the ${Math.round(settings.maxUploadBytes / 1_048_576)} MB limit`, 413)
        }
        const file = await store.putFile(text(payload.name) || 'file', text(payload.mime) || mimeFromName(payload.name), bytes)
        return json({ file: { id: file.id, name: file.name, mime: file.mime, bytes: file.bytes } })
      }),

      route(['POST'], '/file', async (request) => {
        const payload = await readBody(request)
        const meta = await store.getFile(text(payload.id))
        if (meta === null) throw new RequestError('that file does not exist', 404)
        const data = await fs.readFile(meta.path)
        return json({ id: meta.id, name: meta.name, mime: meta.mime, bytes: meta.bytes, dataBase64: data.toString('base64') })
      }),

      route(['POST'], '/ask', async (request) => {
        const payload = await readBody(request)
        const prompt = text(payload.prompt).trim()
        if (prompt === '') throw new RequestError('a prompt is required')
        const result = await runTurn(ctx, settings, store, {
          id: text(payload.id) === '' ? null : text(payload.id),
          prompt,
          web: payload.web,
          files: payload.files,
          provider: payload.provider,
          model: payload.model,
        }, request.signal)
        return json({
          chat: result.chat,
          summary: result.summary,
          search: result.search !== null && result.search.ok ? { query: result.search.query, results: result.search.results } : null,
          failure: result.failure,
        })
      }),
    ]

    const disposers = definitions.map((definition) => registry.register(definition))
    if (typeof ctx.effect === 'function') {
      ctx.effect(() => () => {
        for (const dispose of disposers) {
          try {
            dispose?.()
          } catch {
            // a route that is already gone needs no cleanup
          }
        }
      })
    }
  })
}

export function apply(ctx, config) {
  const settings = withDefaults(config)
  const store = createStore(settings.dataDir)

  registerTool(ctx, settings)
  registerCommand(ctx, settings)
  registerRoutes(ctx, settings, store)

  return { settings, store }
}
