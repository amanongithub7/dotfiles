# Notebooks (`.ipynb`) in Neovim — Guide

Press `\h` in a notebook buffer — or in a jupytext `.md` twin that has a
sibling `.ipynb` — to reopen this guide (floating window; `q`, `<Esc>` or `\h`
again closes it). From anywhere: `:NotebookGuide`.
Leader keys: `<leader>` = `Space`, `<localleader>` = `\` (see
`lua/config/options.lua`).

Tooling: **jupytext.nvim** (`.ipynb` ⇄ markdown), **molten-nvim** (run cells),
**quarto-nvim + otter.nvim** (Python LSP/completion inside fences),
**render-markdown** (display), **image.nvim** (plots/images),
**nvim-treesitter-textobjects** (`@code_cell` navigation).

A notebook opened in Neovim is not JSON on screen: jupytext converts it to its
markdown representation, and the buffer has `ft=quarto`. Markdown cells are
plain prose; code cells are fenced blocks:

````markdown
# Experiments

Some prose.

```python
import math
print(math.pi)
```
````

Every "cell" operation below works on those fences.

---

## 1. Open, create, save

| Action | How |
| --- | --- |
| Open | `nvim nb.ipynb` — jupytext shows the markdown twin, imports outputs with molten |
| Create | `:NewNotebook path/name` — appends `.ipynb`, creates parent dirs, writes a valid nbformat 4.5 template and opens it |
| Empty/missing notebook | Just open it: `config/notebook.lua` seeds it with the template before jupytext/molten see it (no more "not a valid ipynb") |
| Save | `:w` — writes `<name>.md` next to the notebook, regenerates the `.ipynb`, then exports molten outputs if a kernel is initialised |
| Regenerate from the `.md` twin | `:JupytextSync` (works from either side of the pair) |
| Stop a bad write | The `BufWritePre` guard refuses to write non-JSON into an `.ipynb`; the error message prints the `jupytext` command that restores it |

The markdown twin on disk (`nb.md`) is a real file: edits there do **not** touch
`nb.ipynb` until you run `:JupytextSync` or save the notebook.

---

## 2. Kernel

On open, molten auto-inits a kernel. Priority: explicit per-notebook binding >
the notebook's `metadata.kernelspec.name` > `VIRTUAL_ENV`/`CONDA_PREFIX`.

| Key | Action |
| --- | --- |
| `\mi` | `:MoltenInit` (pick a kernel by name) |
| `\mk` | Switch kernel **and remember it for this notebook** (binding is stored in `stdpath("data")/molten/bindings.json`) |
| `\x` | Interrupt the kernel |
| `\R` | Restart the kernel |
| `\ms` / `\ml` | Save / load kernel state on disk |
| `\md` | Delete the molten cell under the cursor (drops its output) |

List installed kernels with `jupyter kernelspec list`. If a kernel is missing,
create it with `python -m ipykernel install --user --name <env>` and then `\mk`.

---

## 3. Run cells

| Key | Action |
| --- | --- |
| `\rc` | Run the code cell under the cursor |
| `\rA` | Run all cells |
| `\ra` | Run the cell under the cursor and all above it |
| `\rl` | Run the current line |
| `\rr` | Re-run the cell (only works on a cell that has already run) |
| `\e` then a motion | Evaluate a motion, e.g. `\eap` for a paragraph or `\eib` |
| `\r` (visual) | Evaluate the selection |
| `<leader>mc` | Same as `\rc` |
| `<leader>mr` | `:MoltenEvaluateLine` |

`\rc` finds the fenced block under the cursor and calls `MoltenEvaluateRange`, so
the cursor only has to be *inside* the fence, not on its first line.

---

## 4. Navigate cells

| Key | Action |
| --- | --- |
| `]b` | Next code cell |
| `[b` | Previous code cell (from inside a cell it first jumps to that cell's start) |
| `3]b` / `3[b` | Repeat the jump (counts work) |

From a markdown/prose cell, `]b` lands on the next fenced code block; from inside
a code cell it moves to the next one. These are buffer-local maps, because
LazyVim's global `]b`/`[b` mean "next/previous buffer" — in a notebook buffer the
cell navigation wins, and in plain `.md` files markdown-plus already reuses `]b`
for code-block jumps, so the key means the same thing on both sides of a
jupytext pair.

Cell selection text objects (`ib`/`ab`) are **not** wired up in notebooks.

For larger jumps:

- `]]` / `[[` — next/previous LSP reference (LazyVim default), not headers.
- Search: `/^#` then `n` to walk headings.
- Quickfix/trouble are not notebook-aware; use the fence jumps.

---

## 5. Editing markdown cells

- Markdown cells are ordinary markdown: treesitter highlighting,
  render-markdown (concealed headings/bullets/code fences), spell check off by
  default.
- `markdown-plus` keymaps (`\mb` bold, `\ltt` task lists, `\ht` TOC, …) are bound
  in `ft=markdown` buffers only, so they are **not** available inside a
  notebook buffer. Use plain markdown or edit the `.md` twin.
- Python inside fences gets real LSP help: completion, hover, diagnostics and
  formatting through otter.nvim (quarto's `lspFeatures`), even though the buffer
  is markdown.

### Wrapping

Two independent layers:

1. **Soft wrap (display only).** Long prose **and** long code lines wrap on
   screen, with `linebreak` and `breakindent`. Nothing is written to the buffer,
   so Python lines stay intact on `:w` and in the `.ipynb`. This is the
   `prose-wrap` autocmd in `lua/config/autocmds.lua`.
2. **Hard wrap (real newlines) — markdown prose only.** The buffer gets a
   **fixed** `textwidth` of 80 (`PROSE_WIDTH` in `ftplugin/quarto.lua`) plus the
   global `formatoptions` `t`, so prose wraps while you type and with `gq`. The
   width does not follow the window — markdown cells are saved into the `.ipynb`,
   so the file's line length must not depend on the screen it was edited on; 80
   is the max line length, and `gq` reflows existing longer paragraphs to it.
   `'formatexpr'` (`lua/config/notebook-format.lua`, installed from
   `after/ftplugin/quarto.lua`) gates it: a range inside a code fence or in the
   jupytext frontmatter is skipped, so Python lines are never split.

| Want | How |
| --- | --- |
| Toggle soft wrap for this window | `:set wrap!` |
| Re-wrap the paragraph under the cursor | `gqap` |
| Change the 80-column max for this buffer | `:setlocal tw=72` (or edit `PROSE_WIDTH`) |
| Stop the automatic hard wrap | `:setlocal formatoptions-=t` |

Wrapped prose becomes part of the markdown cell on save; code cells are never
touched.

---

## 6. Outputs

Output is rendered as virtual text under the cell by default.

| Key | Action |
| --- | --- |
| `\os` | Show the output float and put the cursor in it |
| `\oh` | Hide the output |
| `\oe` | Expand the output float to fit the whole buffer (only while inside the float) |
| `\ob` | Open the output in a browser (HTML outputs) |
| `\i` | Image popup for the plot under the cursor |
| `\my` | Yank the output |

Config (`lua/plugins/python.lua`): `molten_auto_open_output = false`,
`molten_enter_output_behavior = "open_and_enter"`, `molten_output_win_max_height = 20`,
virt-text output on, wrapped, `molten_virt_lines_off_by_1` so output sits below
the closing fence. Plots are drawn through image.nvim, so the terminal must
support images (kitty/ghostty protocol).

---

## 7. Saving, outputs round-trip

1. Run cells (`\rc`, `\rA`, …).
2. `:w` → jupytext rewrites `nb.md` and `nb.ipynb`; `MoltenExportOutput!` stores
   the outputs in the notebook JSON.
3. The notebook you hand back includes outputs, like a Jupyter save.

Notes:

- The export only runs when a kernel is initialised in that buffer.
- Saving can take ~0.5 s on large notebooks (jupytext + export). Avoid autosave
  plugins while running cells.
- If you only edited `nb.md`, use `:JupytextSync` — a plain `:w` there does not
  touch the `.ipynb`.

---

## 8. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `molten: skipped X — not a valid ipynb` | The file is not JSON (corrupt, or a markdown twin saved as `.ipynb`). Empty/missing files are auto-seeded; otherwise restore from the `.md` twin with the `jupytext` command printed by the guard |
| `blocked write to X — buffer is not JSON` | Safety guard refused to clobber an `.ipynb` with markdown. Restore with `jupytext --to ipynb -o X.ipynb X.md` |
| `No kernel found` / `MoltenInit` fails | `jupyter kernelspec list`; install a kernel; `\mk` to pick one |
| `cursor is not inside a code cell` | `\rc` was pressed outside a fenced block — move into the fence |
| `MoltenEvaluateCell` / `MoltenReevaluateCell` does nothing | The cell has to have run at least once; use `\rc` first |
| Remote plugin errors about molten | `:UpdateRemotePlugins` then restart; check `:checkhealth molten` and `:checkhealth provider` |
| `jupytext` not found | `pip install jupytext` in the Python that provides `jupytext` on `PATH` |
| Plots invisible | image.nvim needs a terminal with image support; `:checkhealth image` |
| nbformat `MissingIDFieldWarning` | The file came from a tool that omits cell ids; jupytext adds them on the next round-trip |

If Neovim itself misbehaves while editing a notebook, `:messages` is the first
place to look — jupytext/molten write there.

---

## 9. Files in this setup

| File | Role |
| --- | --- |
| `lua/plugins/python.lua` | jupytext, quarto-nvim (LSP + runner), molten settings, `:JupytextSync` |
| `lua/plugins/markdown.lua` | markdown-plus, markdown-preview, obsidian, render-markdown, markdown-toc |
| `lua/plugins/treesitter.lua` | textobjects configuration (`@code_cell` moves/selects) |
| `after/queries/markdown/textobjects.scm` | `@code_cell.inner` / `@code_cell.outer` captures |
| `lua/config/autocmds.lua` | molten init/import/export, the JSON write guard, prose soft-wrap, `:NewNotebook`, `:NotebookGuide` |
| `lua/config/notebook-format.lua` | `formatexpr` that hard-wraps prose but not code fences/frontmatter |
| `after/ftplugin/quarto.lua` | installs that `formatexpr` after the runtime quarto/rmd ftplugins |
| `lua/config/notebook.lua` | nbformat template + auto-seed of empty/missing notebooks |
| `lua/config/notebook-guide.lua` | this guide's floating viewer |
| `lua/molten-kernel.lua` | per-notebook kernel bindings (`\mk`) |
| `ftplugin/quarto.lua` | notebook keymaps (run, kernel, output, `]b`/`[b`, `\h`) |
| `ftplugin/markdown.lua` | `.md` twin keymaps (link following, quarto activation) |
| `guides/notebook-guide.md` | this guide |
