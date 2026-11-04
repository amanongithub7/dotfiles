# DeepSeek Harness config under version control

The desktop profile's configuration is tracked here; the paths Harness reads
are symlinks back into this directory. `relink.sh` recreates them.

| Live path | Tracked copy |
|---|---|
| `~/.dsh/profiles/desktop/cordis.patch.yml` | `desktop/cordis.patch.yml` |
| `~/.dsh/profiles/desktop/cordis.yml` | `desktop/cordis.yml` |
| `~/.dsh/profiles/desktop/package.json` | `desktop/package.json` |
| `~/.dsh/profiles/desktop/pnpm-workspace.yaml` | `desktop/pnpm-workspace.yaml` |
| `~/.dsh/skills` | `../agent-config/skills` |

```bash
./relink.sh          # report and repair every link
./relink.sh --adopt  # copy a drifted live file back into the repo first
```

## Deliberately not tracked

`~/.dsh` itself is not symlinked here, because it holds state that must not
enter git:

| Path | Why it stays out |
|---|---|
| `.credentials.yaml` | API keys |
| `sessions/` | full conversation transcripts |
| `storages/` | persisted session/workspace state |
| `profiles/desktop/node_modules/`, `.plugin-manager/` | installed packages and operation logs |
| `profiles/desktop/pnpm-lock.yaml` | regenerated on install |

Only the five paths in the table above are linked.

## Why relink.sh exists

A tool that rewrites one of these files with a temp-file-plus-rename will
replace the symlink with a regular file, leaving the repo copy stale. That is
expected for `package.json` (pnpm rewrites it on every install) and possible
for `cordis.patch.yml` (the settings UI rewrites it when the model or the
default preset changes). `relink.sh` detects that and shows the diff; it never
silently discards the live file.

## Related

- `ideas/plugin-backlog.md` - plugin ideas agreed but not built yet.
- `../agent-config/README.md` - the shared skills and agent prompts.
