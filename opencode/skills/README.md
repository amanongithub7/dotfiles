# Skills in this directory

This is `~/.config/opencode/skills` (OpenCode scans it by default). Mostly
hand-written, with a few vendored from upstream.

## Vendored skills

| Skill | Upstream | Pinned to |
| - | - | - |
| `tavily-map`, `tavily-extract`, `tavily-crawl` | [tavily-ai/skills](https://github.com/tavily-ai/skills) | `778122e5f9c680f541eeceda5a5b36405eb7980c` |
| `playwright-cli` | `@playwright/cli` (`playwright-cli install --skills agents --global`) | 0.1.22 |

These are copies, not installs. `npx skills add -g` was deliberately avoided: it
installs to `~/.agents/skills`, outside this repo, and adds a lockfile plus a
telemetry call. The upstream tools still work, but they write to that other
location, so anything they regenerate has to be copied back here.

### tavily-*

Only 3 of the 8 upstream skills are vendored. The rest were left out on purpose:

- `tavily-search` duplicates the built-in `websearch` tool, which is already
  Tavily-backed in `../opencode.jsonc`.
- `tavily-research` overlaps the `deep-research` skill and costs 15-250 credits
  per call.
- `tavily-best-practices` is reference material for *building* Tavily
  integrations, not for using Tavily.
- `tavily-cli` and `tavily-dynamic-search` are an install guide and a context
  helper; not worth the prompt surface.

**Local modifications:** upstream cross-references siblings that are not
installed here. Links to `../tavily-cli/SKILL.md` (setup and workflow) and
`../tavily-search/SKILL.md` were inlined or dropped. Content is otherwise
verbatim.

**Updating:** `tvly update` refreshes the CLI only, not these files. Re-clone
upstream, diff the three `SKILL.md` files, reapply the link fixes.

### playwright-cli

Moved here from `~/.agents/skills/playwright-cli` (now empty), which is the path
`playwright-cli install --skills agents --global` writes to. The whole directory
came across, including `references/`.

**Updating:** re-running that command recreates
`~/.agents/skills/playwright-cli` and would leave you with the skill discovered
twice. After upgrading the CLI, copy the regenerated directory over this one and
delete the `~/.agents/skills/playwright-cli` copy.

The skill depends on `~/.playwright/cli.config.json`, which is also vendored —
see `../../playwright/README.md`.
