# chat

One plain model call inside the Harness. The provider is queried **once** and
its reply comes back as text: no agent turn, no tools, no loop, no subagent.

| Caller | How |
|---|---|
| Agent | the `chat` tool (`prompt`, optional `provider`/`model`) |
| User | `/chat <prompt>` in the composer |

Both share one `ask()`, so they cannot drift apart.

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `provider` | `paratera` | Provider route to call |
| `model` | `DeepSeek-V4.1-Flash` | Model id on that route |
| `maxChars` | `12000` | Cap on the returned reply |
| `timeoutMs` | `180000` | Deadline for one call |

The defaults match this profile's `agent-default-model` row, but they are
copied rather than read from it: switching the default model in Settings does
not move the chat target. Change them in `cordis.patch.yml` instead.

## Why there is no sidebar panel yet

The requested shape is a **Chat panel in the sidebar**. The page half is
straightforward - the `main` slot is keyed by sidebar entry id and a
non-`conversation` key receives no Session binding, so an agentless panel is
exactly what it is for, and `sidebar.panellist` takes an id, an order and a
label.

What blocks it is the host half. A dynamic Client half can only reach its own
Host half through the package-private `host.call(method, args)` RPC, and
exposing a method on the Host side needs DSH's `@Remote` decorator. A bundle
installed from `~/dotfiles` cannot resolve `@deepseek-ai/dsh-*`: Node resolves
imports from the package's real path, the profile's `node_modules` holds only
the linked bundles, and npm publishes those packages at `0.0.1-rc.1` while this
Harness runs `0.2.1-rc.5`.

So the panel needs one of:

1. DSH packages resolvable at the running version from the bundle's own
   directory - a `node_modules` symlinked to a source checkout of the same
   version works today;
2. a Harness-side seam for exposing a host method without the decorator;
3. the bundle developed inside a DSH source checkout, where imports resolve.

Until then the capability itself is available through the tool and the command
above. Recorded in `../../ideas/plugin-backlog.md`.

## Verification

```bash
node --check index.js
```

Then call the `chat` tool once: a reply proves the provider route, the stream
collection and the failure path.
