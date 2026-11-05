# chat

One plain model call inside the Harness. The provider is queried **once** and
its reply comes back as text: no agent turn, no tools, no loop, no subagent.

| Caller | How |
|---|---|
| Agent | the `chat` tool (`prompt`, `provider`, `model`, `web`, `files`) |
| User | `/chat <prompt>` in the composer |
| Panel | the **Chat** entry in the sidebar panel list |

All three funnel through one `converse()`, so they cannot drift apart.

## The sidebar panel

`client.js` registers a `Chat` entry in `sidebar.panellist` (id `chat`, order 20)
and the matching page in the keyed `main` slot. The page is a two-pane chat
client:

- **Left column** - every previous chat, newest first, with the new-chat and
  delete controls. The sidebar exposes no additive section seat (its children are
  the brand marks, the footer action, the toggle badge, settings, the single
  `workspaces` slot, `panellist` and `panellist.actions`), and registering on
  `sidebar.workspaces` would shadow the shipped one, so the history list lives
  inside the panel and is styled from the sidebar's own fill token.
- **Right column** - the thread and its composer. A user turn is a right-aligned
  bubble (`--dsw-specific-bubble`, 20px radius); an assistant turn is a plain
  full-width block, like the workspace UI. Replies render a small markdown subset
  (headings, lists, quotes, fenced and inline code, links, bold, italic) as React
  elements; no HTML string is ever injected.
- **Composer** - a contenteditable with the shipped geometry, a model picker fed
  by `GET models` (every route with an adapter, grouped by provider, cached on the
  host for five minutes), Enter sends,
  Shift+Enter adds a line, Enter during IME composition does not send. Attached
  files appear as 240x64 cards. A paperclip button sits directly left of send. A
  `role="switch"` Search toggle, marked with an atom (a nucleus in two
  perpendicular orbits), controls Tavily grounding.
- **While waiting** - the assistant row holds three pulsing dots rather than a
  sentence; the wording lives on as the indicator's `aria-label`, and
  `prefers-reduced-motion` replaces the pulse with a static fade.
- **Folding the history** - the chevron at the left of the thread header hides
  the left column and gives the thread the full width; while folded, the header
  also carries the new-chat button so nothing becomes unreachable. The choice is
  saved with `POST ui` and reapplied from `GET status` on the next load, so the
  panel opens the way it was left.

Chats are **not** sessions: the panel keeps its own history on disk under
`$DSH_HOME/storages/aman-chat` (one JSON file per chat, plus an uploaded-file
store), and a turn appends two messages to that file. Nothing is added to any
session or trajectory, which is what keeps the loop out.

### The sidebar fork (`sidebarFork`)

Off by default. When on, the browser half also occupies `sidebar.workspaces` at
`priority: 1` (the shipped browser is priority 0, so the shadow takes the single
seat deterministically) and
renders the whole browsing region itself, both sections with the same header:
**Workspaces** (session rows grouped by workspace or flat, search over the host
message index, and the shipped row menus and actions through their own seats) and
**Chats** (this plugin's chats, grouped by date or model, searchable by title and
message content, with rename and delete on every row). Each header carries search,
a grouping choice, and its new button. The shipped browser gives up the seat, which
is the point: the sidebar has no additive section seat, so a Chats section means
owning the region.

What keeps it safe:

- `contract/sidebar-workspaces.md` records exactly what is mirrored — the five
  child seats, the `menuOpenState`/`shortcuts` inject the shipped menu items need,
  the snapshot shapes, the services, and how to re-verify after an upgrade.
- A render error is caught by an error boundary that disposes the registration, so
  the **shipped browser takes the sidebar back** instead of leaving it empty.
- The mount, a render report (`sidebarForkReport`: how many sessions, chats and
  workspaces the shadow actually read) and any fallback reason are recorded in
  `panel.json`, so both success and failure are visible without a browser console.
  Settings → General shows the recorded fallback reason when there is one.
- **Settings → General → "Chats in the sidebar"** turns the fork off at runtime
  (`ui.sidebarForkOff`), no config edit needed, and says a reload applies it.
- `package.json` pins `engines.dsh`, so a DSH the fork was not verified against
  blocks activation and the shipped sidebar stays in place.
- `contract/sidebar-workspaces.json` is the machine-readable contract; the client
  test asserts the fork's declaration against it, so drift fails a test instead of
  the sidebar. `contract/sidebar-workspaces.md` records why each dependency exists.
- `UPGRADE.md` is the runbook: what to re-read after a DSH update, what each kind
  of drift looks like, and how to roll back in one click.

### Routes

The browser half does **not** use `host.call`, which routes through the generated
Remote namespace that a plain-JavaScript bundle cannot produce. It posts to exact
Fetch routes instead, all under `/api/aman-chat` (each returns JSON):

| Route | Body | Result |
|---|---|---|
| `GET status` | - | routes, providers, `tvly` path, data directory, saved layout |
| `GET list` | - | chat summaries, newest first |
| `POST get` | `{id}` | one chat with its messages |
| `POST new` | - | a new empty chat (and the refreshed list) |
| `POST rename` | `{id, title}` | the renamed chat |
| `POST delete` | `{id}` | the refreshed list |
| `POST upload` | `{name, mime, dataBase64}` | `{file: {id, name, bytes, mime}}` |
| `POST file` | `{id}` | `{dataBase64}` |
| `POST ask` | `{id, prompt, web, files}` | the chat, its summary, the search, the failure |
| `GET models` | - | providers with their models, plus the configured default |
| `POST search` | `{query}` | chats whose title or messages match, with an excerpt |
| `POST ui` | `{historyCollapsed, chatsGroup, sidebarForkOff, sidebarForkMounted, sidebarForkReport, sidebarForkError}` | panel layout, the fork off-switch and fork diagnostics |

`/api` is the shared connection channel and it authenticates before routing, so
the browser's own credential authorizes the call; the host half still applies the
connection's request rejection first. Exact routes must live under `/api`, and
every later segment must match `/^[A-Za-z0-9_$.-]+$/`. Ids are validated as UUIDs
before they reach a path, so a traversing id resolves to nothing.

## Grounding and attachments

- **Web** - `web: true` runs `tvly search "<prompt>" --json --max-results N
  --depth <depth>` and appends numbered results to the user message, plus a
  system instruction to cite them by number. A failed or empty search is reported
  to the model as `[…]` text instead of being dropped, so it can say what is
  missing. Nothing is registered as a `tavily` web provider: this profile pins
  `searchProvider: scholar`, and a second provider risks an ambiguous selection.
- **Files** - text files are read directly, PDFs go through `pdftotext`, and
  images go to the attachment service (`{type: 'image'}`) only when the model
  declares image input. The newest turn carries the extracted text; older turns
  keep only the file's name and note, bounded by `historyChars`.

`tvly` is keyless unless it has been logged in, and the keyless tier is rate
limited per IP address. When that cap is hit the panel shows the CLI's own
explanation ("Too many keyless requests from this IP address …"), which is the
actionable part. Authenticate once with `tvly login`, or `tvly login --api-key
<key>`; the CLI keeps its own credential store, so the app's environment does not
matter. Nothing else needs configuring.

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `provider` | `paratera` | Provider route to call |
| `model` | `DeepSeek-V4.1-Flash` | Model id on that route |
| `systemPrompt` | - | Prepended system instruction |
| `maxChars` | `24000` | Cap on the returned reply |
| `timeoutMs` | `300000` | Deadline for one call |
| `historyMessages` / `historyChars` | `24` / `120000` | How much earlier turns are replayed |
| `web` / `webResults` / `webDepth` | `true` / `5` / `basic` | Grounding defaults |
| `tvlyCommand` / `tvlyPaths` | `tvly` / `[]` | The search CLI and extra places to look |
| `images` | `auto` | `auto`, `true` or `false` image attachments |
| `fileMaxChars` | `40000` | Cap on one attachment's text |
| `maxUploadBytes` | `26214400` | Largest accepted upload |
| `dataDir` | `$DSH_HOME/storages/aman-chat` | Where chats and uploads live |

The defaults are copied from this profile's `agent-default-model` row rather than
read from it: switching the default model in Settings does not move the chat
target. Change them in `cordis.patch.yml` instead.

`subprocess` is declared in `inject` and must stay there: Cordis refuses
`ctx.subprocess` outright without an injection, which is what the search and the
PDF extractor need. `llm`, `attachments` and `connection` are read through a
guarded lookup instead, so a profile without them still gets the tool, the
command and the panel.

## Loading a change

The client module graph is built at startup, so a new browser half appears only
after the page (or the app) reloads. The host half is re-imported when the
installed bundle changes: that has been observed happening inside one app process
(the plugin's own `flags` record in `panel.json` updated with no restart), so a
write to this bundle can land without one — but do not rely on it. An edit to the
profile patch alone did **not** reload the plugin, twice.

Evidence that a host-side change actually landed, without a browser:
`$DSH_HOME/storages/aman-chat/panel.json` gains `flags` at plugin start,
`sidebarForkMounted` when the fork mounts, and `sidebarForkError` if it fell back.

## Verification

```bash
node --check index.js && node --check client.js && node --check store.js && node --check ground.js
node host-smoke.mjs     # host half: tool, command, routes, grounding, attachments, history, failures
node client-smoke.mjs   # browser half: registrations, icon, list render, submit, failure
```

Both halves are exercised without the app. `host-smoke.mjs` stubs the plugin
context, `llm`, `subprocess` and `connection`, and covers the request the tool
builds, visible-text-only collection, the truncation note, Tavily grounding
(results, empty, failed, JSON-on-stdout failure), file extraction, every panel
route, the multi-turn message shapes, the trust check, an oversized upload, and a
profile with no connection service. `client-smoke.mjs` stubs the module loader, a
small React and `fetch`, and covers the slot registrations, the icon, the initial
history render, one submit, and a rejected request.

Live checks that found real bugs, worth repeating after a change:

- Host: call the `chat` tool with `files: ["…/x.pdf"]` and `web: true`, and ask it
  to quote every bracketed `[…]` note verbatim - that is how the injection error
  and the `tvly` exit code became visible.
- Panel: the client Inspect Slots tree lists this bundle as an occupant of
  `sidebar.panellist` with id `chat`; opening the panel writes
  `storages/aman-chat/panel.json`, which proves the browser-to-host route works.
