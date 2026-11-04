---
name: harness-plugin-backlog
description: Read the agreed-but-unbuilt DeepSeek Harness plugin backlog before designing new Harness tooling. Use when the user asks to add, plan or extend a Harness plugin, panel, tool, page or preset, or mentions experiment tracking, climate data catalogs, or HPC/SLURM integration.
---

# Harness plugin backlog

Ideas that were agreed but are not built yet are recorded in
`~/dotfiles/dsh/ideas/plugin-backlog.md`. Read that file before proposing new
Harness tooling: each entry carries the goal, the extension points it would use
(the names verified against the live runtime), the first concrete step, and the
open questions, so a proposal can start from the decision already made instead
of re-deriving it. The same file lists what is already built under
`~/dotfiles/dsh/plugins/`, so it does not propose something that exists.

When an idea is implemented, move its section out of the backlog in the same
change rather than leaving it stale.
