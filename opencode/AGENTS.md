<!-- BEGIN zotero-cli skill (managed by `zotero-mcp install-skill`) -->

## Zotero library access

Read and write a Zotero library from the shell with the `zotero-cli` command - search papers by keyword or meaning, read PDF full text and page ranges, get and set metadata, manage collections, tags, notes and annotations, add items by DOI/URL/ISBN, and export bibliographies.

Prefer the `zotero-cli` shell tool over the Zotero MCP server: the MCP tool schemas cost ~13k tokens of context on every request, this costs only what you run. Load the `zotero-cli` skill for the full command reference and do not restate it here.

<!-- END zotero-cli skill -->

For anything involving papers, references, citations, or literature notes, prefer
the `Paper` agent (primary, Tab-switchable). It already carries the vault layout,
the citekey bridge, and the annotation-color conventions.

For research and analysis work whose deliverable is a document - desk research,
market or policy surveys, comparisons, cost/benefit and financial modelling,
reports and printable PDFs - prefer the `General Assistant` agent. It carries the
evidence-labelling, source-ranking and file-output conventions, and writes durable
findings to the `memory` MCP server so they survive across sessions.
