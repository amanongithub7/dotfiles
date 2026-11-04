# research-tools

A DeepSeek Harness bundle with the research plumbing this profile uses. One
plugin row, four capabilities, each failing on its own.

| Capability | Surface | Backed by |
|---|---|---|
| Zotero library | `zotero_search`, `zotero_item`, `zotero_read`, `zotero_library` | the `zotero-cli` command |
| Neovim bridge | `nvim_context`, `nvim_open` | `nvim --server <socket> --remote-expr` |
| Scholarly search | the `web_search` tool, through `ctx.web` | the OpenAlex API |
| Research context | every turn's prompt | `../research-context.md` |

## Install

```bash
# from a Harness session with Creator mode (or the Plugins page)
plugin_manager { action: install_bundle, target: "~/dotfiles/dsh/plugins/research-tools" }
```

The row is `research-tools`; disable it with `set_plugin`.

## Configuration

`cordis.patch.yml` restates the defaults; change them there and reinstall the
bundle. Without an explicit `Config` export the row's `config` is passed
through unvalidated, so an unknown key is ignored and a typo falls back to the
default rather than failing activation.

| Key | Default | Meaning |
|---|---|---|
| `zoteroCommand` | `zotero-cli` | The CLI to run; a bare name resolves on `PATH` |
| `nvimCommand` | `nvim` | The client used to reach the server |
| `nvimSocket` | `~/.cache/nvim/dsh.sock` | Address of the running Neovim |
| `contextFile` | `~/dotfiles/dsh/research-context.md` | Standing context injected into every turn |
| `contextMaxChars` | `1600` | Cap on that file's contribution |
| `contextOrder` | `9000` | Where the block sorts among runtime context |
| `openalexMailto` | unset | Contact address for the OpenAlex polite pool |
| `timeoutMs` | `120000` | Per-command deadline |

### Scholarly search

The provider registers as `openalex` and is **not** pinned, because pinning
happens in the `web` row this bundle does not own. If the DeepSeek provider is
also usable and no provider id is configured, `ctx.web` answers
`WEB_PROVIDER_AMBIGUOUS`. To pin it, add to the profile patch:

```yaml
- id: web
  config:
    searchProvider: openalex
```

`fetchProvider` is deliberately untouched: this bundle registers no fetch
provider, so the shipped HTTP fetcher keeps auto-selecting.

### Neovim

The bridge needs a listening server. `nvim/lua/config/harness-bridge.lua` in
this dotfiles repo starts one at `~/.cache/nvim/dsh.sock` on every launch, which
is the default `nvimSocket`. Without it, `nvim_context` says so and tells you
the `nvim --listen` command instead of failing obscurely.

## Deliberately read-only

Nothing here writes to the Zotero library or to a Neovim buffer. Zotero writes
need the CLI's local write authorization (`zotero-mcp authorize-local`, Zotero
10+), which is a separate decision; pushing edits into a live buffer needs an
undo-safe strategy. Both are recorded in `../../ideas/plugin-backlog.md`.

## Verification

```bash
node --check index.js                      # syntax
zotero-cli --json config                   # the CLI answers
zotero-cli get recent --limit 3            # the library is reachable
```

Then, from a session: `zotero_search`, `nvim_context`, and a `web_search` that
returns OpenAlex sources.
