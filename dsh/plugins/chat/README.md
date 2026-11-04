# chat

One plain model call inside the Harness. The provider is queried **once** and
its reply comes back as text: no agent turn, no tools, no loop, no subagent.

| Caller | How |
|---|---|
| Agent | the `chat` tool (`prompt`, optional `provider`/`model`) |
| User | `/chat <prompt>` in the composer |
| Panel | the **Chat** entry in the sidebar panel list |

All three share one `ask()`, so they cannot drift apart.

## The sidebar panel

`client.js` registers a `Chat` entry in `sidebar.panellist` (id `chat`, order
20) and the matching page in the keyed `main` slot. The page is a chat box: type
a prompt, press Enter, read the reply. It keeps no history beyond the page and
appends nothing to any session.

The browser half does **not** use `host.call`, which routes through the generated
Remote namespace that a plain-JavaScript bundle cannot produce. It posts to one
exact Fetch route instead, registered by the host half:

    POST /api/aman-chat/ask   {"prompt": "…"}   →   {"text": "…", "provider": "…", "model": "…"}

`/api` is the shared connection channel, and it authenticates before routing, so
the browser's own credential authorizes the call. Exact routes must live under
`/api`, and every later segment must match `/^[A-Za-z0-9_$.-]+$/`.

The page styles itself inline from the documented `--dsw-alias-*` theme tokens,
so it follows light/dark and any future theme without a stylesheet, and it never
reaches outside its own subtree.

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `provider` | `paratera` | Provider route to call |
| `model` | `DeepSeek-V4.1-Flash` | Model id on that route |
| `maxChars` | `12000` | Cap on the returned reply |
| `timeoutMs` | `180000` | Deadline for one call |

The defaults are copied from this profile's `agent-default-model` row rather than
read from it: switching the default model in Settings does not move the chat
target. Change them in `cordis.patch.yml` instead.

## Loading a change

The client module graph is built at startup, so a new browser half appears only
after the Harness restarts. Host-side JavaScript reloads when the *profile* patch
changes; a bare file write, or reinstalling the bundle, is not enough.

## Verification

```bash
node --check index.js && node --check client.js
node smoke.mjs     # browser half: registrations, render, submit, failure path
```

`smoke.mjs` stubs the module loader, React and `fetch`, then asserts that the
half claims both slots, honours the requested icon size, posts one trimmed
prompt to `/api/aman-chat/ask`, appends the reply with its target, and reports a
rejected request instead of swallowing it. It is the only way to exercise the
browser half without a page.

- Host: call the `chat` tool and read the reply.
- Panel: the client Inspect Slots tree lists this bundle as an occupant of
  `sidebar.panellist` with id `chat`.
