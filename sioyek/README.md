# sioyek

PDF viewer for research papers. `~/.config/sioyek` is symlinked to this
directory, so edits here are live (reload with `:` → `reload`, or restart).

| File | Purpose |
| --- | --- |
| `keys_user.config` | keybindings (overrides the built-in `keys.config`) |
| `prefs_user.config` | preferences: startup behaviour, scroll ratio, cursor zoom, etc. (colours = stock defaults) |

Version tracked: sioyek 2.0.0 (Homebrew cask).

## Keybindings

`<D-..>` = Cmd, `<C-..>` = Ctrl, `<A-..>` = Option.

### Scrolling (no visual mark required)

| Key | Action |
| --- | --- |
| `<C-d>` / `<C-u>` | half page down / up (vim-style) |
| `<C-j>` / `<C-k>` | small step down / up |
| `<C-e>` / `<C-y>` | small step down / up |
| `<C-n>` / `<C-p>` | next / previous page |
| `<D-right>` / `<D-left>` | next / previous page |

### Search

`/term` then Enter commits the search; every match is highlighted from then on.

| Key | Action |
| --- | --- |
| `n` | next match (`next_item`) |
| `p` / `N` | previous match (`previous_item`; `N` is the stock binding, kept) |
| `<D-p>` twice | portal: press at the source, then at the destination (moved off `p`) |

Stock sioyek binds `n` to `next_item` and `Shift+n` to `previous_item`, but `p`
is `portal` — so "previous" was never on `p`. `p` now means previous match and
portals moved to `<D-p>`. Search is case-sensitive by default
(`case_sensitive_search`), so `/figure` will not find `Figure`.

**The `showing result 0 / N` gotcha.** After Enter, `search_text()` fills the hit
list but sets `current_search_result_index = -1`, so the status bar reads
`0 / N` and *no* hit is selected yet. Both keys run the same function with ±1
(`goto_search_result`), which does `mod(index + offset, N)`:

- `n` from `-1` → hit **1**, which with `super_fast_search` is the first
  occurrence on/after the page you are reading — usually the match already on
  screen, so the view barely moves and `n` looks dead.
- `p` from `-1` → `mod(-2, N)` → hit **N-1** (3 of 4), not the last one.

Once one hit is selected, `n`/`p` step normally. Upstream has the same wart
([#1438](https://github.com/ahrm/sioyek/issues/1438),
[#1562](https://github.com/ahrm/sioyek/issues/1562)) and the development branch
still leaves the index at `-1`, so no upgrade fixes it.

### Highlights

| Key | Action |
| --- | --- |
| select text + `h` + letter | add highlight (owns colours a–z) |
| `x` | **delete the highlight under the mouse cursor** |
| `dh` | delete the highlight you clicked on |
| `<D-e>` | edit the selected highlight's note |
| `<D-S-e>` | add a note to the selected highlight |
| `gnh` / `gNh` | next / previous highlight |
| `<D-s>` + letter | set the persistent highlight colour |
| `<D-S-s>` | highlight the current selection with that colour |
| `<D-a>` | toggle select-to-highlight mode |

### Navigation / misc

| Key | Action |
| --- | --- |
| `<D-f>` / `<D-S-f>` | overview / search |
| `<D-g>` | go to page number |
| `<D-t>` | table of contents |
| `<D-S-right>` / `<D-S-left>` | next / previous chapter |
| `<D-l>` | toggle PDF link highlighting |
| `<D-m>` | enter visual-mark mode (`<esc>` to exit) |
| `<D-j>` | smart jump |
| `<D-0>` / `<D-9>` | fit page height / width |
| `<D-d>` | toggle dark mode |

## Notes / gotchas

- **Don't resurrect the last document.** Sioyek reopens the last opened document
  when it starts with no file argument; on macOS a double-clicked/`open`ed PDF
  arrives as an Apple Event a moment later, so you'd get the old PDF *plus* the
  one you asked for in a second window (upstream
  [issue #1488](https://github.com/ahrm/sioyek/issues/1488)). `prefs_user.config`
  sets `open_last_file_on_startup 0` (the official fix — **development branch
  only**, the 2.0.0 cask ignores it) and `should_load_tutorial_when_no_other_file 0`
  (otherwise the bundled tutorial takes the empty window's place instead).
- **Do not set `should_launch_new_window 0`.** It does hide the resurrected
  document, but it also makes every PDF you open replace the one already on
  screen — no side-by-side reading. Left at the stock `1`.
- **The session file is neutered (how it's fixed on 2.0.0).**
  `~/Library/Application Support/sioyek/last_document_path.txt` is the file
  sioyek records the current document in, so it can reopen it next launch. It
  now contains a single line pointing at a path that does not exist and is
  `chmod 444`, so sioyek's write on quit fails silently and startup finds nothing
  to restore. Result: the PDF you open gets the first window, and a second PDF
  still opens in its own window. The old contents are kept next to it as
  `last_document_path.txt.orig`. **To undo:** delete the file (sioyek recreates
  it on the next quit) or restore `.orig` and `chmod 644` it.
- Colours are sioyek's stock defaults; `prefs_user.config` sets none. The old
  Catppuccin Latte/Mocha palette is in `git log -- sioyek/` if you want it back.
- If you do re-add colours: `visual_mark_color` must be **4 values**
  (`r g b alpha`); a hex value is rejected and silently falls back to the default.
- Unknown command names in `keys_user.config` are ignored **without warning** —
  verify a command exists in the built-in `keys.config` before relying on it
  (e.g. the previous `prev_page` was a no-op; the real name is `previous_page`).
- `<C-d>`/`<C-u>` move by `move_screen_ratio` (set to `0.5` = half page in
  `prefs_user.config`).

## LaTeX / VimTeX

VimTeX is configured to open PDFs in sioyek with `--new-window`. Use `<D-f>`
(or `F4` to toggle synctex mode) then right-click to jump back to the source.
See `nvim/guides/latex-guide.md`.
