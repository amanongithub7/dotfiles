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
