# Contract: `sidebar.workspaces` (what the fork depends on)

Verified against DSH `0.2.1-rc.5` by reading the shipped bundles out of
`/Applications/DeepSeek Harness.app/Contents/Resources/app.asar` (a helper lives at
`/tmp/asar.py`; it is not part of this repo). Re-verify after every DSH upgrade —
§7 lists the queries.

## 1. What is shadowed

`sidebar.workspaces` is a **single** slot. Its occupant today is
`@deepseek-ai/dsh-client-ui-workspace`'s `WorkspaceBrowser`
(`dsh/node_modules/@deepseek-ai/dsh-client-ui-workspace/lib/client.js`). Our
occupant replaces it and must render the workspace browsing region itself.

## 2. The registration to mirror

Copied from that bundle (`index.js` region, the `ctx.slots.inject("sidebar.workspaces")`
call):

```js
ctx.slots.register({
  name: 'sidebar.workspaces',
  children: {
    'sidebar.workspaces.directoryFlow': { kind: 'single', scope: 'root' },
    'sidebar.workspaces.session.menu.item': {
      kind: 'list',
      scope: 'root',
      inject: { hooks: { menuOpenState: menuOpenStateFactory, shortcuts: shortcutsCatalog } },
    },
    'sidebar.workspaces.session.row.action': { kind: 'list', scope: 'root' },
    'sidebar.session.row.leading': { kind: 'list', scope: 'root' },
    'sidebar.session.row.hover': { kind: 'list', scope: 'root' },
  },
  inject: browserInjected,   // ours instead
  locale: NS,                // ours instead
}, SidebarFork)
```

with `menuOpenStateFactory = (_standard, state) => () => state` and
`shortcutsCatalog = ctx.get('shortcuts')?.catalog`.

Why the children matter: they are **declared by the occupant**, so shadowing
without re-declaring them makes the shipped row menus, row actions, hover cards
and leading decorations disappear. The `inject` on `session.menu.item` is not
decoration — the shipped menu items call `useMenuOpenState` and read
`useShortcuts`, so a declaration without it breaks every session row menu.
`directoryFlow` must be declared too, or the directory picker never mounts and
"add workspace" dies.

`store` is optional; the shipped occupant uses one for its view state. We use
React state plus the host-side `/ui` persistence instead (no `dsh-client-store`
dependency in the fork).

## 3. Shared module ids a plugin bundle may `require`

From the web shell's module registry (`dsh-web-frontend/dist/assets/index-*.js`):

```
react, react/jsx-runtime, react-dom, react-dom/client,
@deepseek-ai/cordis, zod, @tanstack/react-virtual,
@deepseek-ai/dsh-client-store, @deepseek-ai/dsh-client-ui-slots,
@deepseek-ai/dsh-client-ui-primitives, @deepseek-ai/dsh-client-ui-dockkit
```

This is the big fidelity lever: `ui-primitives` is available, so the fork can use
the shipped components rather than reimplementing them. Usage found in the shipped
sidebar/workspace bundles: `Menu`, `MenuItemButton`, `Button`, `Tooltip`, `Modal`,
`Toast`, `HoverCard`, `HoverCardGroup`, `StateDot`, `relativeTime`,
`writeClipboard`, `isDarwinDesktop`, `FishLogo`, and icons
`IconSearchOutlineRegular`, `IconNewChatOutlineRegular`,
`IconSlidersTwoOutlineRegular`, `IconPanelLeftOutlineRegular`,
`IconEllipsisOutlineRegular`, `IconFolderCloseRegular`, `IconArchiveOutlineRegular`,
`IconPinOutlineRegular`, `IconEditOutlineRegular`, `IconQueueOutlineRegular`.

Every `require` must be guarded: a future version may drop or rename an id, and the
fallback is our own minimal component, not a crash.

## 4. Data the occupant receives

Standard props on `sidebar.workspaces`: `useRemoteAccess`, `useResource`,
`useWorkspaces`, `useSessions`, `useSessionStatus`, `useSessionRetainInfo`,
`useSessionAccess`, `useWorkspaceAccess`, `usePanelInfo`, plus `renderSlot` for the
child seats. Each `use…` is a snapshot selector: `useX((state) => slice)`.

Shapes, read from the shipped browser's call sites (P0 lock):

```ts
// useWorkspaces((state) => state)
{ items: Array<{ workspaceId, path, title, createdAt, sessionIds: SessionId[] }>,
  phase, state, archivedSessionIds: SessionId[], pinnedSessionIds: SessionId[] }

// useSessions((state) => state)
{ ids: SessionId[],
  byId: Record<SessionId, { id, title, blank, running, updatedAt }>,
  projectionsBySession: Record<SessionId, { values: { subagentCatalog?: Array<{ id }> } }>,
  mainView: … }   // `mainSessionId(list)` reads the current session from it

// useSessionStatus → statuses.get(sessionId)
{ running, completionUnread, pendingInteraction?: { kind: 'approval' | 'plan-review' | 'question' } }
```

A row node is exactly (`sessionNode` in the shipped browser):

```ts
{ id, title, blank, running, runningSubagentCount, completed, pinned, archived,
  updatedAt, pendingInteraction? }
```

with `title = blank ? '' : (title?.trim() ?? '')`, `pinned` suppressed while
archived, and grouping by `workspace.sessionIds` order, stray sessions trailing in
an "Ungrouped" group ordered by recency.


## 5. Behaviour comes from services, not from the component

```
layout.selectPanel(id)          // switch the main panel; must accept our 'chat' key
layout.toggleSidebar()
uiWorkspace.openSession(target) / startSession(workspaceId, opts)
uiWorkspace.forkSession / archiveSession / unarchiveSession
uiWorkspace.pickDirectory / listDirectory / createDirectory
workspaces.create({path}) / rename / delete / insertSessionBefore
sessions.search(query, signal)  // host message index
sessions.using(id, {source}, (ref) => ref.binding.session.rename(title))
```

## 6. Traps recorded so far

- The sidebar's region gets `collapsed` / `width` via the *owner* share, not props we
  set; the rail state is the shell's.
- `MainPanelId` may be a closed union; `selectPanel('chat')` must be proven at runtime
  before chat rows rely on it.
- `renderSlot` for the row seats needs the occurrence's menu open-state pair threaded
  as `hookContext`; copy the shipped call site rather than guessing.
- Declaring a child slot with a spec that differs from the shipped one (kind/scope/
  inject) breaks its occupants.

## 7. How to re-verify after an upgrade

1. `cordis_inspect_query` client / `Slots` / `listSubTree` with root `sidebar` —
   confirms the slot kinds, children names, and the occupant.
2. `cordis_inspect_query` client / `Service` / `listService` — confirms the service
   methods in §5 and the hooks' availability.
3. Pull the new bundles out of the app and diff the registration in §2:
   `python3 /tmp/asar.py cat dsh/node_modules/@deepseek-ai/dsh-client-ui-workspace/lib/client.js`
4. Re-read the module registry in `dsh-web-frontend/dist/assets/index-*.js` for §3.
