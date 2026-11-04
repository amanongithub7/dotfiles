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

## 0. Chat sidebar panel — built

**Status.** Built and installed as `../plugins/chat` (v2.0.0): the `chat` tool
(with a Tavily-grounded web option and file attachments), the `/chat` command,
and a **Chat** entry in the sidebar panel list. The panel is a full client now:
a left column of every previous chat, a thread with the shipped conversation
styling, a composer with file uploads and a web toggle, and its own history on
disk under `storages/aman-chat`. Chats are deliberately not sessions - that is
what keeps the agent loop out - so the panel keeps its own store and calls the
provider once per message. All three callers funnel through one `converse()`.

**Why the history is not a sidebar section.** The sidebar has no additive section
seat: its children are the brand marks, the footer action, the toggle badge,
settings, the single `workspaces` slot, `panellist` and `panellist.actions`.
Registering on `sidebar.workspaces` would shadow the shipped one, so the history
list is the panel's left column, styled from the sidebar's own fill token.

**How the browser half reaches the host.** Not through `host.call`: that routes
through the generated Remote namespace, which a plain-JavaScript bundle cannot
produce (npm carries the DSH packages at `0.0.1-rc.1` against a running
`0.2.1-rc.5`). Instead the host registers one exact Fetch route and the browser
half posts to it with plain `fetch` — available to a *bundled* half, unlike a
dynamic package's sandboxed half, whose `fetch` trap reads "network belongs to
the HOST half".

**Rules that cost time to learn.**

- Exact Fetch routes must live under the shared `/api` channel: `register`
  validates with `endpointFromPath('/api', path)`, so `/aman-chat/ask` throws
  `invalid exact Fetch route`. Every segment after `/api/` must match
  `/^[A-Za-z0-9_$.-]+$/`.
- `/api` authenticates *before* routing, so an unauthenticated probe gets a
  blanket 401 and cannot distinguish a registered route from an unrouted one.
  Register a diagnostic through a tool instead when you need to know.
- `sidebar.panellist` ids address matching `main` panels: register the list
  entry with an id and the panel under the same key. The sidebar owns the
  button, the label comes from list metadata, and the icon component receives
  `{ size, active }`.
- Installing a bundle does not load its browser half: the client module graph is
  built at startup, so a new `dsh.client` half appears only after a restart. The
  client Inspect Slots tree shows it as an occupant of `sidebar.panellist`.
- A bundle's JavaScript reloads only when the *profile* patch changes: a bare
  file write is not enough, and neither is reinstalling the bundle.
- **Cordis refuses `ctx.<service>` without an injection**, even when the service
  exists: reading it throws `cannot get property "x" without inject`. So the
  `ctx.get?.('x') ?? ctx.x` idiom is a trap - `get()` succeeds without inject and
  the `??` branch then throws. Use a guarded lookup that tries `get` first and
  wraps the property read, or declare the service in `inject`.
- The `inject: { required: […], optional: […] }` object form did **not** load in
  this DSH version: the plugin's tool disappeared. The array form works.
- A tool's returned value must be lossless JSON. A key that is present with
  `undefined` is rejected as `value is not lossless JSON`, so optional fields must
  be omitted rather than set to `undefined`.
- `tvly` reports its own failures as JSON on **stdout** with a non-zero exit code
  and an empty stderr - read stdout before blaming the exit code. Its keyless
  tier is rate limited per IP, and the message says so.
- Live-debugging trick for a tool's own diagnostics: the bracketed `[…]` notes a
  plugin puts in its prompt can be read back by asking the model to quote every
  bracketed note verbatim. That is how the injection error and the `tvly` exit
  code surfaced.
