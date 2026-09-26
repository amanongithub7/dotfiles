# Keymaps Overhaul — EXECUTED

Status: **implemented and verified** (headless map-table audit after full startup).
Nothing is committed yet. Original audit notes are preserved at the bottom for
reference; see "Execution log" for what actually landed.

## What you need to know after restarting nvim

- The purge of LazyVim defaults runs **~2s after startup** (after all plugin
  registrations settle). Don't panic if a dead key still works in the first
  second or two.
- `:WhichKey <leader>` should match the "Final state" table below.
- `<leader>b` is now the buffer picker; press `x` on an entry to delete that
  buffer (`<A-p>` pins).
- `<leader>e` opens the Snacks explorer directly.
- `<leader>w-` / `<leader>w|` split below / right (in the windows group).
- Test keys live under `<leader>t` (the `+test` group) and only exist in Python
  buffers now.
- `<leader>gsa` / `<leader>gsd` are surround add/delete (was `sa`/`sd`).
- yazi is `<leader>sy` (moved off `f` so the `f` menu could be retired).
- `maplocalleader` is backslash (`\`), so quarto/jupyter runner maps stay
  `\r…` and no longer leak into the `<leader>` menu.

## Final `<leader>` state

| Group | Contents |
|-------|----------|
| root | `<space>` Files, `b` buffers (+`x` delete), `/` grep, `:` cmd history, `.` scratch toggle, `e` explorer, `p` Yank History, `n` notifier history, `m` bookmarks, `o` opencode, `?` buffer-local maps |
| `c` | `cf cF cm cR cs cS cd` + **`cl` LSP Restart (new)** |
| `d` | debug (unchanged) |
| `f` | **empty and hidden** |
| `g` | `gg gs gS gd gf gl gL gb` (deleted `gG gY gD` and all GitHub maps) |
| `G` | **GitHub group** (icon): `Gi` issues open, `GI` issues all, `Gp` PRs open, `GP` PRs all, `GB` browse |
| `h` | **markdown headings group** (buffer-local; markdown-plus + markdown-toc) |
| `s` | pickers incl. `st sT` todo + **`sy` yazi**; surround moved to `gs*` (deleted `sG sW sc`) |
| `t` | **tests group `+test`** (python-scoped; neotest) |
| `u` | unchanged minus `uS` (dead scroll toggle) |
| `w` | **`w-` split below, `w\|` split right** (windows group) |
| `x` | `xx xX xq` (deleted `xl xL xQ xt xT`) |
| hidden | empty groups `f`, `q`, `<tab>` menu entries removed from which-key |
| gone | `K`, `L`, `N`, `S`, `z`, `Z`, `,`, `` ` ``, `-`, `\|`, `q*`, `b*` menu, `w*` forms, `f*`, `<tab>*`, `o1-9`, `E fe fE`, `e/E` duplicates |

## Execution log

1. **`lua/config/options.lua`** — set `vim.g.mapleader` / `maplocalleader` at the
   top. *Discovered:* LazyVim loads `options.lua` before plugins; without this any
   `<leader>`-map defined in files that load early registers under the literal
   string `"<leader>..."`. This was a latent bug — the old `keymaps.lua` silently
   dodged it by using `<space>B` and plain `mm`.
2. **`lua/config/keymaps.lua`** — rewritten:
   - `vim.defer_fn` purge of ~50 LazyVim/plugin maps, 2s after VeryLazy
     (pcall-guarded, idempotent — survives upstream changes).
   - `<leader>cl` → `:LspRestart`.
   - Bookmarks moved to real `<leader>mm/mo/mc/md/mt` maps; `wk.add` group docs
     wrapped in `vim.schedule` (which-key isn't loaded when this file runs).
   - neotest maps created **per-buffer via FileType python autocmd** (`tr tT tl
     ts ta td to tO tS tw`) — they no longer exist anywhere else.
3. **`lua/plugins/snacks.lua`** — `<leader>,` → `<leader>b`; added picker
   `buffers.win.input.keys` `x → buf_delete`; deleted `fb fB fc ff fg fP fr`
   specs (rest of the `f` menu was LazyVim-owned and gets purged); deleted
   `z Z S`; removed duplicate `sb` spec; removed `sc` (dupe of `<leader>:`).
4. **`lua/plugins/yazi.lua`** — `<leader>y` → `<leader>fy`; dropped `ycwd`.
5. **`lua/plugins/mini.lua`** — surround `add`/`delete` → `gsa`/`gsd`
   (`sdl`/`sdn` automatically became `gsdl`/`gsdn`).
6. **`lua/plugins/debug-and-test.lua`** — removed our four custom neotest keys
   (LazyVim test.extra provides them; now ft-scoped via keymaps.lua).
7. **opencode `o1`–`o9`** — removed via purge list (plugin registers them
   internally; `or*` cluster left untouched per decision).

## Round 2 fixes (post first restart)

1. **`<leader>K`** — was LazyVim's own `map("n", "<leader>K", "<cmd>norm! K<cr>")`
   (`lazyvim/config/keymaps.lua:81`); added to the purge list.
2. **`<leader>h` markdown group** — added a buffer-local which-key group
   ("headings", icon) in a `FileType markdown` autocmd. Covers markdown-plus
   (`h1-6`, `h+`, `h-`, `hT`) and markdown-toc (`ht`, `hT`, `hu`).
3. **`<leader>,`** — LazyVim's `Snacks.picker.buffers()` spec
   (`snacks_picker.lua:59`), duplicate of our `<leader>b`; purged. `<leader>b`
   keeps desc "Buffers" + icon (renders as a leaf, since a real keymap exists).
4. **`<leader>N`** — removed the `Snacks.win{ news.txt }` spec from `snacks.lua`.
5. **`<leader>L`** — LazyVim changelog (`lazyvim/config/keymaps.lua:185`); purged.
6. **`<leader>?`** — added icon (help-circle) to LazyVim's "Buffer Keymaps".
7. **yazi** — `<leader>fy` → `<leader>sy`; the now-empty `<leader>f` group is
   hidden.
8. **`<leader>w`** — maps were purged in round 1, but LazyVim's which-key
   *group* entry lingered; now hidden. Same for `q` and `<leader><tab>`.
9. **`<leader>r` / `<leader>R` in markdown** — not molten: round 1 set
   `maplocalleader = " "`, which made quarto's `<localleader>r*` runner maps
   (`rc ra rA rl r`, `RA`) register as space-prefixed maps. Reverted
   `maplocalleader` to `\`. Verified: no space-`r` maps; 4 backslash-`r` maps.
10. **`<leader>e` broke** — LazyVim defines `<leader>e` as a **remap to
    `<leader>fe`** (`snacks_explorer.lua:21`), and round 1 purged `fe`, leaving
    the remap dangling. Now `<leader>e` is mapped directly to
    `Snacks.explorer({ cwd = LazyVim.root() })`, and `explorer = { enabled = true }`
    so the module is set up properly. `fe`/`fE`/`E` remain purged.

### Lessons (for future purge edits)
- Never purge a key that another kept key is a **remap target** of
  (`<leader>e` → `<leader>fe`).
- Purging maps does **not** remove which-key **group** entries — hide those
  explicitly with `{ "<leader>x", hidden = true }`.
- `maplocalleader = " "` collides with `<leader>` for every plugin that uses
  `<localleader>`; keep it `\`.

## Round 3 fix — buffer delete in the picker

`x` did nothing in `<leader>b` because the config had the wrong **nesting** and
wrong **action name**:

- wrong: `picker.buffers.win.input.keys = { x = "buf_delete" }`
- right: `picker.sources.buffers.win.input.keys = { x = "bufdelete" }`

Snacks picker sources are configured under `picker.sources.<source>`, and the
action is `bufdelete` (no underscore; see
`snacks/picker/config/sources.lua`). Also note that providing `win.*.keys`
**replaces** the source's defaults, so the built-ins are re-declared explicitly:
input `<c-x>` and list `dd` alongside the new `x`.

Verified via `Snacks.picker.config.get().sources.buffers`:
input keys = `x`, `<c-x>`; list keys = `x`, `dd`; all → `bufdelete`.

## Round 4 — naming + windows/tests grouping

1. **Uniform picker naming** — dropped location suffixes:
   `<leader>e` "Explorer" (was "Explorer (root dir)"),
   `<leader><space>` "Smart Find Files" (was "…(cwd)"),
   `<leader>/` "Grep" (was "Grep (cwd)").
2. **Split windows moved into `<leader>w`** — purged LazyVim's `<leader>-` /
   `<leader>|`; added `<leader>w-` (split below) and `<leader>w|` (split right).
   The `w` group is un-hidden and labelled "windows" with an icon.
3. **`<leader>t` is now a proper tests group** — removed LazyVim's global empty
   `+test` marker (was a mapping with empty rhs) and registered a
   **python-scoped** group (`group = "test"`, icon) inside the same FileType
   autocmd that creates the neotest maps. Renders as `+test`, same as other
   groups, and only in python buffers.

Verified: `<space>-`, `<space>|`, global `<space>t` marker → absent;
`w-`/`w|` → "Split Window Below"/"Split Window Right";
descs → "Explorer", "Smart Find Files", "Grep";
python buffer → 10 buffer-local `<leader>t*` maps.

## Round 5 — naming, GitHub group

1. **`<leader>p`** desc renamed "Open Yank History" → "Yank History". LazyVim's
   yanky extra registers the desc, so it's re-mapped in `keymaps.lua` with the
   same behavior (`Snacks.picker.yanky()`) and the new desc.
2. **`<leader>G` GitHub group** (mdi-github icon `󰊤`) — moved the GitHub pickers
   out of `<leader>g` (they came from LazyVim's `snacks_picker` extra):
   `Gi` "Issues (open)", `GI` "Issues (all)", `Gp` "Pull Requests (open)",
   `GP` "Pull Requests (all)" (prefixes dropped since the group already says
   GitHub); plus `GB` "Browse" (moved from `<leader>gB`; still in `snacks.lua`).
   Purged the old `gi`/`gI`/`gp`/`gP`/`gB` (and LazyVim's `gB`).
   Note: the first attempt wrote an empty icon string — the glyph must be an
   actual codepoint in the file (`󰊤` = U+F02A4); verify with a hexdump if a
   group icon ever renders blank.
3. **`<leader><space>`** desc "Smart Find Files" → "Files".

Verified: `Gi/GI/Gp/GP/GB` present with correct descs; `gi/gI/gp/gP/gB` absent;
`<space>` desc "Files"; `<leader>p` desc "Yank History" (callback intact).

## Verified (headless map-table audit)

- Purged: `bb bd qq gG gY gD wd wm xl xL xQ xt xT sG sW sc uS E fe fE ff fb fn
  fc fp fr fP fg ft fT <tab>[ ] <tab> d f l o ta td to tO tr tS tw tt tT tl ts
  o1–o9 K L N ,` → all absent.
- Kept/added: `b e sy cl mm gd gB xx sg gsa <space>` → all present
  (`e` verified as a direct callback, not a remap).
- Round-2 regression checks: no space-`r`/`R` maps; 4 backslash-`r` maps
  (quarto runner); no startup errors from any of our lua files.
- `gsa`/`gsd` present; `tr` only in python buffers; which-key loads clean.

## Answers / notes captured during review

- **`<leader>sb`** (kept) — "Buffer Lines": live fuzzy search over every line of
  the current buffer with preview + jump. Genuinely useful; distinct from
  `sB` (grep across open buffers).
- **`<leader>S`** was "select an existing scratch buffer"; `<leader>.` toggles
  the scratch — S removed, `.` kept.

## Pending / follow-ups (not done)

1. **Interactive eyeball pass** — restart, `:WhichKey <leader>`, compare with the
   table; confirm `<leader>e` opens the explorer and that the `<leader>h` group
   only shows in markdown buffers. (`x`-delete in `<leader>b` is fixed — round 3.)
2. **opencode `o*` overhaul (suggested, not executed)** — the group has 30+ maps:
   - `o1`–`o9`: removed already; session tabs are reachable via `o?` picker.
   - Consider collapsing `oi`/`oI`/`oo` (three open-window variants) to one
     toggle + one new-session.
   - `otm/otr/ott` (toggle output variants) → a single `ot` toggle-with-picker.
   - `or*` (6 snapshot maps) → trim to `orr` (restore file) + `ora` (revert all).
   - `oz` duplicates `uZ`-style zoom semantics — candidate for removal.
   - Best done with the plugin author's keymap config table in `opencode.lua`
     rather than blind `keymap.del`, so upstream defaults stay discoverable.
3. `<leader>p` (yank history) is now the only solo-letter map — fine, but move
   to `u` group if strictness ever matters.
4. Consider ft-scoping `d` (dap) keys similarly to `t` if they ever annoy.

---

# Original audit (2024, pre-execution — kept for reference)

<details>
<summary>Original per-qualm analysis (click to expand)</summary>

### Principles

1. **Single letters are reserved for groups.** No more one-off `<leader>y`-style maps.
2. **One mechanism per task.** A job gets exactly one picker/map.
3. **Scenario-scoped keys where possible.**
4. **Removing the distro's maps** via `vim.keymap.del` collected in one block.
5. **When in doubt, delete.**

### 1. `<leader>K` — Keywordprg
Our own global `wk.add` (`keymaps.lua`); redundant with native `K`. → **Deleted.**

### 2. `<leader>S` — Select Scratch Buffer
Picker variant of `<leader>.`. → **Deleted.**

### 3. `<leader>,` — Buffer picker
Snacks `buf_delete` action existed on `<A-d>`. → **Moved to `<leader>b` + `x` alias.**

### 4. `` <leader>` `` — Switch to Other Buffer
Duplicate of `<leader>bb`; native `<C-^>` remains. → **Deleted.**

### 5. `<leader><space>` vs `B` vs `ff`/`fF`
Three finders, one job. → **Only `<leader><space>` kept** (per your call — stricter
than the original audit which kept `ff`).

### 6. `<leader>b` — buffer menu
Covered by the picker. → **Group deleted; `b` = picker.**

### 7. `<leader>f` — find menu
You have an explorer + smart picker. → **Entire menu deleted** (stricter than
audit's "slim to 7"); yazi joined as `fy`.

### 8. `<leader>g` — git menu
→ **Deleted `gG gY gD`**, rest kept (distinct actions).

### 9. `<leader>q` — sessions
Never used; persistence autoload unaffected. → **Group deleted.**

### 10. `<leader>r`
Maps never existed (was opencode `or*` cluster + LSP `cr` memory). → **Added
`<leader>cl` LSP Restart; `or*` untouched** per decision.

### 11. `<leader>s` — polluted search menu
mini.surround squatted on `sa`/`sd`. → **Surround → `gsa`/`gsd`; deleted `sG sW
sc`.** `sb` = current-buffer line search (kept — see notes above).

### 12. `<leader>t` — test keys everywhere
→ **Custom dupes deleted; LazyVim test keys ft-scoped to python.**

### 13. `<leader>z/Z` → deleted in favor of `uz/uZ`. Also killed third copy `wm`.

### 14. `<leader>w` → **entire menu deleted** (nav `<C-hjkl>`, resize `<C-Arrow>`).

### 15. `<leader>y` → **moved to `<leader>fy`**, `ycwd` dropped.

### 16. `<leader><tab>` → **group deleted** (native `gt`/`gT` remain).

### 17. `<leader>x` → **kept `xx xX xq`; deleted `xl xL xQ xt xT`.**

### Additional findings
- `e/E/fe/fE` explorer: **kept `e` only** (yazi is the file manager).
- `<leader>p` yank history: **kept**.
- `<leader>uS`: **deleted** (toggled the scroll module we disabled).
- `<leader>m` docs pointed at maps that didn't exist: **fixed — real `<leader>m*`
  maps now**, bare `mm/mo/mc/md/mt` freed.
- opencode `o1-9`: **removed**; full `o*` overhaul pending (see follow-ups).

</details>
