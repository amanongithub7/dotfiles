# LaTeX in Neovim — Guide

Press `\h` in any `.tex` buffer to reopen this guide (floating window; `q` closes).
Leader for LaTeX is `<localleader>` = `\` (see `config/options.lua`).

Tooling: **VimTeX** (compile/view/sync), **texlab** LSP (completion, diagnostics,
goto), **friendly-snippets** + mini.snippets, PDF viewer **sioyek** (synctex).

---

## 1. Create a new project

| Action | How |
| --- | --- |
| One-page report | `:TexNewReport` (creates `./main.tex`) or `:TexNewReport my-report` (creates `my-report/main.tex`) |
| From snippet | open an empty `.tex` and expand the `report` snippet (or `template` for a fuller skeleton) |
| Manual | `nvim main.tex` — VimTeX treats a lone `.tex` as the main file |

BasicTeX is installed; add missing packages with `sudo tlmgr install <package>`.

---

## 2. Compile & live preview

| Key | Action |
| --- | --- |
| `\l` | Compile (continuous `latexmk -pvc` by default — rebuilds on save) |
| `\v` | Open viewer / forward search (source → PDF) |
| `\s` | Toggle which file is the main file (multi-file projects) |
| `\k` | Stop compiler for this file · `\K` stop all |
| `\e` | Show errors in the quickfix window |
| `\q` | Open compiler log · `\o` compile output · `\g` status |
| `\c` | Clean aux files · `\C` clean full (incl. PDF) |
| `\t` | Open table of contents · `\T` toggle TOC |
| `\L` | Compile the selected region (visual/normal) · `\S` single-shot compile |
| `\i` / `\I` | VimTeX info / full info · `\m` list math mappings |
| `\r` | Reverse search (from viewer) · `\a` context menu (`Delete`, `Change`, etc.) |
| `\x` / `\X` | Reload VimTeX / reload project state |

Typical loop:

1. In `main.tex` press `\l`. `latexmk -pvc` starts; the first successful build
   **auto-opens sioyek** and forward-searches to your cursor.
2. Edit and `:w` → latexmk rebuilds → **sioyek live-reloads**.
3. `\v` jumps from source to the PDF.
4. In sioyek press **F4** (toggle synctex) then **right-click** to jump back to
   the exact source line in Neovim.

The VimTeX viewer passes `--new-window`, so a compiled PDF opens in its own
sioyek window instead of replacing another open PDF; recompiling the *same*
document reuses that window, so live preview stays in place.

---

## 3. Navigate

| Key | Action |
| --- | --- |
| `%` | Jump between matching `\begin`/`\end`, `\(`/`\)`, `\[`/`\]`, `{}` |
| `]]` / `[[` | Next / previous section (`\section`, …) |
| `][` / `[]` | Next / previous `\begin`…`\end` environment |
| `]m` / `[m` | Next / previous math environment (`]M` / `[M` for inner) |
| `]n` / `[n` | Next / previous command (`]N` / `[N` for inner) |
| `]r` / `[r` | Next / previous frame (beamer) |
| `]*` / `[*` | Next / previous starred command/environment |
| `K` | Documentation for the command under the cursor |

LSP (texlab), via LazyVim: `gd` definition, `gr` references, `K` hover,
`<leader>ca` code action, `<leader>cr` rename, etc.

---

## 4. Edit — VimTeX text objects & toggles

Text objects (work with `d`, `c`, `y`, `v`, …):

| Object | Selects |
| --- | --- |
| `ac` / `ic` | a / inner command |
| `ad` / `id` | a / inner delimiter |
| `ae` / `ie` | a / inner environment |
| `a$` / `i$` | a / inner math zone |
| `aP` / `iP` | a / inner `\left…\right` pair |
| `am` / `im` | a / inner item in `itemize`/`enumerate` |

Convenience mappings:

| Key | Action |
| --- | --- |
| `dse` / `cse` | Delete / change surrounding environment |
| `dsc` / `csc` | Delete / change surrounding command |
| `ds$` / `cs$` | Delete / change surrounding math zone |
| `dsd` / `csd` | Delete / change surrounding delimiter |
| `tsc` | Toggle command star (`\cmd` ⇄ `\cmd*`) |
| `tss` / `tse` / `ts$` | Toggle env star / toggle env name / toggle math env |
| `tsd` / `tsD` | Toggle `\left`/`\right` modifiers (forward / reverse) |
| `tsf` | Toggle `\frac` ⇄ inline form |
| `tsb` | Toggle `\big`/`\Big`/… break size |
| `<F6>` | Surround with environment (normal / visual) |
| `<F7>` | Prompt for a command to insert |
| `<F8>` | Add `\left`/`\right` modifiers to delimiters |

### Formatting & line length

`.tex` and `.bib` files are auto-formatted on save by **tex-fmt** (via conform),
which wraps long lines to **80** columns and normalizes indentation. Verbatim
environments (`verbatim`, `minted`, `lstlisting`) are skipped automatically.

| Key | Action |
| --- | --- |
| `<leader>cf` | Format the current file now |
| `<leader>uF` | Toggle autoformat for this buffer · `<leader>uf` global |
| `% tex-fmt: skip` | Don't format this line |
| `% tex-fmt: off` / `% tex-fmt: on` | Don't format the block between them |

Change the width in `nvim/lua/plugins/lang-servers-and-tools.lua`
(`--wraplen`); tex-fmt also reindents, so it is not wrap-only.

---

## 5. Snippets

Expand with blink-cmp completion (Tab) or `:lua MiniSnippets.expand()`.

Project snippets (this config):

| Prefix | Expands to |
| --- | --- |
| `report` | one-page report skeleton (this repo) |
| `template` | full article template (friendly-snippets) |

Common friendly-snippets (LaTeX + BibTeX):

- Structure: `part`, `cha`, `sec`, `sub`, `subs`, `begin`, `empty`, `par`, `page`
- Lists: `itemize`, `enumerate`, `item`, `compactitem`
- Floats: `figure`, `figure:ref`, `table`, `table:ref`, `listing:ref`
- Math: `math`, `displaymath`, `equation`, `mathinline`, `mathcentered`,
  `fractioninline`, `fractionlarge`, `suminline`, `sumlarge`,
  `integralinline`, `integrallarge`, `aligntext`
- Text: `bold`, `italic`, `bolditalic`, `\section`, `\subsection`, `header`,
  `headersmall`, `\itemize`, `\tab` (table), `cite`, `to`
- Theorem-like: `theorem`, `proof`, `problem`, `solution`, `definition`
- Academic (ACM) figures/tables: `figure:acm`, `table:acm`
- Aliases (typing shortcuts): `ali`, `aligntext`, `cas`, `desc`, `spl`, `state`,
  `for`, `while`, `if`
- BibTeX entries: `@article`, `@book`, `@inproceedings`, `@misc`, `@phdthesis`,
  `@techreport`, `@online` (as `@…` prefixes inside `.bib` files)
- Plot (pgfplots): `plotline2d`, `plotgraph2d`, `plotgraph3d`,
  `plotenvironment3d`

Tip: with completion open, type a snippet prefix and accept it; `<Tab>`/`<S-Tab>`
jump between placeholders.

---

## 6. Citations & bibliography

### The pipeline

```
browser ──► Zotero (Connector) ──► Better BibTeX auto-export ──► nvim ──► \cite{key} ──► latexmk + biber
                                   library.bib                    picker / completion
```

One auto-exported file is the source of truth for the whole config:

```
~/climate-crisis/research-papers/organization-tools/zotero/exports/library.bib
```

Both the `<leader>zl` picker (`lua/zotero/init.lua`) and citation completion
(`blink-cmp-bibtex`, configured in `lua/plugins/cmp.lua`) read it. **Never
hand-edit it** — BBT overwrites it on every change.

### Capture a paper

- **Browser (recommended):** the Zotero Connector extension. Click the connector
  button (or right-click → *Save to Zotero*) on the paper's page. It saves
  metadata **and** the PDF attachment — the attachment is what drives
  `zotero://open-pdf/...`, notes and annotations.
- **Shell:** when you only have an identifier (`zotero-cli` is on your PATH; the
  Zotero desktop app must be running with its local API on):

```sh
zotero-cli add doi 10.1038/s41586-021-03819-2
zotero-cli add url https://arxiv.org/abs/2401.01234
zotero-cli add file ~/Downloads/paper.pdf
```

BBT refreshes `library.bib` on change; if nvim's cache looks stale, `<leader>zr`.

### Point the document at a bibliography

Use the shared export directly (every project stays in sync):

```latex
\addbibresource{/Users/aman/climate-crisis/research-papers/organization-tools/zotero/exports/library.bib}
```

…or export only **one collection** (Zotero: right-click collection →
*Export Collection…* → Better BibTeX → target `exports/<paper>.bib` → tick **Keep
updated**) and cite that. A collection export contains items directly in that
collection, not its subcollections.

### APA 7

`biblatex-apa` implements the APA 7th edition and is already installed in the
user texmf tree. APA **requires biber**:

```latex
\usepackage[american]{babel}
\usepackage{csquotes}                            % required by biblatex-apa
\usepackage[style=apa,backend=biber]{biblatex}
\DeclareLanguageMapping{american}{american-apa}  % APA date/term strings
\addbibresource{.../exports/library.bib}

\begin{document}
\parencite{key}   % (Author, Year)
\textcite{key}    % Author (Year)
\printbibliography
\end{document}
```

The BBT BibTeX-flavor export works unchanged: biblatex maps `journal` →
`journaltitle`, and `year`/`month` are valid fields (BBT *Better BibLaTeX* with
native `date`/`journaltitle` is also fine). Brace protection (`{{Title}}`) is
respected, so APA sentence-case won't de-capitalize titles.

Any other style is the same block with `style=<name>` instead of `apa`
(`authoryear`, `ieee`, …) and no `\DeclareLanguageMapping`.

### APA 7 — the `apa7` document class

`biblatex-apa` above is a **style** applied to an ordinary class. For the full
APA paper layout — title page, running head, author note, `[stu]` student mode —
use the **`apa7` document class** instead:

```latex
% !TEX program = xelatex
\documentclass[stu]{apa7}

\usepackage{amsmath,amssymb}
\usepackage[american]{babel}
\usepackage{csquotes}                            % required by biblatex-apa
\usepackage[style=apa,backend=biber]{biblatex}
\DeclareLanguageMapping{american}{american-apa}
\addbibresource{refs.bib}

\title{...}  \shorttitle{...}  \author{...}
\affiliation{...}  \course{...}  \professor{...}  \duedate{...}
```

Two traps:

- **Don't also load `geometry`.** `apa7.cls` loads it with 1-inch margins
  itself, so `\usepackage[margin=1in]{geometry}` dies with
  `Option clash for package geometry`. Margins are already correct.
- **`apa7` does not load biblatex for you** in `[stu]` mode (it logs
  *"defaulting to (but not loading) Biblatex"*), so load it yourself as above.
  The alternative is the class option `[stu,biblatex]` with your own
  `\usepackage{biblatex}` removed — but never both.

On **BasicTeX** an `apa7` install is incomplete: TeX Live declares no
dependencies for the package, so `sudo tlmgr install apa7` pulls only the class
and the first compile dies on `scalerel.sty` (then `threeparttable.sty`,
`endfloat.sty`, …):

```sh
sudo tlmgr install scalerel threeparttable endfloat
# or, to end the whack-a-mole:
sudo tlmgr install collection-latexextra
```

### Insert a citation

Two routes; both need the document to declare a `\addbibresource`.

| Route | How |
| --- | --- |
| Completion | type `\cite{` (or `\parencite{`, `\textcite{`, `\footcite{`) → blink completes keys with APA preview; `[G]` = global `library.bib`, `[L]` = the project's bib |
| Picker | `<leader>zl` (Literature Menu) → type to filter → **Enter inserts** at the cursor |

Inside the picker: `o` open the PDF in Zotero · `n` open/create the literature
note · `y` yank the citekey. The insert is filetype-aware: `.tex` → `\cite{key}`,
Markdown → `[@key]`. Compile as usual (`\l`) — latexmk runs biber/bibtex itself.

### Shared export vs a local `refs.bib`

| Aspect | Shared / collection auto-export | Local project `refs.bib` |
| --- | --- | --- |
| Stays current | ✅ automatically | ❌ you re-export |
| Self-contained, shippable | ❌ lives outside the project | ✅ |
| Frozen keys / reproducible | ❌ keys can change if the item is edited | ✅ |
| Works on Overleaf / other machines | ❌ absolute path baked in | ✅ |

- **While drafting:** cite against the shared (or collection) export — new
  captures flow straight into completion and `<leader>zl`.
- **Before sharing/submitting:** snapshot a project `refs.bib` so the build is
  self-contained and keys are frozen. Best of both: give each paper a Zotero
  collection and have it export straight into the project (below).

### Maintain a local `refs.bib`

1. **BBT exports straight into the project (recommended).** Same as the
   collection export above, but target `<project>/refs.bib` with **Keep
   updated**. Version-controllable and still auto-refreshing; note BBT stores
   the absolute path, so moving the project stops the refresh.
2. **Stable export + symlink.** Keep BBT exporting to the shared dir, then
   `ln -s ~/…/exports/paper-x.bib refs.bib` — stable project paths, but the
   symlink target is machine-specific (re-link on Overleaf).
3. **One-off snapshot with `zotero-cli`** (frozen archive; it prints a fenced
   Markdown block, so it must be unwrapped):

````sh
zotero-cli --json export --format bibtex --collection A3ZIC9KC \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["bibliography"])' \
  | sed -n '/```bibtex/,/```/p' | sed '1d;$d' > refs.bib
````

`--format bibtex` is a `.bib`; `--format bib` is a *formatted* CSL bibliography,
not a file.

### Literature notes & gotchas

| Key | Action |
| --- | --- |
| `<leader>zl` | Literature Menu — search the bib, insert a citation |
| `<leader>zr` | Reload the bibliography cache |
| `<leader>zo` / `<leader>zn` | Open the paper in Zotero / open-or-create the literature note (notes only) |
| `<leader>zN` | Create/refresh the literature note (notes only) |
| `<leader>za` | Insert the note's annotations at the cursor (notes only) |
| `<leader>zq` | Ask opencode's `paper` agent about the paper (notes only) |

- **`library.bib` is generated.** Edit items in Zotero, not the file.
- **Pin BBT citation keys** for a paper you're writing — unpinned keys can
  change when an item changes, breaking an existing `\cite{}`.
- **Nothing in the picker/completion?** `<leader>zr`, and check BBT's
  auto-export is still armed in Zotero.
- The `<leader>zl` picker searches the shared `library.bib` regardless of which
  bib the document loads; completion always follows the document's
  `\addbibresource`.

---

## 7. Multi-file projects

- Put a magic comment at the top of sub-files: `%! TeX root = main.tex`.
- Or set the main file interactively with `\s`.
- `\input`, `\include`, and `subfiles` are supported; VimTeX tracks the project
  from the main file.

---

## 8. Chinese / CJK text

`pdflatex` cannot typeset Unicode CJK characters — you get
`LaTeX Error: Unicode character …`. Compile such documents with **XeLaTeX**.

No extra installs needed:

```latex
% !TEX program = xelatex
\documentclass[11pt]{article}
\usepackage{fontspec}
\newfontfamily\cjkfont{Songti SC}       % any macOS CJK font
\newcommand{\zh}[1]{{\cjkfont #1}}      % wrap Chinese text: \zh{白雅铭}
```

The `% !TEX program` directive must be **alone on its line** — VimTeX captures
everything after `=` to end of line, so a trailing comment makes the engine name
unparseable and it silently falls back to pdflatex (check the log's first line
for `pdfTeX` vs `XeTeX`).

Then open the file and `\l` as usual.

Automatic CJK (recommended if you write a lot of Chinese) uses the **ctex**
bundle instead of a manual macro. This requires a consistent TeX Live install:

```sh
sudo tlmgr update --self --all
sudo tlmgr install ctex
```

then keep `% !TEX program = xelatex` and use
`\usepackage[fontset=fandol]{ctex}` (or `fontset=mac`). Never mix `tlmgr
--usermode` packages with a frozen release — newer packages shadow the system
but mismatch its LaTeX format.

---

## 9. Tips & troubleshooting

- **Nothing compiles?** Ensure `latexmk` is installed (`latexmk -v`); VimTeX's
  default compiler is latexmk.
- **PDF doesn't open / no sync?** Inverse search calls
  `/opt/homebrew/bin/nvim` (set via `vimtex_callback_progpath`). In sioyek,
  press `F4` and right-click to inverse-search.
- **Engine:** default is `pdflatex`. Add `% !TEX program = xelatex` to a file
  (see §8) for Unicode/CJK/OpenType fonts.
- **Warnings:** the quickfix does not auto-open on warnings (only errors).
- **Stale errors after installing a package?** VimTeX keeps showing the last
  quickfix list, and `\l` may think the job is up to date. Force a rebuild:
  `\c` (clean aux) then `\l`. Check the log's first line to confirm which engine
  actually ran.
- **Clean before sharing:** `\c` (aux) or `\C` (aux + PDF).

---

## 10. Files in this setup

| File | Purpose |
| --- | --- |
| `nvim/lua/plugins/latex.lua` | VimTeX config, sioyek viewer, `:TexNewReport`, `\h` |
| `nvim/snippets/latex.json` | Project LaTeX snippets (`report`) |
| `nvim/lua/zotero/init.lua` | Zotero integration: `<leader>zl` picker, citekey insert, notes |
| `nvim/lua/plugins/cmp.lua` | `blink-cmp-bibtex` citation completion from `library.bib` |
| `sioyek/prefs_user.config` | sioyek preferences (colors, window behavior) |
| `nvim/guides/latex-guide.md` | This guide |
