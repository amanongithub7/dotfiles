<!-- BEGIN zotero-cli skill (managed by `zotero-mcp install-skill`) -->

## Zotero library access

Read and write a Zotero library from the shell with the `zotero-cli` command - search papers by keyword or meaning, read PDF full text and page ranges, get and set metadata, manage collections, tags, notes and annotations, add items by DOI/URL/ISBN, and export bibliographies. Use whenever the user asks about their Zotero library, references, citations, papers they have saved, or their reading notes.

Read `~/.config/opencode/skills/zotero-cli/SKILL.md` before using it. Prefer it over the Zotero MCP server when you have shell access: the MCP tool schemas cost ~13k tokens of context on every request, this costs only what you run.

Quick check that it is set up: `zotero-cli config`. Pass `--json` whenever you will parse the output.

<!-- END zotero-cli skill -->

## Literature notes (obsidian vault)

Literature notes live at `~/vaults/climate-crisis/research-papers-🔬/notes/<citekey>.md`
(fallback vault `~/vaults/personal`, same subpath). The filename stem and the
frontmatter `citekey:` field are the Better BibTeX citekey;
`zotero-cli search --mode citekey <key>` resolves it to the Zotero item.
`## 🖍️ Annotations` is machine-managed by nvim — never edit it; the user's own
writing lives in the `{% persist "summary" %}` block.

For questions about papers, prefer the `paper` agent (primary, Tab-switchable),
which encodes the full read-annotate-ask workflow.
