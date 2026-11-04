---
name: find-docs
description: Fetch current library, framework, SDK, API, and CLI documentation with code examples using the ctx7 CLI. Use whenever the user asks how to use a library or framework, needs API syntax, configuration, version migration, or setup steps - including well-known ones like React, Next.js, Prisma, Express, Tailwind, Django, or Spring Boot. Prefer this over web search for library documentation. Do not use for refactoring, code review, or general programming concepts.
---

# Finding library documentation with ctx7

`ctx7` fetches up-to-date documentation and code examples straight into your
context, from the same index behind context7.com. It is a two-step CLI flow, so
nothing is loaded into the tool list and its schemas never occupy context.

Lookups work without signing in; signing in only raises rate limits.

## Step 1 - resolve the library name to an ID

```bash
ctx7 library <name> "<what you are trying to do>"
```

The query ranks results by relevance, so describe the task rather than passing a
single keyword. Use the official library name with its punctuation: `Next.js`,
not `nextjs`.

Choose the best match - closest name, highest snippet count, strongest source
reputation - and note its ID, which always starts with `/`, for example
`/facebook/react`.

## Step 2 - query the documentation

```bash
ctx7 docs <libraryId> "<specific question>"
```

- Pass the full ID: `/org/project`, or `/org/project/version` to pin a version.
- One concept per call. Several narrow calls return better results than one broad
  question, unless the question is about how the concepts interact.
- Add `--language <lang>` to rank code examples in your language first.
- Add `--json` for structured output, and pipe through `jq` or `grep` when you
  only need a fragment.

## Worked example

```bash
ctx7 library pydantic "validating request payloads"
ctx7 docs /pydantic/pydantic "define a model with field validation constraints" --language Python
```

## Rules

- Always resolve before querying. `ctx7 docs react "hooks"` fails; the ID must be
  the full `/org/project` form returned by `ctx7 library`.
- Report which version the documentation came from when the ID pins one.
- Keep queries to one topic, and be specific: "How to set up JWT authentication in
  Express.js" beats "auth".
- Never put secrets, credentials, personal data, or proprietary code in a query.
  Queries are sent to the Context7 API.
- If `ctx7` is not on PATH, substitute `npx -y ctx7@latest`.
