# Chats as a sidebar section — fork plan

Goal: a **Chats** section in the Harness sidebar, built like the **Workspaces**
section (search, group by, new), with chats stored under it and chat windows
matching the session UI (model selection, attachments, a Search button instead of
the access selector). Plus: what a fork costs when DSH updates.

## 0. What "fork" can mean here

The installed Harness is a single bundled `app.asar` (182 MB, no source tree, no
git history). There is no upstream checkout on this machine, so "merging the fork
with main" is not the workflow and there will be **no merge conflicts** — we never
modify DSH's own code.

The fork is a **client plugin that occupies the `sidebar.workspaces` slot** and
renders the whole browsing region itself: workspaces *and* chats. The cost moves
from merging to **contract drift** (§6).

## 1. Why this is possible at all (evidence from the live runtime)

- `slots.register(options, component)` accepts a **`children`** declaration, so
  our occupant re-declares the seats the shipped occupant declares (the slot tree
  reports - `declaredBy: "an entry in sidebar.workspaces"`). Registrations into
  those seats made by other plugins are held until a declaration exists, so they
  re-attach to ours.
- `sidebar.workspaces` is `single`; the shipped WorkspaceBrowser is the occupant.
  Ours replaces it — hence the workspace half must be reimplemented.
- The occupant receives `useSessions`, `useWorkspaces`, `useSessionStatus`,
  `useSessionRetainInfo`, `useSessionAccess`, `useWorkspaceAccess`,
  `usePanelInfo`, `useResource`, `useRemoteAccess` (from the slot catalog), and
  `renderSlot` for the child seats.
- Behaviour is available as public client services: `layout.selectPanel` /
  `toggleSidebar`; `uiWorkspace.openSession` / `startSession` / `openWorkspace` /
  `forkSession` / `archiveSession` / `pickDirectory` / `listDirectory` /
  `createDirectory`; `workspaces.create` / `rename` / `delete` /
  `insertSessionBefore`; `sessions.search` / `fork`; `theme`; `locale`.

This corrects an earlier claim of mine: a faithful sidebar is buildable from
public API. It is real work, not an impossibility — the risk is ownership, not
access.

## 2. Package layout

**Decision: one package.** The sidebar component goes into `@aman/dsh-chat` as
`sidebar.js`, because client bundles cannot import each other and the two halves
must share state (which chat is selected) without a host round-trip. A module-level
store is enough.

- `client.js` keeps the Chat page (`main`, key `chat`).
- `sidebar.js` registers `sidebar.workspaces` when `sidebarFork` is true.
- Disabling the flag leaves the Chat page untouched and restores the stock browser.
- `inject: ['slots']` unchanged; `layout` / `uiWorkspace` / `workspaces` / `sessions`
  are read through the guarded `ctx.get(...)` helper (never a bare property read).

## 3. Workspaces half — parity matrix

| Feature | Data / call | Phase |
|---|---|---|
| Section header: title, search, group by, new | `useWorkspaces`, `sessions.search`, `uiWorkspace.startSession` | 1 |
| Workspace groups, collapsible | `useWorkspaces`, `useSessions` | 1 |
| Session rows: title, relative time, running dot | `useSessions`, `useSessionStatus` | 1 |
| Open a session, highlight the active one | `uiWorkspace.openSession`, `usePanelInfo` | 1 |
| Row leading decoration / hover card / row actions / "..." menu | `renderSlot` on the four re-declared seats | 2 |
| Workspace menu: rename, delete | `workspaces.rename`, `workspaces.delete` | 2 |
| Session archive / unarchive | `workspaces.archiveSession`, `unarchiveSession` | 2 |
| Add workspace (path flow) | `uiWorkspace.pickDirectory` / `listDirectory` / `createDirectory`, `workspaces.create` | 2 |
| Access gating on destructive actions | `useSessionAccess`, `useWorkspaceAccess` | 2 |
| Content search with results | `sessions.search(query, signal)` | 2 |

Deliberately dropped in v1 (documented gaps): drag-to-reorder, the shipped hover
timings and tooltips, and `sidebar.workspaces.directoryFlow` — that seat's owner
contract is the shipped picker, and nothing else occupies it today. Not declaring
it is safer than declaring a contract we do not honour.

## 4. Chats half — the feature itself

Header mirrors Workspaces exactly (one `<SectionHeader>` component, used twice):

- **Search** (`/` icon → inline input): filters titles; host content search later.
- **Group By**: `Date` (Today / Yesterday / Previous 7 days / Older) and `Model`
  (provider/model). Chats have no workspace, so workspace grouping is not offered.
- **New** (`+`): creates a chat and opens it.

Rows: title, relative time, model badge; "..." menu with Rename, Delete, and
"Group by model". Empty state with a New chat action.

Storage stays as it is: one JSON per chat under
`$DSH_HOME/storages/aman-chat/chats`, plus the uploaded-file store. Extend the
record with `model`, `provider`, `web`, `pinned`; grouping is **derived**, never
stored, so regrouping needs no migration.

Navigation: a row click calls `layout.selectPanel('chat')` and the shared store
sets the chat to open. **Phase-1 spike must confirm** that `selectPanel` accepts a
plugin-registered key (`MainPanelId` may be a closed union); fallback if it does
not: rows open the page without deep-linking, or the page keeps its own column.

Panel state (`/ui`) grows: `chatsGroup`, `chatsCollapsed`, `workspacesCollapsed`,
`searchOpen`. Already persisted host-side.

## 5. Chat page parity

- Composer: **model selector** (new `/models` route over the host `llm` routes),
  paperclip attachments (have), **Search** toggle (have), send **and stop**
  (`AbortController` on the fetch). No access selector, as requested.
- Messages: the shipped geometry is already matched; add copy and retry actions.
- **Streaming is optional (Phase 4).** The route currently returns one completed
  message; a chunked response would let the panel fill in like a session, but it
  changes the route contract and the tests.
- The selected model is stored per chat, which is what makes Group By = Model work.

## 6. Will DSH updates hurt? Yes — but never as a merge

We never patch the app, so an upgrade is just a new Harness. What can break is the
contract, and it breaks *visibly*:

| Drift | Symptom | Data risk |
|---|---|---|
| Snapshot field rename (`Sessions`, `Workspaces`) | blank titles, missing rows | none |
| `standardProps` hook rename | our region throws, sidebar empty | none |
| Slot kind / child-seat rename | registration lands wrong, decorations vanish | none |
| Service signature change (`openSession`…) | clicks do nothing | none |
| Theme token rename | unstyled bits | none |
| `MainPanelId` validation | chat rows stop navigating | none |

Chats live in our own store, so no failure mode corrupts either chats or sessions.

Mitigations, strongest first:

1. **`engines.dsh` pin.** The plugin manager blocks activation when the engine is
   unmet, so an incompatible DSH shows the **stock sidebar** instead of a broken one.
2. **Runtime self-check with auto-fallback.** On mount, verify the expected props
   and services exist and the snapshots look structurally right; if not, dispose
   the `sidebar.workspaces` registration (the shipped occupant takes over) and show
   one line in the Chat page explaining why.
3. **Settings toggle** in `settings.general.item` (an additive seat) to force the
   stock browser — recovery is one click even when the self-check misses something.
4. **Contract snapshot in the repo** (`contract/slots.json`, `contract/types.json`):
   a deliberate dump of what we depend on, diffed after each upgrade. Refreshed by
   an agent-run inspect query, since the inspect API is not callable from a shell.
5. **Tests.** Extend the mini-React client harness with fixture snapshots for both
   sections: a renamed field fails an assertion instead of hanging the sidebar.
6. **Upgrade runbook** (§8).

The ongoing tax is real: every new sidebar affordance upstream is ours to port.
Keep the fork thin — render from hooks, call services for behaviour, duplicate no
logic the services already own.

The proper fix is upstream: ask for a `sidebar.sections` (list) seat. Then the
Chats section becomes an ordinary plugin and this fork can be deleted.

## 7. Phases

| Phase | Deliverable | Gate |
|---|---|---|
| 0 | Contract lock: record snapshot shapes, seat occupants, and spike `selectPanel('chat')` + `children` declaration | throwaway build lists sessions and switches panels |
| 1 | Shadow skeleton: our occupant renders both sections from shipped data; `sidebarFork` default **on** after P2, off during P1 | sidebar indistinguishable for sessions; chats listed |
| 2 | Chats section complete: search, group by, new, row menu, empty states, persistence | all chat actions work without the page's column |
| 3 | Page parity: model selector, stop, copy/retry | matches the session composer |
| 4 | Streaming (optional) | reply fills in progressively |
| 5 | Hardening: self-check, settings toggle, engines pin, contract snapshot, tests, runbook | simulated drift falls back cleanly |

## 8. Upgrade runbook

1. Note the new DSH version; run both smoke suites.
2. Re-run the two inspect queries (slot tree, `standardProps`) and diff `contract/`.
3. Launch: if the self-check fired, the stock sidebar is back — port the change.
4. Checklist: title search, content search, group by, new session, open session,
   row menu, new workspace, chats list, open chat, new chat, delete chat.
5. Bump `engines.dsh`, refresh the snapshots, commit.

## 9. Decisions needed

1. Chats above or below Workspaces (default: below).
2. Settings toggle visible in General (recommended: yes).
3. Group By for chats: Date + Model (recommended) or Date only.
4. Streaming now, or Phase 4.
5. P1 shipped with the fork **on by default** from the start, or off until P2 is
   complete (recommended: on from P2, and the flag exists throughout).
