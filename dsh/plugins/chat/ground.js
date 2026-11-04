/**
 * Grounding for the Chat panel: a Tavily web search driven through the `tvly`
 * CLI, and text extraction from an uploaded file.
 *
 * The subprocess pattern is the one already proven in the research-tools
 * plugin: resolve the executable, spawn without a shell, collect bounded
 * stdout/stderr, and abort on a deadline.
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const MAX_OUTPUT_BYTES = 4_000_000
const STDERR_BYTES = 16_384
const DEFAULT_TIMEOUT_MS = 60_000

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'rst', 'org', 'tex', 'bib', 'csv', 'tsv', 'json',
  'yaml', 'yml', 'toml', 'ini', 'cfg', 'log', 'py', 'r', 'jl', 'm', 'sh',
  'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'html', 'css', 'xml', 'sql', 'ipynb',
])

function text(value) {
  return typeof value === 'string' ? value : String(value ?? '')
}

/**
 * A service is reachable as `ctx.<name>` only when it is injected, so it is read
 * both ways: an unneeded injection must not stop the plugin from loading in a
 * profile that has no such service.
 */
function service(ctx, name) {
  return ctx?.[name] ?? ctx?.get?.(name)
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

export async function run(ctx, argv, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const subprocess = service(ctx, 'subprocess')
  if (subprocess?.spawn === undefined) throw new Error('this profile has no subprocess service')
  const guard = deadline(options.signal, timeoutMs)
  try {
    const executable = await subprocess.resolveExecutable(argv[0])
    const handle = subprocess.spawn({
      argv: [executable, ...argv.slice(1)],
      cwd: options.cwd ?? process.env.HOME ?? process.cwd(),
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
      truncated: stdout.truncated || stderr.truncated,
    }
  } finally {
    guard.dispose()
  }
}

/** PATH is not guaranteed to hold a uv-installed tool, so known spots are tried. */
async function resolveCommand(ctx, command, extraPaths = []) {
  const candidates = [
    ...extraPaths,
    path.join(process.env.HOME ?? '', '.local', 'bin', command),
    path.join('/opt/homebrew/bin', command),
    path.join('/usr/local/bin', command),
  ]
  try {
    const resolved = await service(ctx, 'subprocess')?.resolveExecutable?.(command)
    if (resolved !== null && resolved !== undefined) return resolved
  } catch {
    // fall through to the explicit paths
  }
  for (const candidate of candidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      // try the next one
    }
  }
  return null
}

export async function resolveTavily(ctx, settings) {
  return resolveCommand(ctx, settings.tvlyCommand, settings.tvlyPaths ?? [])
}

export function describeSearch(results) {
  if (results.length === 0) return ''
  const lines = results.map((result, index) => `[${index + 1}] ${result.title}\n${result.url}\n${result.snippet}`)
  return lines.join('\n\n')
}

/**
 * Why a `tvly` run failed. It reports its own failures as JSON on stdout with a
 * non-zero exit code and an empty stderr, so stdout is read first: the message
 * there is the actionable one ("Too many keyless requests ... run tvly login").
 */
function describeFailure(result) {
  try {
    const payload = JSON.parse(result.stdout)
    const message = text(payload?.error?.message) || text(payload?.message)
    if (message !== '') return message.split('\n')[0]
  } catch {
    // not JSON; fall back to stderr
  }
  return result.stderr.trim().split('\n')[0] || `exited with code ${result.code}`
}

/**
 * One Tavily search. Failures are returned, not thrown, so a chat can carry on
 * without grounding and say why.
 */
export async function tavilySearch(ctx, settings, query, signal) {
  const executable = await resolveTavily(ctx, settings)
  if (executable === null) {
    return { ok: false, reason: `the ${settings.tvlyCommand} command was not found` }
  }
  const argv = [
    executable, 'search', query, '--json',
    '--max-results', String(settings.webResults),
    '--depth', settings.webDepth,
  ]
  let result
  try {
    result = await run(ctx, argv, { signal, timeoutMs: settings.webTimeoutMs })
  } catch (error) {
    return { ok: false, reason: `the search could not run: ${text(error?.message ?? error)}` }
  }
  if (result.code !== 0) {
    return { ok: false, reason: describeFailure(result) }
  }
  let payload
  try {
    payload = JSON.parse(result.stdout)
  } catch {
    return { ok: false, reason: `${settings.tvlyCommand} did not return JSON` }
  }
  const raw = Array.isArray(payload?.results) ? payload.results : []
  const results = raw.slice(0, settings.webResults).map((entry) => ({
    title: text(entry?.title) || text(entry?.url),
    url: text(entry?.url),
    snippet: text(entry?.content),
    score: typeof entry?.score === 'number' ? entry.score : null,
  }))
  return {
    ok: true,
    query: text(payload?.query) || query,
    answer: text(payload?.answer),
    results,
  }
}

/**
 * Extract what a model can read from an uploaded file. PDFs go through
 * `pdftotext`; text files are read directly; anything else is declared instead
 * of guessed at.
 */
export async function extractFile(ctx, settings, file) {
  const name = text(file?.name) || 'file'
  const mime = text(file?.mime)
  const location = text(file?.path)
  const extension = path.extname(name).replace('.', '').toLowerCase()
  const isPdf = mime === 'application/pdf' || extension === 'pdf'
  const isText = mime.startsWith('text/') || TEXT_EXTENSIONS.has(extension)

  if (location === '' || file?.bytes === 0) {
    return { text: '', note: `${name}: the upload is empty` }
  }
  if (isText) {
    try {
      const body = await fs.readFile(location, 'utf8')
      return { text: cap(body, settings), note: '' }
    } catch (error) {
      return { text: '', note: `${name}: could not be read (${text(error?.message ?? error)})` }
    }
  }
  if (isPdf) {
    const executable = await resolveCommand(ctx, 'pdftotext')
    if (executable === null) return { text: '', note: `${name}: pdftotext is not installed, so the PDF text was not extracted` }
    let result
    try {
      result = await run(ctx, [executable, location, '-'], { timeoutMs: settings.fileTimeoutMs })
    } catch (error) {
      return { text: '', note: `${name}: pdftotext failed (${text(error?.message ?? error)})` }
    }
    if (result.code !== 0) {
      return { text: '', note: `${name}: pdftotext exited with code ${result.code}` }
    }
    const body = result.stdout.replace(/\f/g, '\n').trim()
    if (body === '') return { text: '', note: `${name}: no extractable text (a scanned PDF needs OCR)` }
    return { text: cap(body, settings), note: '' }
  }
  return { text: '', note: `${name}: ${mime || 'binary'} cannot be read as text` }
}

function cap(body, settings) {
  const limit = settings.fileMaxChars
  if (body.length <= limit) return body
  return `${body.slice(0, limit)}\n[truncated: ${body.length - limit} more characters]`
}
