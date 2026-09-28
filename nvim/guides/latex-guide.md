# LaTeX in Neovim — Guide

Press `\lh` in any `.tex` buffer to reopen this guide (floating window; `q` closes).
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
| `\ll` | Compile (continuous `latexmk -pvc` by default — rebuilds on save) |
| `\lv` | Open viewer / forward search (source → PDF) |
| `\ls` | Toggle which file is the main file (multi-file projects) |
| `\lk` | Stop compiler for this file · `\lK` stop all |
| `\le` | Show errors in the quickfix window |
| `\lq` | Open compiler log · `\lo` compile output · `\lg` status |
| `\lc` | Clean aux files · `\lC` clean full (incl. PDF) |
| `\lt` | Open table of contents · `\lT` toggle TOC |
| `\lL` | Compile the selected region (visual/normal) · `\lS` single-shot compile |
| `\li` / `\lI` | VimTeX info / full info · `\lm` list math mappings |
| `\lr` | Reverse search (from viewer) · `\la` context menu (`Delete`, `Change`, etc.) |
| `\lx` / `\lX` | Reload VimTeX / reload project state |

Typical loop:

1. In `main.tex` press `\ll`. `latexmk -pvc` starts; the first successful build
   **auto-opens sioyek** and forward-searches to your cursor.
2. Edit and `:w` → latexmk rebuilds → **sioyek live-reloads**.
3. `\lv` jumps from source to the PDF.
4. In sioyek press **F4** (toggle synctex) then **right-click** to jump back to
   the exact source line in Neovim.

VimTeX viewer options include `--reuse-window`, so preview reuses one sioyek
window (opening an unrelated PDF still gets its own window).

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

## 6. Bibliographies

`biber` and `bibtex` are installed. With `biblatex`:

```latex
\usepackage[backend=biber]{biblatex}
\addbibresource{refs.bib}
...
\nocite{*}
\printbibliography
```

`latexmk` runs biber/bibtex automatically during `\ll`. Cite with the `cite`
snippet or the Zotero integration in this config.

---

## 7. Multi-file projects

- Put a magic comment at the top of sub-files: `%! TeX root = main.tex`.
- Or set the main file interactively with `\ls`.
- `\input`, `\include`, and `subfiles` are supported; VimTeX tracks the project
  from the main file.

---

## 8. Chinese / CJK text

`pdflatex` cannot typeset Unicode CJK characters — you get
`LaTeX Error: Unicode character …`. Compile such documents with **XeLaTeX**.

No extra installs needed:

```latex
% !TEX program = xelatex          % first line; VimTeX compiles with xelatex
\documentclass[11pt]{article}
\usepackage{fontspec}
\newfontfamily\cjkfont{Songti SC}       % any macOS CJK font
\newcommand{\zh}[1]{{\cjkfont #1}}      % wrap Chinese text: \zh{白雅铭}
```

Then open the file and `\ll` as usual.

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
- **Clean before sharing:** `\lc` (aux) or `\lC` (aux + PDF).

---

## 10. Files in this setup

| File | Purpose |
| --- | --- |
| `nvim/lua/plugins/latex.lua` | VimTeX config, sioyek viewer, `:TexNewReport`, `\lh` |
| `nvim/snippets/latex.json` | Project LaTeX snippets (`report`) |
| `sioyek/prefs_user.config` | sioyek preferences (colors, window behavior) |
| `nvim/guides/latex-guide.md` | This guide |
