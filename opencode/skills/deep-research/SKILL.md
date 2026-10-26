---
name: deep-research
description: Run source-grounded desk research and report it with provenance. Use for market and price surveys, product or vendor comparisons, policy and regulation reading, availability checks, "what are my options" questions, and any question where believing a wrong fact would be expensive. Covers pinning the question, decomposing it, gathering sources in parallel, ranking and dating evidence, resolving contradictions, and reporting what is verified versus estimated.
---

# Deep research

Use this for questions whose answer must survive scrutiny: prices, availability,
specifications, regulations, timelines, eligibility rules, market conditions.
Skip it for opinions, brainstorming, or anything you can answer from knowledge.

The failure mode this skill prevents is a fluent answer built on one weak source,
with no way for the reader to tell which sentences are load-bearing.

## 1. Pin the question before searching

Write down, explicitly:

- **The decision** the answer feeds. "Which bike to buy", not "bikes".
- **The options** under consideration, including one null option ("buy nothing",
  "wait").
- **The criteria** that decide between them, in priority order.
- **The constraints** that eliminate options outright.
- **The deadline** after which the answer is void.

If a missing fact would change which option wins, that fact is the research
target. Everything else is decoration. Do not start searching until you can name
the target.

## 2. Decompose into independent sub-questions

Split the target into sub-questions that can be answered **without depending on
each other**. Independence is what makes parallelism possible in step 3.

For each sub-question, decide in advance what a good answer looks like and which
source class should be able to answer it. A sub-question no source can answer is
a finding in itself: report it as unresolvable rather than guessing.

## 3. Gather in parallel

Dispatch independent sub-questions concurrently — `subagent` with `agent:
"general"` — instead of running them one after another. Give each subagent the
sub-question, the criteria for a good answer, the source classes to prefer, and
the output format you want back (a short list of dated facts with URLs, not
prose).

Load other skills when the sub-question is really about something else: `find-docs`
for library and API behaviour, `zotero-cli` for the literature base, `pdf`/`xlsx`
for reading attached documents.

## 4. Rank every source, and date every fact

Three classes, best first:

1. **Primary** — the thing itself. Official registers and databases, statutes and
   regulator notices, vendor spec sheets and price pages, government process
   guides, filings, a price tag photographed in the shop.
2. **Secondary** — reporting on the thing. Newspapers, trade press, reputable
   review sites. Good for context, lead generation and corroboration; not for the
   final number if a primary source exists.
3. **Anecdote** — forum posts, social media, shop-floor hearsay, a single
   reviewer. Use it to discover what to check and to flag risk. Never present it
   as the answer.

For every fact you keep, record **the value, the source, the URL, and the date
you retrieved it**. Prices, stock, policy and product line-ups move; an undated
fact is a liability. When a source is itself dated (a Feb 2026 review, a 2025
spec sheet), note that separately from your retrieval date — a stale source
retrieved today is still stale.

## 5. Triangulate, and handle contradictions out loud

- Confirm load-bearing facts with a **second, independent** source. Two pages
  copying the same press release are one source.
- When sources disagree, do not average them and do not silently pick one. State
  the disagreement, state which you believe and why (recency, primacy of source,
  proximity to the thing described), and state what would settle it.
- When a number is yours rather than a source's — a projection, a probability, a
  residual value, a rate — say so at the point of use, not in a footnote.

## 6. Report

- **Answer first.** The recommendation in the opening paragraph.
- **Tables for comparisons.** One row per option, one column per criterion, units
  in the header. A reader should be able to check the decision without reading
  the prose.
- **Do the arithmetic visibly.** Show inputs, show the operation, then the result.
  Keep the model's assumptions in one place so they can be attacked.
- **Label provenance** on every load-bearing number: `VERIFIED` with source and
  date, or `ESTIMATED` with the basis. Never let an estimate wear the clothes of a
  measurement.
- **Close with the limits.** What you could not verify, what you are assuming,
  and what new information would flip the recommendation. This section is not
  optional and is usually the most useful part.

## 7. Persist what was expensive

Save the durable results so a later session does not re-derive them: entities for
the things studied, observations for verified facts and settled decisions,
relations for how they connect. Use the `memory` tools.

Worth saving: verified prices and specs, identifiers (model numbers, certificate
numbers, addresses, phone numbers), eligibility and process rules, and the
reasoning behind a decision. Not worth saving: transient stock states, search
queries already run, and anything you would not defend in a month.

## Anti-patterns

- Answering before naming the decision the answer feeds.
- One source, repeated across pages, treated as corroboration.
- A percentage presented as market data when it is your judgement.
- Serial searching where the sub-questions were independent.
- Reporting a stale source as current because you only just found it.
- Smoothing over a contradiction instead of surfacing it.
- Omitting the "what I could not verify" section because the answer looks tidy.
