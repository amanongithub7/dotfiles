/**
 * Chat storage for the Chat panel.
 *
 * One JSON file per chat under `<dataDir>/chats`, one raw file plus a small
 * metadata sidecar per upload under `<dataDir>/files`. Writes go to a temp file
 * and are renamed into place, so a crash mid-write cannot leave a half-written
 * chat behind, and a corrupt file is skipped when listing rather than taking the
 * whole panel down.
 *
 * Ids arrive from HTTP request bodies, so every id is validated before it is
 * used in a path.
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

/** Only ids this module generated are accepted back from a request. */
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function defaultDataDir() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(home, 'storages', 'aman-chat')
}

export function newId() {
  return crypto.randomUUID()
}

/** A chat title is the first line of the first prompt, cut to a sane length. */
export function titleFrom(value, max) {
  const line = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (line === '') return 'New chat'
  return line.length <= max ? line : `${line.slice(0, Math.max(1, max - 1)).trimEnd()}…`
}

function safeId(id) {
  const value = String(id ?? '')
  if (!ID_PATTERN.test(value)) throw new Error('invalid chat or file id')
  return value
}

function firstLine(value) {
  const line = String(value ?? '').trim().split('\n')[0]
  return line.length > 300 ? `${line.slice(0, 300)}…` : line
}

export function createStore(dataDir) {
  const chatsDir = path.join(dataDir, 'chats')
  const filesDir = path.join(dataDir, 'files')
  let ready = null

  const ensure = () => {
    if (ready === null) {
      ready = (async () => {
        await fs.mkdir(chatsDir, { recursive: true })
        await fs.mkdir(filesDir, { recursive: true })
      })()
    }
    return ready
  }

  const chatPath = (id) => path.join(chatsDir, `${safeId(id)}.json`)
  const filePath = (id) => path.join(filesDir, safeId(id))
  const metaPath = (id) => path.join(filesDir, `${safeId(id)}.json`)

  async function writeJsonAtomic(target, value) {
    const temporary = `${target}.${crypto.randomUUID()}.tmp`
    await fs.writeFile(temporary, JSON.stringify(value, null, 2), 'utf8')
    await fs.rename(temporary, target)
  }

  async function readJson(target) {
    const raw = await fs.readFile(target, 'utf8')
    return JSON.parse(raw)
  }

  /** Newest first, metadata only: the panel does not need every message. */
  async function list() {
    await ensure()
    const entries = await fs.readdir(chatsDir)
    const chats = []
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue
      try {
        const chat = await readJson(path.join(chatsDir, entry))
        chats.push(summary(chat))
      } catch {
        // A single unreadable file must not hide the rest of the history.
      }
    }
    chats.sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
    return chats
  }

  function summary(chat) {
    const messages = Array.isArray(chat.messages) ? chat.messages : []
    const last = messages[messages.length - 1]
    return {
      id: chat.id,
      title: chat.title ?? 'New chat',
      createdAt: chat.createdAt ?? 0,
      updatedAt: chat.updatedAt ?? 0,
      provider: chat.provider ?? '',
      model: chat.model ?? '',
      messages: messages.length,
      preview: typeof last?.text === 'string' ? firstLine(last.text) : '',
    }
  }

  async function get(id) {
    await ensure()
    try {
      const chat = await readJson(chatPath(id))
      return { ...chat, messages: Array.isArray(chat.messages) ? chat.messages : [] }
    } catch {
      return null
    }
  }

  async function save(chat) {
    await ensure()
    const record = { ...chat, version: 1, updatedAt: Date.now() }
    await writeJsonAtomic(chatPath(record.id), record)
    return record
  }

  async function create(options = {}) {
    const now = Date.now()
    return save({
      id: newId(),
      title: options.title ?? 'New chat',
      createdAt: now,
      updatedAt: now,
      provider: options.provider ?? '',
      model: options.model ?? '',
      messages: [],
    })
  }

  async function remove(id) {
    await ensure()
    try {
      await fs.unlink(chatPath(id))
      return true
    } catch {
      return false
    }
  }

  /** Store uploaded bytes and their metadata; the id is the handle for later. */
  async function putFile(name, mime, bytes) {
    await ensure()
    const id = newId()
    await fs.writeFile(filePath(id), bytes)
    const meta = {
      id,
      name: String(name ?? 'file'),
      mime: String(mime ?? 'application/octet-stream'),
      bytes: bytes.length,
      at: Date.now(),
    }
    await writeJsonAtomic(metaPath(id), meta)
    return meta
  }

  async function getFile(id) {
    await ensure()
    try {
      const meta = await readJson(metaPath(id))
      return { ...meta, path: filePath(id) }
    } catch {
      return null
    }
  }

  /**
   * Record that the panel is talking to the host, and when it last did. The
   * panel calls this on every request, so the write is throttled: a write per
   * request would churn the disk for a diagnostic fact.
   */
  const panelPath = () => path.join(dataDir, 'panel.json')
  let lastTouch = 0

  /**
   * The panel's own small state (which parts of it are folded away) lives beside
   * the beacon, so a reload or a second window opens the way the user left it.
   * Reading never throws: a missing or broken file is just no state.
   */
  async function panel() {
    try {
      const record = await readJson(panelPath())
      return record !== null && typeof record === 'object' ? record : {}
    } catch {
      return {}
    }
  }

  async function savePanel(patch) {
    await ensure()
    const record = { ...(await panel()), ...patch, at: Date.now() }
    await writeJsonAtomic(panelPath(), record)
    return record
  }

  async function touch() {
    const now = Date.now()
    if (now - lastTouch < 30_000) return lastTouch
    lastTouch = now
    try {
      await ensure()
      // Merged, not replaced: the beacon shares its file with the panel state.
      await writeJsonAtomic(panelPath(), { ...(await panel()), at: now })
    } catch {
      // Panel activity is diagnostic; it must never fail a real request.
    }
    return lastTouch
  }

  async function lastSeen() {
    return Number((await panel()).at) || 0
  }

  return { dataDir, chatsDir, filesDir, list, get, save, create, remove, putFile, getFile, summary, touch, lastSeen, panel, savePanel }
}
