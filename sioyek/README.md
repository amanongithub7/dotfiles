# sioyek

PDF viewer for research papers. `~/.config/sioyek` is symlinked to this
directory, so edits here are live (reload with `:` → `reload`, or restart).

| File | Purpose |
| --- | --- |
| `keys_user.config` | keybindings (overrides the built-in `keys.config`) |
| `prefs_user.config` | preferences: colours (Catppuccin Latte), scroll ratio, etc. |

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

- `visual_mark_color` must be **4 values** (`r g b alpha`); a hex value is
  rejected and silently falls back to the default.
- Unknown command names in `keys_user.config` are ignored **without warning** —
  verify a command exists in the built-in `keys.config` before relying on it
  (e.g. the previous `prev_page` was a no-op; the real name is `previous_page`).
- `<C-d>`/`<C-u>` move by `move_screen_ratio` (set to `0.5` = half page in
  `prefs_user.config`).

## LaTeX / VimTeX

VimTeX is configured to open PDFs in sioyek with `--new-window`. Use `<D-f>`
(or `F4` to toggle synctex mode) then right-click to jump back to the source.
See `nvim/guides/latex-guide.md`.
