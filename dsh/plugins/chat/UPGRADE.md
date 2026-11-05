# Upgrading the sidebar fork to a new DeepSeek Harness

The fork never patches the app, so an update cannot conflict with it. What can
break is the *contract*: slot names and kinds, the standard props, the snapshot
fields, the service signatures, the shared module ids, and the theme tokens. This
is the order to check them in, and what each failure looks like.

The truth for every step lives in two places: `contract/sidebar-workspaces.json`
(what the fork mirrors, machine-checked by `client-smoke.mjs`) and
`contract/sidebar-workspaces.md` (why, and how it was verified).

## 0. Before you touch anything

```bash
cd ~/dotfiles/dsh/plugins/chat
node --check client.js && node --check index.js && node --check store.js
node client-smoke.mjs && node host-smoke.mjs
```

If these fail on the *old* version, the drift is already known and the tests are
telling you where. Do not upgrade on top of a red suite.

## 1. Read the running composition

Two read-only Inspect queries, both in the DeepSeek Harness session:

- client / `Slots` / `listSubTree` with root `sidebar` — the slot kinds, the
  occupant, and the five child seats with their registration requirements.
- client / `Service` / `listService` — the client service methods the fork calls
  (`layout.selectPanel`, `uiWorkspace.openSession`, …).

Diff what comes back against `contract/sidebar-workspaces.json`. Any difference in
the five child seat names, their `kind`, or the `injectHooks` of
`sidebar.workspaces.session.menu.item` is a breaking change for the fork.

## 2. Read the shipped implementation

The shipped bundles are the authority on shapes the catalogs only name:

```bash
python3 - <<'PY'
import json
path = "/Applications/DeepSeek Harness.app/Contents/Resources/app.asar"
with open(path, "rb") as handle:
    head = handle.read(16)
    size = int.from_bytes(head[8:12], "little")
    tree = json.JSONDecoder().raw_decode(handle.read(size).decode("utf-8", "ignore"))[0]
    base = 16 + size
    wanted = "dsh/node_modules/@deepseek-ai/dsh-client-ui-workspace/lib/client.js"
    stack, found = [("", tree)], None
    while stack and found is None:
        prefix, node = stack.pop()
        for name, entry in (node.get("files") or {}).items():
            sub = f"{prefix}{name}"
            if sub == wanted:
                found = entry
            elif "files" in entry:
                stack.append((sub + "/", entry))
    if "content" in found:
        print(found["content"])
    else:
        handle.seek(base + int(found["offset"]))
        print(handle.read(int(found["size"])).decode("utf-8", "ignore"))
PY
```

Grep that output for `useSessions(`, `useWorkspaces(`, `useSessionStatus(`,
`usePanelInfo(` and the `ctx.slots.register({ name: "sidebar.workspaces"` block.
Compare:
- the five child seats and their `inject` (the `menuOpenState` factory and the
  `shortcuts.catalog` hook are the two that silently break row menus),
- `sessionNode` (the row fields the fork reads),
- `mainSessionId` / `retainedBy.mainView` (how the active row is found).

## 3. Read the shared module table

In `dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-*.js`, find the
object literal that maps module ids (search for `"@deepseek-ai/dsh-client-store"`).
If `@deepseek-ai/dsh-client-ui-primitives` disappears, the fork's icon helpers
degrade to their inline fallbacks (fine) but any new primitive use would throw.

## 4. Theme tokens

Every token the fork uses is listed in the contract JSON under `themes.requires`.
They are checked by eye or by grepping the app's CSS; a renamed token shows up as
unstyled chrome, never as a crash.

## 5. Live check

After the app restarts with the new version:

1. `~/.dsh/storages/aman-chat/panel.json` gains `flags.sidebarFork`, then either
   `sidebarForkMounted` (fork live) or `sidebarForkError` (it fell back).
2. If it fell back, the shipped browser is back and the reason is in that file —
   fix from the reason, not from guesswork.
3. Exercise, in order: the sidebar shows Workspaces **and** Chats; a workspace's
   sessions expand and open; a session's "…" menu opens and pins/renames/archives;
   a session row's hover buttons appear; the Chats section lists chats, groups by
   Date and by Model, searches a phrase that only exists in a message body;
   renaming a chat in place; deleting a chat; opening a chat from the sidebar
   lands on the chat page with that chat open; New chat creates one.

## 6. Then pin

Only after step 5 passes, widen `engines.dsh` in `package.json` to the range you
verified. A narrower pin than the app version blocks activation, which is the
intended behaviour: an unverified DSH shows the shipped sidebar rather than a
broken fork.

## Failure map

| Drift | What you see | Fix |
|---|---|---|
| snapshot field renamed | rows render untitled or vanish; tests fail on a fixture | update the selectors and the fixture |
| standard prop renamed | fork throws → boundary disposes it → shipped sidebar + `sidebarForkError` | rename the prop access |
| child seat renamed | shipped row menus/hover actions vanish, or their components throw | update the `children` declaration and the contract JSON |
| `menuOpenState`/`shortcuts` inject dropped | session row "…" menus throw (visible as a broken row) | restore the inject |
| service signature changed | clicks do nothing | update the call |
| `MainPanelId` no longer accepts `chat` | chat rows stop navigating | fall back to `selectPanel(null)` + the page's own list |
| theme token renamed | unstyled chrome | swap the token |
| primitives module gone | plain fallback glyphs, no crash | nothing, or restore the icons |

## Rollback

Faster than any fix: Settings → General → "Chats in the sidebar" turns the fork
off for the next reload, and the shipped browser returns. For a permanent
rollback, remove the `include:chat` patch entry from
`~/.dsh/profiles/desktop/cordis.patch.yml` or set `sidebarFork: false` in the
plugin defaults.
