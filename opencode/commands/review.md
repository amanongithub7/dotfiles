---
description: Review uncommitted changes for correctness and missing tests
agent: plan
---

Review the current uncommitted changes in this repository.

$ARGUMENTS

Start with `git status --short`, then read the full diff of staged, unstaged and
untracked changes. Read enough surrounding source to judge each change in context
rather than from the diff alone.

Report findings in severity order, most serious first. For each one give the file
and line, what is wrong, and what would fix it. Prioritise correctness bugs,
regressions in existing behaviour, and missing or broken tests. Call out security
or data-loss risks separately. If the changes look sound, say so plainly instead
of padding the list.

Do not edit any files.
