# DSH presets that read the shared agent source

`bundle/` is one DeepSeek Harness bundle that declares two agent presets. Each
preset's persona text is read from `../agents/<name>.md` at activation, so a
prompt edit never has to be copied here.

| Preset id | Roster name | Persona source |
|---|---|---|
| `paper` | Paper | `../agents/Paper.md` |
| `general-assistant` | General Assistant | `../agents/General Assistant.md` |

## How the read works

`persona.prefix` is a `!!js` expression, which the Cordis loader evaluates
against the plugin's context with the real Node globals available (the shipped
`cordis` preset uses the same mechanism to locate its own skills directory). The
expression joins `$HOME`, reads the markdown, strips a leading `---` frontmatter
block, and returns the body. If the file cannot be read the persona text says so
explicitly rather than falling back to a generic prompt.

The body is inserted verbatim, and DSH renders `{{...}}` groups in a persona as
prompt-variable templates - so avoid a literal `{{` in a shared prompt body.

## Install and reinstall

Install from a Creator-mode session:

```
plugin_manager { action: install_bundle, target: "/Users/aman/dotfiles/agent-config/dsh/bundle" }
```

Every `plugin_manager` action needs approval or full access. The profile records
the bundle path, so editing the patch and reinstalling is how preset rows change.
Editing only an `agents/*.md` body needs no reinstall for *new* sessions;
existing sessions keep the preset revision they started with.

## What the presets contain

Both use the same row list, copied from the shipped `standard` preset minus the
plugin-manager and plan-mode rows:

- `persona` - the shared prompt body plus the Harness-specific suffix
- `agent-instructions`, `time-context`
- `tool-bash` / `tool-pwsh` (the unused one is disabled by platform)
- `tool-fs`, `tool-fs-search`, `tool-jobs`, `tool-schedule`
- `skill-filesystem` (default roots, so `~/.dsh/skills` is live) and `tool-skill`
- the `compaction` group and the `delegation` group (subagents, workflow)
- `tool-web`, `tool-ask-user`, `tool-todo`, `tool-goal`, `command-goal`, `present`

Deliberately absent: `tool-plugin-manager` and `tool-plugin-market` (an agent
should not install plugins), and the `planning` group.

Trimming a preset means deleting rows from its `config.plugins` list. A preset's
list is complete on its own - it does not inherit from `standard`, and a DSH
upgrade that changes `standard` does not change these.

## Not expressed yet

`Paper`'s OpenCode permission rules (shell allowed only for `zotero-cli`, with
per-verb `ask`) have no declarative DSH equivalent in a preset. Reproducing them
needs a Host plugin over the tool guard/policy seam, which is the next phase.
