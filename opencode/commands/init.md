---
description: Analyze this project and write or refresh AGENTS.md
---

Study this repository, then write or update `AGENTS.md` at the project root.

$ARGUMENTS

Cover these points in order, and omit any section the evidence does not support:

- What the project is and what it is for, in two or three sentences.
- How to run it, test it, and lint or typecheck it. Use the real commands from
  the build files, not invented ones.
- The layout: which directories hold what, and which are generated.
- Conventions that are not obvious from the file tree: naming, error handling,
  import style, commit message format.
- Anything a newcomer would get wrong on their first change.

Read the build files, the CI config, the test setup, and a representative source
file or two before writing. The file is loaded into every agent's context, so
keep it short and high-signal; do not restate the file tree as prose.

If an `AGENTS.md` already exists, preserve what is still true, correct what has
drifted, and report what you changed and why.
