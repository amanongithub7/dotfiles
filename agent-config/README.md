# Shared agent configuration

One source of truth for the skills and agent prompts used by both
[OpenCode v2](https://opencode.ai/v2/docs/) and DeepSeek Harness (DSH), so a
skill or a prompt is written once and read by whichever agent is running.

```
agent-config/
├── skills/          # SKILL.md bundles - identical format for both tools
├── agents/          # agent definitions - OpenCode-native markdown
└── dsh/             # the DSH side: agent presets that read agents/*.md
```

## How each tool reaches this directory

Both tools read their own native root; those roots are symlinks into this
directory, so nothing is copied and no config file in either tool points here
directly.

| Tool | Root it scans | How it reaches the source |
|---|---|---|
| OpenCode v2 | `~/.config/opencode/skills` | symlink -> `agent-config/skills` |
| DSH | `~/.dsh/skills` | symlink -> `agent-config/skills` |
| OpenCode v2 | `~/.config/opencode/agents` | symlink -> `agent-config/agents` |
| DSH | - | presets read `agents/<name>.md` at activation (`dsh/`) |

Why not `~/.agents/skills`: OpenCode scans both `~/.config/opencode/skills` and
`~/.agents/skills`, so a shared directory reachable from both roots would
register every skill twice (v2 resolves duplicate IDs by precedence). One root
per tool keeps each ID unique.

## Skills

The two tools agree on the file format, so these files are shared verbatim:

- A skill is a directory `skills/<id>/SKILL.md`, plus any `references/`,
  `scripts/` or assets beside it.
- Frontmatter: `name` and `description` are the portable fields. DSH requires
  `name` to be kebab-case and `description` to be present; OpenCode uses the
  directory name as the skill ID and treats `name` as a display label.
- OpenCode-only keys are ignored by DSH: `allowed-tools`, `license`,
  `compatibility`, `metadata.opencode/autoinvoke`.
- Keep skills **flat** (`skills/<id>/SKILL.md`). DSH discovers only one level
  below the root; OpenCode searches deeper, so a nested `SKILL.md` would load in
  OpenCode and silently not exist in DSH.
- `references/`, `scripts/` and asset subdirectories are fine and expected - the
  one-level rule is about where `SKILL.md` itself may sit.

Adding a skill: create `skills/<id>/SKILL.md`. Both tools pick it up from the
watched root; no config change and no restart. In DSH it appears in the catalog
from the next session step.

## Agents

`agents/<Name>.md` is OpenCode's native agent format: frontmatter
(`description`, `mode`, `model`, `steps`, `permissions[]`) plus a body that is
the system prompt. DSH has no equivalent file format - a DSH agent is a Cordis
plugin composition - so the sharing stops at the prompt body:

- OpenCode reads the whole file.
- DSH reads **only the body**, via `!!js` in `dsh/bundle/cordis.patch.yml`,
  which strips the frontmatter at preset activation. The frontmatter is
  OpenCode-only and is not translated.
- Harness-specific differences live in the preset's `persona.suffix`, not in the
  shared markdown. Keep tool names and permission-scanner references out of the
  shared body where you can, and put the delta in the suffix.

Adding an agent: add `agents/<Name>.md`, then add a matching `preset-<id>`
insert to `dsh/bundle/cordis.patch.yml` whose `persona.prefix` reads that file.
See `dsh/README.md`.

## Known deltas and limits

- **Two formats, one source.** Skills are byte-identical across tools; agent
  prompts share the body only. Per-command shell permissions (`Paper`'s
  `zotero-cli *` allow-list) have no declarative DSH equivalent yet - in DSH that
  enforcement needs a plugin, which is the next phase.
- **Prompt edits reach new sessions only.** A DSH preset revision is activated
  once and retained; sessions that already started keep the prompt they began
  with. OpenCode re-reads on its own schedule.
- **`{{...}}` is a template.** DSH's persona `prefix` resolves `{{var}}` groups
  against registered prompt variables, so a literal `{{` in a shared prompt body
  would be interpreted. `{% ... %}` (Obsidian) is safe.
- **Nothing here is versioned per tool.** The dotfiles repo is the history.

## Related

- `dsh/README.md` - the DSH preset bundle and how to install it.
- `skills/README.md` - provenance of the vendored skills.
