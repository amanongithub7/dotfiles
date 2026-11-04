# Harness plugin backlog

Ideas agreed with Aman but **not built yet**, recorded so a later session does
not re-derive them. The extension-point names here were read off the live
runtime, not guessed.

## How to pick one up

A Harness plugin is a bundle installed into the profile with
`plugin_manager { action: install_bundle, target: <package dir> }`; sources live
in `../plugins/<name>/`. Load the `cordis-plugin-development` skill (Creator
mode) before writing one: it prescribes querying the live Service/Event/Slot
contracts with `cordis_inspect_list` / `cordis_inspect_query` first, then
reading the package README that `Config.listConfigs` reports. Presets that read
the shared agent prompts are in `../../agent-config/dsh/bundle/`.

Built so far - see `../plugins/`: the Zotero bridge, the Neovim bridge, the
scholarly search/fetch providers, and the research context injector.

---

## 1. Experiment tracking (W&B / MLflow)

**Goal.** A session answers "what did run 3f2a score, and how does it compare to
baseline" without leaving the conversation, and shows the curve rather than a
wall of numbers.

**Why deferred.** Wants a chart-rendering decision and account specifics first;
the paper and library workflows came first.

**Extension points.** `ctx.tools.register` for read-only `runs` / `run_metrics`
/ `compare_runs` tools; a `tool.call.toolview` occupant keyed on the tool name
for the curve card; data over the local MLflow API or the W&B Python API through
`ctx.subprocess` (the bundled Python already has numpy/pandas).

**First step.** Decide online W&B versus local MLflow, then one read-only tool
that lists recent runs in a default project.

**Open questions.** Default entity/project, how many runs to show, whether to
cache metrics on disk, and where the API key lives (the credentials store, not
the plugin config).

## 2. Climate data catalog

**Goal.** Tools to discover and lightly subset CMIP6 / ERA5 / a STAC or Intake
catalog, with a quick map or timeseries rendered back into the transcript.

**Why deferred.** Depends on where the data actually lives - local scratch, the
HPC filesystem, or cloud object storage.

**Extension points.** Tools over the bundled Python via `ctx.subprocess`
(`load_workspace_dependencies` reports the interpreter and numpy/pandas/Pillow);
plots returned as image attachments in a tool card.

**First step.** A `dataset_info(path)` tool over xarray that reports variables,
dimensions and the time range without loading the data.

**Open questions.** Which catalogs are authoritative for this work, and whether
subsets should be written to the workspace or kept in temp.

## 3. HPC / SLURM

**Goal.** Queue and submit jobs from a session, and see allocations at a glance.

**Why deferred.** Needs cluster hostnames and the SSH setup first.

**Extension points.** Tools over `ssh <host> squeue|sacct|sbatch` via
`ctx.subprocess`; a `sidebar.panellist` entry plus a `main` page for a live
view; the existing jobs seam for long-running submissions.

**First step.** A config list of hosts, then one read-only queue tool.

**Open questions.** Which clusters, whether submissions need a project
allocation flag, and whether job output should stream into a session.

---

## Follow-ups to what is built

- **Zotero writes.** The bridge is read-only on purpose. Adding notes,
  annotations or items needs the CLI's local write authorization
  (`zotero-mcp authorize-local`, Zotero 10+), so that step is a deliberate,
  separately approved change.
- **Neovim edit-back.** The bridge opens files and reads context; pushing edits
  into a live buffer needs an undo-safe strategy before it is worth having.
- **Scholar coverage.** The providers cover what could be verified without an
  API key; PubMed and Semantic Scholar would need keys in the credentials store.

## 0. Chat sidebar panel (host half blocked)

**Goal.** The `Chat` panel: a sidebar entry that queries a provider with no
agent, tools or loop.

**Already built.** The capability itself ships in `../plugins/chat` as the
`chat` tool and the `/chat` command; both call one `ask()`, which streams once
through `ctx.llm` and collects only `text-delta` chunks.

**What blocks the panel.** A dynamic Client half reaches its own Host half only
through the package-private `host.call(method, args)` RPC, and exposing a Host
method needs DSH's `@Remote` decorator. A bundle linked from `~/dotfiles`
cannot resolve `@deepseek-ai/dsh-*`: Node resolves imports from the package's
real path, the profile's `node_modules` holds only the linked bundles, and npm
publishes those packages at `0.0.1-rc.1` while this Harness runs `0.2.1-rc.5`.

**Unblocks, in order of preference.**

1. Give the bundle a `node_modules` whose `@deepseek-ai/*` point at a source
   checkout of the same version.
2. A Harness seam that exposes a Host method to its Client half without the
   decorator.
3. Develop the bundle inside a DSH source checkout.

The page half is ready to write: `main` is keyed by sidebar entry id, a key
other than `conversation` receives no Session binding, and `sidebar.panellist`
takes an id, an order and a label.

## Operational notes for whoever picks this up

- A bundle linked from `~/dotfiles` does not reload its JavaScript when the file
  changes: a bare write is not picked up, and waiting does not help. Restart the
  Harness, or reinstall the bundle, after editing plugin code. Row and config
  changes in `cordis.patch.yml` do apply live.
- `pnpm` rewrites the profile `package.json` with a rename, which replaces the
  symlink with a regular file. `../relink.sh --adopt` reports the drift, copies
  the live file back into the repo, and restores the link.
- `ctx.llm.stream()` yields a closed union discriminated on **`type`**, not
  `kind`: `block-start | text-delta | reasoning-delta | tool-call-delta |
  block-end | usage | finish`. `reasoning-delta` carries a `text` field too, so
  a collector that accepts text from any chunk pastes the model's private
  planning into its answer.
