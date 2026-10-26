---
description: Stage and commit the current changes
---

Review the working tree, then stage and commit the current changes.

$ARGUMENTS

Run `git status` and `git diff` first, including untracked files. If the changes
are unrelated to each other, make separate commits rather than one mixed commit.
Stage explicit paths; do not use `git add -A` or `git add .`. Never commit
secrets, credentials or large binaries, and never amend or force-push an existing
commit unless asked.

Match the format already used in `git log` — a Conventional Commits subject line
scoped to the area touched, such as `feat(opencode): ...`, `fix(tmux): ...`,
`docs(nvim): ...`. Keep the subject under 72 characters and in the imperative.
Add a body only when the why is not obvious from the subject.
