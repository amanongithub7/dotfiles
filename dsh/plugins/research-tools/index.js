/**
 * research-tools - research plumbing for DeepSeek Harness.
 *
 *   - Zotero library tools over the `zotero-cli` command (read-only)
 *   - a Neovim bridge that reads what is open and opens files in the running editor
 *   - a scholarly search provider for ctx.web (OpenAlex)
 *   - a per-turn research context read from a versioned markdown file
 *
 * Authored source: ~/dotfiles/dsh/plugins/research-tools. Install with
 * plugin_manager { action: install_bundle, target: <that directory> }.
 *
 * Every capability degrades on its own: a missing zotero-cli, a missing Neovim
 * socket, or a missing context file fails that one capability with its own
 * message instead of breaking the plugin or the other capabilities.
 *
 * Deliberately read-only: nothing here writes to the Zotero library or to a
 * Neovim buffer. See README.md for why.
 */

import fs from 'node:fs'

export const name = 'research-tools'
export const inject = ['tools', 'subprocess']

const HOME = process.env.HOME ?? ''
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024
const STDERR_BYTES = 64 * 1024
const DEFAULT_TIMEOUT_MS = 120_000
const NVIM_TIMEOUT_MS = 20_000

const DEFAULTS = {
  zoteroCommand: 'zotero-cli',
  nvimCommand: 'nvim',
  nvimSocket: `${HOME}/.cache/nvim/dsh.sock`,
  contextFile: `${HOME}/dotfiles/dsh/research-context.md`,
  contextMaxChars: 1600,
  contextOrder: 9000,
  openalexMailto: '',
  timeoutMs: DEFAULT_TIMEOUT_MS,
}

function withDefaults(config) {
  const given = config ?? {}
  const merged = { ...DEFAULTS }
  for (const [key, value] of Object.entries(given)) {
    if (value !== undefined && value !== null) merged[key] = value
  }
  return merged
}

// ── shared helpers ──────────────────────────────────────────────────────────

function text(value) {
  return typeof value === 'string' ? value : String(value ?? '')
}

function truncate(value, max) {
  const source = text(value)
  if (source.length <= max) return source
  return `${source.slice(0, max)}\n[truncated: ${source.length - max} more characters]`
}

function readCollected(reader) {
  if (reader === undefined || reader === null) return { text: '', truncated: false }
  let result
  try {
    result = typeof reader.readFrom === 'function' ? reader.readFrom(0) : reader
  } catch {
    return { text: '', truncated: true }
  }
  if (typeof result === 'string') return { text: result, truncated: false }
  return {
    text: text(result?.text ?? result?.content ?? ''),
    truncated: result?.truncated === true || result?.lossy === true,
  }
}

function deadline(signal, timeoutMs) {
  const controller = new AbortController()
  const abort = (reason) => {
    if (!controller.signal.aborted) controller.abort(reason)
  }
  const timer = setTimeout(() => abort(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs)
  const onAbort = () => abort(signal?.reason)
  if (signal !== undefined) {
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer)
      if (signal !== undefined) signal.removeEventListener('abort', onAbort)
    },
  }
}

/** Run one command with no shell, collecting both streams. */
async function run(ctx, argv, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const guard = deadline(options.signal, timeoutMs)
  try {
    const executable = await ctx.subprocess.resolveExecutable(argv[0])
    const handle = ctx.subprocess.spawn({
      argv: [executable, ...argv.slice(1)],
      cwd: options.cwd ?? HOME,
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: options.maxBytes ?? MAX_OUTPUT_BYTES },
        stderr: { maxBytes: STDERR_BYTES },
      },
      graceMs: 5000,
      signal: guard.signal,
    })
    const outcome = await handle.done
    const stdout = readCollected(handle.collected?.stdout)
    const stderr = readCollected(handle.collected?.stderr)
    return {
      code: outcome?.exitCode ?? null,
      stdout: stdout.text,
      stderr: stderr.text,
      truncated: stdout.truncated,
    }
  } finally {
    guard.dispose()
  }
}

function register(ctx, definition) {
  return ctx.tools.register(definition)
}

function textOutput(summary, schema) {
  return {
    schema: schema ?? { type: 'object', additionalProperties: true },
    render: (_args, value) => [{ type: 'text', text: summary(value) }],
  }
}

// ── Zotero ──────────────────────────────────────────────────────────────────

/**
 * Run one zotero-cli invocation and unwrap its JSON envelope. Failures are
 * reported from the envelope's own error, which is more precise than the exit
 * code alone.
 */
async function zotero(ctx, config, argv, options) {
  const result = await run(ctx, [config.zoteroCommand, '--json', ...argv], options)
  let envelope
  try {
    envelope = JSON.parse(result.stdout)
  } catch {
    const detail = truncate(result.stderr.trim() || result.stdout.trim(), 400)
    throw new Error(
      `${config.zoteroCommand} did not print a JSON envelope (exit ${result.code}). ${detail || 'No output.'}`,
    )
  }
  if (envelope?.ok === false) {
    const error = envelope.error ?? {}
    throw new Error(
      `${config.zoteroCommand} ${argv[0]} failed: ${error.message ?? 'unknown error'}${
        typeof error.code === 'string' ? ` [${error.code}]` : ''
      }`,
    )
  }
  return envelope?.data ?? {}
}

const ITEM_FIELDS = ['key', 'citekey', 'itemType', 'title', 'date', 'doi', 'url', 'publication', 'library']

function projectItem(item) {
  if (item === null || typeof item !== 'object') return { title: text(item) }
  const projected = {}
  for (const field of ITEM_FIELDS) {
    if (item[field] === undefined || item[field] === null) continue
    projected[field] = field === 'title' ? truncate(item[field], 300) : item[field]
  }
  if (Array.isArray(item.creators)) {
    projected.creators = item.creators
      .map((creator) => creator?.lastName ?? creator?.name ?? creator?.firstName ?? '')
      .filter((name) => name !== '')
      .slice(0, 8)
  }
  if (item.abstract !== undefined) projected.abstract = truncate(item.abstract, 1200)
  if (Array.isArray(item.tags)) {
    projected.tags = item.tags.map((tag) => (typeof tag === 'string' ? tag : tag?.tag ?? '')).filter(Boolean).slice(0, 12)
  }
  return projected
}

function describeItem(item, index) {
  const creators = Array.isArray(item.creators) ? item.creators.join(', ') : ''
  const line = [item.date, creators, item.publication].filter((part) => part !== undefined && part !== '').join(' · ')
  const parts = [`${index + 1}. ${item.title ?? '(untitled)'}`]
  if (line !== '') parts.push(`   ${truncate(line, 220)}`)
  if (item.doi) parts.push(`   doi:${item.doi}`)
  if (Array.isArray(item.tags) && item.tags.length > 0) parts.push(`   tags: ${item.tags.join(', ')}`)
  if (item.abstract) parts.push(`   abstract: ${truncate(item.abstract, 600)}`)
  parts.push(`   key: ${item.key ?? item.citekey ?? '?'}`)
  return parts.join('\n')
}

function describeItems(items) {
  if (!Array.isArray(items) || items.length === 0) return 'No matching Zotero items.'
  return items.map(describeItem).join('\n\n')
}

function registerZoteroTools(ctx, config) {
  register(ctx, {
    name: 'zotero_search',
    description:
      'Search the Zotero library and return matching items with the item keys that zotero_item and zotero_read take.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search text; in tag mode a comma-separated tag list, in citekey mode a citekey.',
        },
        mode: {
          type: 'string',
          enum: ['items', 'semantic', 'citekey', 'tag', 'notes'],
          description: 'Matching strategy. Defaults to items (title, creator, year).',
        },
        detail: {
          type: 'string',
          enum: ['keys_only', 'summary', 'full'],
          description: 'How much of each item to return. Defaults to summary, which adds creators, DOI, tags and the abstract.',
        },
        collection: { type: 'string', description: 'Restrict the search to one collection key.' },
        limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Maximum items to return. Defaults to 10.' },
        allLibraries: { type: 'boolean', description: 'Search every accessible library instead of the active one.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    output: textOutput(
      (value) => describeItems(value?.items),
      {
        type: 'object',
        properties: { items: { type: 'array', items: { type: 'object' } }, count: { type: 'integer' } },
        required: ['items'],
        additionalProperties: true,
      },
    ),
    async execute(args, exec) {
      const argv = [
        'search',
        args.query,
        '--mode',
        args.mode ?? 'items',
        '--detail',
        args.detail ?? 'summary',
        '--limit',
        String(args.limit ?? 10),
      ]
      if (args.collection) argv.push('--collection', args.collection)
      if (args.allLibraries === true) argv.push('--all-libraries')
      const data = await zotero(ctx, config, argv, { signal: exec?.signal, timeoutMs: config.timeoutMs })
      const items = Array.isArray(data.items) ? data.items.map(projectItem) : []
      return { items, count: items.length }
    },
  })

  register(ctx, {
    name: 'zotero_item',
    description: 'Read one Zotero item: its metadata, its PDF full text, its child attachments and notes, or its BibTeX entry.',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Zotero item key, as returned by zotero_search.' },
        include: {
          type: 'string',
          enum: ['metadata', 'fulltext', 'children', 'bibtex'],
          description: 'Which part of the item to read. Defaults to metadata.',
        },
        maxChars: {
          type: 'integer',
          minimum: 500,
          maximum: 60000,
          description: 'Cap for returned text. Defaults to 12000. Raising it is worth it only for full text you will quote.',
        },
      },
      required: ['key'],
      additionalProperties: false,
    },
    output: textOutput((value) => value?.text ?? 'No content returned.'),
    async execute(args, exec) {
      const maxChars = args.maxChars ?? 12000
      const options = { signal: exec?.signal, timeoutMs: config.timeoutMs }
      if (args.include === 'fulltext') {
        const data = await zotero(ctx, config, ['get', 'fulltext', args.key], options)
        return { text: truncate(data.text, maxChars) }
      }
      if (args.include === 'children') {
        const data = await zotero(ctx, config, ['get', 'children', args.key], options)
        const items = Array.isArray(data.items) ? data.items.map(projectItem) : []
        if (items.length === 0) return { text: 'This item has no attachments or notes.' }
        return { text: items.map((item, index) => describeItem(item, index)).join('\n\n') }
      }
      if (args.include === 'bibtex') {
        const data = await zotero(ctx, config, ['get', 'bibtex', args.key], options)
        return { text: truncate(data.bibtex ?? data.text, maxChars) }
      }
      const data = await zotero(ctx, config, ['get', 'metadata', args.key], options)
      return { text: truncate(JSON.stringify(projectItem(data), null, 2), maxChars) }
    },
  })

  register(ctx, {
    name: 'zotero_read',
    description: "Read a page range from an item's PDF, which is more precise than its extracted full text for equations and figures.",
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Zotero item key of the paper.' },
        startPage: { type: 'integer', minimum: 1, description: 'First page to read, 1-based.' },
        endPage: { type: 'integer', minimum: 1, description: 'Last page to read; defaults to startPage.' },
        maxChars: { type: 'integer', minimum: 500, maximum: 60000, description: 'Cap for returned text. Defaults to 12000.' },
      },
      required: ['key', 'startPage'],
      additionalProperties: false,
    },
    output: textOutput((value) => value?.text ?? 'No content returned.'),
    async execute(args, exec) {
      const argv = ['read', args.key, '--start-page', String(args.startPage)]
      if (args.endPage !== undefined) argv.push('--end-page', String(args.endPage))
      const data = await zotero(ctx, config, argv, { signal: exec?.signal, timeoutMs: config.timeoutMs })
      return { text: truncate(data.text, args.maxChars ?? 12000) }
    },
  })

  register(ctx, {
    name: 'zotero_library',
    description: 'Survey the Zotero library: its collections, its tags, or the most recently added items.',
    parameters: {
      type: 'object',
      properties: {
        view: {
          type: 'string',
          enum: ['collections', 'tags', 'recent'],
          description: 'What to list. Defaults to collections.',
        },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Maximum entries for the recent view. Defaults to 20.' },
      },
      additionalProperties: false,
    },
    output: textOutput((value) => value?.text ?? 'Nothing to report.'),
    async execute(args, exec) {
      const options = { signal: exec?.signal, timeoutMs: config.timeoutMs }
      const view = args.view ?? 'collections'
      if (view === 'tags') {
        const data = await zotero(ctx, config, ['get', 'tags'], options)
        const tags = Array.isArray(data.tags) ? data.tags : []
        return { text: tags.length === 0 ? 'No tags.' : tags.slice(0, 200).map((tag) => (typeof tag === 'string' ? tag : tag?.tag ?? String(tag))).join(', ') }
      }
      if (view === 'recent') {
        const data = await zotero(ctx, config, ['get', 'recent', '--limit', String(args.limit ?? 20)], options)
        const items = Array.isArray(data.items) ? data.items.map(projectItem) : []
        return { text: describeItems(items) }
      }
      const data = await zotero(ctx, config, ['get', 'collections'], options)
      const collections = Array.isArray(data.collections) ? data.collections : []
      if (collections.length === 0) return { text: 'No collections.' }
      return {
        text: collections
          .map((collection) => {
            const name = collection?.name ?? collection?.title ?? '(unnamed)'
            const count = collection?.numItems ?? collection?.itemCount
            const key = collection?.key ?? '?'
            return `${name}${count === undefined ? '' : ` (${count} items)`}\n   key: ${key}`
          })
          .join('\n'),
      }
    },
  })
}

// ── Neovim ──────────────────────────────────────────────────────────────────

function vimString(value) {
  return `"${text(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

async function nvimEval(ctx, config, expression, signal) {
  const socket = config.nvimSocket
  if (!fs.existsSync(socket)) {
    throw new Error(`Neovim is not listening on ${socket}. Start it with: nvim --listen ${socket}`)
  }
  const result = await run(ctx, [config.nvimCommand, '--server', socket, '--remote-expr', expression], {
    signal,
    timeoutMs: NVIM_TIMEOUT_MS,
    maxBytes: 2 * 1024 * 1024,
  })
  if (result.code !== 0) {
    const detail = truncate(result.stderr.trim(), 300)
    throw new Error(`nvim --remote-expr failed (exit ${result.code}).${detail === '' ? '' : ` ${detail}`}`)
  }
  return result.stdout.trim()
}

function registerNeovimTools(ctx, config) {
  register(ctx, {
    name: 'nvim_context',
    description:
      'Read what the user has open in their running Neovim: the file, the cursor position, the surrounding lines, and their last visual selection. Use it before answering questions about "this" file or line.',
    parameters: {
      type: 'object',
      properties: {
        lines: {
          type: 'integer',
          minimum: 0,
          maximum: 400,
          description: 'How many lines of the buffer to return around the cursor. Defaults to 40; 0 returns none.',
        },
      },
      additionalProperties: false,
    },
    output: textOutput((value) => value?.text ?? 'No Neovim context.'),
    async execute(args, exec) {
      const around = args.lines ?? 40
      const half = Math.floor(Math.max(0, around) / 2)
      const expression =
        `json_encode({'file': expand('%:p'), 'line': line('.'), 'col': col('.'), 'filetype': &filetype,` +
        ` 'modified': &modified, 'total': line('$'), 'selection': getreg('v'),` +
        ` 'around': getline(max([1, line('.') - ${half}]), min([line('$'), line('.') + ${half}]))})`
      const raw = await nvimEval(ctx, config, expression, exec?.signal)
      let state
      try {
        state = JSON.parse(raw)
      } catch {
        throw new Error(`Could not read Neovim state: ${truncate(raw, 200)}`)
      }
      if (typeof state.file !== 'string' || state.file === '') {
        return { text: 'Neovim is running but the current buffer has no file name.' }
      }
      const parts = [
        `File: ${state.file}`,
        `Cursor: line ${state.line}, column ${state.col}, of ${state.total} lines${state.modified ? ' (buffer modified)' : ''}`,
      ]
      if (typeof state.filetype === 'string' && state.filetype !== '') parts.push(`Filetype: ${state.filetype}`)
      if (typeof state.selection === 'string' && state.selection.trim() !== '') {
        parts.push('', 'Last visual selection:', truncate(state.selection, 2000))
      }
      if (Array.isArray(state.around) && state.around.length > 0) {
        const from = Math.max(1, (state.line ?? 1) - half)
        parts.push('', 'Buffer around the cursor:', ...state.around.map((line, index) => `${from + index}\t${line}`))
      }
      return { text: parts.join('\n') }
    },
  })

  register(ctx, {
    name: 'nvim_open',
    description: "Open a file in the user's running Neovim, optionally at a line. Use it to show the user the code or document a result refers to.",
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File to open; absolute, or relative to the workspace directory.' },
        line: { type: 'integer', minimum: 1, description: 'Line to move the cursor to.' },
      },
      required: ['path'],
      additionalProperties: false,
    },
    output: textOutput((value) => value?.text ?? 'Opened.'),
    async execute(args, exec) {
      const target = args.path.startsWith('/') ? args.path : `${process.cwd()}/${args.path}`
      const move = args.line === undefined ? '' : ` . ' | normal! ' . ${Number(args.line)} . 'G'`
      const expression = `execute('edit ' . fnameescape(${vimString(target)})${move})`
      await nvimEval(ctx, config, expression, exec?.signal)
      return { text: `Opened ${target} in Neovim${args.line === undefined ? '' : ` at line ${args.line}`}.` }
    },
  })
}

// ── Scholarly search provider ───────────────────────────────────────────────

const ENTITIES = [
  [/&amp;/g, '&'],
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&quot;/g, '"'],
  [/&#39;/g, "'"],
  [/&nbsp;/g, ' '],
]

function decodeEntities(value) {
  let output = text(value)
  for (const [pattern, replacement] of ENTITIES) output = output.replace(pattern, replacement)
  return output
}

function openAlexSnippet(work) {
  const authors = Array.isArray(work.authorships)
    ? work.authorships
        .map((authorship) => authorship?.author?.display_name ?? '')
        .filter((name) => name !== '')
        .slice(0, 3)
    : []
  const venue = work.primary_location?.source?.display_name ?? work.host_venue?.display_name ?? ''
  const cited = work.cited_by_count === undefined ? '' : `cited by ${work.cited_by_count}`
  const bits = [authors.join(', '), venue, work.type, cited].filter((part) => typeof part === 'string' && part !== '')
  return bits.join(' · ')
}

const SCHOLAR_USER_AGENT = 'dsh-research-tools/1.0 (DeepSeek Harness scholarly search provider)'

function scholarlyLimit(request) {
  return Math.min(Math.max(request.maxResults ?? 8, 1), 25)
}

async function fetchJson(url, signal) {
  const response = await fetch(url, {
    signal,
    headers: { accept: 'application/json', 'user-agent': SCHOLAR_USER_AGENT },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

function doiUrl(doi, fallback) {
  const trimmed = text(doi).replace(/^https?:\/\/doi\.org\//, '')
  if (trimmed !== '') return `https://doi.org/${trimmed}`
  return typeof fallback === 'string' && fallback !== '' ? fallback : undefined
}

/** OpenAlex: broad coverage, generous limits, no key. */
async function searchOpenAlex(request, config, signal) {
  const url = new URL('https://api.openalex.org/works')
  url.searchParams.set('search', request.query)
  url.searchParams.set('per-page', String(scholarlyLimit(request)))
  if (config.openalexMailto !== '') url.searchParams.set('mailto', config.openalexMailto)
  const payload = await fetchJson(url, signal)
  const sources = []
  for (const work of Array.isArray(payload?.results) ? payload.results : []) {
    const target = doiUrl(work?.doi, work?.id)
    if (target === undefined) continue
    sources.push({
      url: target,
      title: decodeEntities(work?.title ?? work?.display_name ?? ''),
      snippet: openAlexSnippet(work ?? {}),
      publishedAt: typeof work?.publication_date === 'string' ? work.publication_date : undefined,
    })
  }
  return sources
}

function crossrefSnippet(item) {
  const authors = Array.isArray(item.author)
    ? item.author
        .map((author) => author?.family ?? author?.name ?? '')
        .filter((name) => name !== '')
        .slice(0, 3)
    : []
  const venue = Array.isArray(item['container-title']) ? item['container-title'][0] ?? '' : item['container-title'] ?? ''
  const cited = item['is-referenced-by-count'] === undefined ? '' : `cited by ${item['is-referenced-by-count']}`
  return [authors.join(', '), venue, item.type, cited].filter((part) => typeof part === 'string' && part !== '').join(' · ')
}

function crossrefPublished(item) {
  const parts = item?.issued?.['date-parts']?.[0] ?? item?.published?.['date-parts']?.[0]
  if (!Array.isArray(parts) || parts.length === 0) return undefined
  return parts.map((part, index) => (index === 0 ? String(part) : String(part).padStart(2, '0'))).join('-')
}

/** Crossref: the fallback when OpenAlex rate-limits or has no answer. */
async function searchCrossref(request, config, signal) {
  const url = new URL('https://api.crossref.org/works')
  url.searchParams.set('query', request.query)
  url.searchParams.set('rows', String(scholarlyLimit(request)))
  if (config.openalexMailto !== '') url.searchParams.set('mailto', config.openalexMailto)
  const payload = await fetchJson(url, signal)
  const sources = []
  for (const item of Array.isArray(payload?.message?.items) ? payload.message.items : []) {
    const target = doiUrl(item?.DOI, item?.URL)
    if (target === undefined) continue
    const title = Array.isArray(item?.title) ? item.title[0] ?? '' : item?.title ?? ''
    sources.push({
      url: target,
      title: decodeEntities(title),
      snippet: crossrefSnippet(item ?? {}),
      publishedAt: crossrefPublished(item ?? {}),
    })
  }
  return sources
}

/**
 * One scholarly search provider fronting several backends. The pinned provider
 * id is `scholar`; backends are tried in order so a rate limit or an empty
 * index degrades to the next instead of failing the search.
 */
function registerScholarProvider(ctx, config) {
  // Optional service: wait for it when it is merely late to mount, and warn
  // when the composition really has no web service at all.
  if (typeof ctx.inject === 'function') {
    ctx.inject(['web'], (scope) => registerScholarOn(scope, config))
    return
  }
  registerScholarOn(ctx, config)
}

function registerScholarOn(ctx, config) {
  const web = ctx.get('web')
  if (web === undefined) {
    ctx.logger?.warn?.('research-tools: ctx.web is absent, so scholarly search is not registered')
    return
  }
  web.registerSearchProvider({
    id: 'scholar',
    available: () => true,
    async search(request, signal) {
      const backends = [
        ['OpenAlex', searchOpenAlex],
        ['Crossref', searchCrossref],
      ]
      const failures = []
      for (const [label, backend] of backends) {
        try {
          const sources = await backend(request, config, signal)
          if (sources.length > 0) return { sources, truncated: false }
          failures.push(`${label}: no results`)
        } catch (error) {
          if (signal?.aborted) throw error
          failures.push(`${label}: ${error?.message ?? String(error)}`)
        }
      }
      throw new Error(`Scholarly search found nothing (${failures.join('; ')}).`)
    },
  })
}

// ── Research context ────────────────────────────────────────────────────────

let contextCache = { path: '', mtimeMs: -1, text: '' }

function readContextFile(file, maxChars) {
  const stat = fs.statSync(file)
  if (contextCache.path !== file || contextCache.mtimeMs !== stat.mtimeMs) {
    contextCache = { path: file, mtimeMs: stat.mtimeMs, text: fs.readFileSync(file, 'utf8') }
  }
  return truncate(contextCache.text.trim(), maxChars)
}

function registerResearchContext(ctx, config) {
  if (typeof ctx.inject === 'function') {
    ctx.inject(['systemPrompt'], (scope) => registerResearchContextOn(scope, config))
    return
  }
  registerResearchContextOn(ctx, config)
}

function registerResearchContextOn(ctx, config) {
  const systemPrompt = ctx.get('systemPrompt')
  if (systemPrompt === undefined) {
    ctx.logger?.warn?.('research-tools: ctx.systemPrompt is absent, so the research context is not injected')
    return
  }
  systemPrompt.context({
    name: 'research-context',
    order: config.contextOrder,
    required: false,
    text: () => {
      try {
        const body = readContextFile(config.contextFile, config.contextMaxChars)
        return body === '' ? '' : `Standing research context for this user:\n\n${body}`
      } catch (error) {
        if (error?.code === 'ENOENT') return ''
        ctx.logger?.warn?.(`research-tools: cannot read ${config.contextFile}: ${error?.message ?? error}`)
        return ''
      }
    },
  })
}

// ── entry point ─────────────────────────────────────────────────────────────

export function apply(ctx, config) {
  const settings = withDefaults(config)
  registerZoteroTools(ctx, settings)
  registerNeovimTools(ctx, settings)
  registerScholarProvider(ctx, settings)
  registerResearchContext(ctx, settings)
  ctx.logger?.info?.(
    `research-tools active (zotero: ${settings.zoteroCommand}, neovim socket: ${settings.nvimSocket}, context: ${settings.contextFile})`,
  )
}
