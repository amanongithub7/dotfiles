/**
 * Superpowers skill-ID alias fix.
 *
 * Superpowers (plugin `superpowers@git+https://github.com/obra/superpowers.git`)
 * registers each skill under its bare directory name — `brainstorming`,
 * `systematic-debugging`, and so on. But the text it injects into the first
 * user message of every top-level session, and the cross-references inside its
 * own skill bodies, use the Claude Code plugin-namespace form:
 * `superpowers:brainstorming`.
 *
 * OpenCode resolves skill IDs by exact match, so those references fail with
 * "Unable to load skill superpowers:brainstorming". The agent is told to load
 * skills that cannot be found.
 *
 * This plugin registers a hidden alias for every Superpowers skill under its
 * namespaced ID so the references resolve. Aliases carry no `description`,
 * which means OpenCode never advertises them to the model — they cost no
 * prompt tokens and add no duplicate entries to the skill catalog. They are
 * loadable only by explicit ID, which is exactly how Superpowers refers to
 * them.
 *
 * Reading the filesystem rather than `draft.list()` keeps this independent of
 * plugin load order, so it does not matter whether this plugin's transform
 * runs before or after Superpowers' own.
 *
 * If Superpowers ever fixes this itself (a prefix-normalisation rule in
 * V2_MAPPING), this plugin becomes redundant and can be deleted: it is a
 * no-op once the bare and namespaced IDs both resolve.
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const NAMESPACE = "superpowers"
const CACHE = path.join(os.homedir(), ".cache", "opencode", "npm")

function parseSkillFile(file) {
  const raw = fs.readFileSync(file, "utf8")
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { name: null, content: raw }
  const name = match[1].match(/^name:\s*(.+)$/m)
  return {
    name: name ? name[1].trim().replace(/^["']|["']$/g, "") : null,
    content: match[2],
  }
}

function collect(skillsDir, found) {
  let entries
  try {
    entries = fs.readdirSync(skillsDir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue
    const file = path.join(skillsDir, entry.name, "SKILL.md")
    if (!fs.existsSync(file)) continue
    try {
      const { name, content } = parseSkillFile(file)
      found.set(entry.name, { name: name ?? entry.name, path: file, content })
    } catch {
      /* unreadable skill — skip */
    }
  }
}

function findSuperpowersSkills() {
  const found = new Map()

  let roots
  try {
    roots = fs
      .readdirSync(CACHE, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith("git-superpowers-"))
      .map((e) => path.join(CACHE, e.name))
  } catch {
    return found
  }

  const visit = (dir, depth) => {
    if (depth > 6) return
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const full = path.join(dir, entry.name)
      if (entry.name === "superpowers") {
        collect(path.join(full, "skills"), found)
        continue
      }
      visit(full, depth + 1)
    }
  }

  for (const root of roots) visit(root, 0)
  return found
}

export default {
  id: "superpowers-skill-aliases",
  async setup(ctx) {
    if (!ctx?.skill || typeof ctx.skill.transform !== "function") return

    const skills = findSuperpowersSkills()
    if (skills.size === 0) return

    await ctx.skill.transform((draft) => {
      // If the host (or a future Superpowers release) already registers the
      // namespaced ID, leave it alone. Makes this plugin a no-op once the
      // underlying problem is fixed upstream.
      let existing = new Set()
      try {
        existing = new Set((draft.list() ?? []).map((s) => s?.id))
      } catch {
        /* list() unavailable — fall through and let add() decide */
      }

      for (const [id, skill] of skills) {
        if (existing.has(`${NAMESPACE}:${id}`)) continue
        try {
          draft.add({
            id: `${NAMESPACE}:${id}`,
            name: skill.name,
            path: skill.path,
            content: skill.content,
            autoinvoke: false,
          })
        } catch (err) {
          console.error(`[superpowers-aliases] cannot register ${NAMESPACE}:${id}:`, err)
        }
      }
    })
  },
}
