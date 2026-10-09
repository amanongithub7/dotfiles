-- <CR> link following for markdown buffers.
--
-- In obsidian workspaces (vim.b.obsidian_buffer) this defers to obsidian's
-- smart_action; elsewhere it follows the link under the cursor:
--   [text](https://...)  open externally (vim.ui.open)
--   [text](scheme:...)   open externally (mailto:, zotero:, file://, ...)
--   [text](file.md)      :edit the file (resolved against the buffer's directory)
--   [text](file.md#sec)  :edit, then jump to the heading (GitHub-style slug)
--   [text](#sec)         jump to the heading in the current buffer
-- Bare and angle-bracketed URLs (<https://...>) open externally too. Links
-- inside fenced code blocks, inline code spans and frontmatter are ignored.

local M = {}

local IMAGE_AND_DOC_EXTS = { "png", "jpg", "jpeg", "gif", "webp", "svg", "pdf", "mp4", "mov" }

-- treesitter node types (outer markdown grammar + markdown_inline injection)
-- whose contents must never be followed
local EXCLUDED_NODES = {
  fenced_code_block = true,
  code_span = true,
  minus_metadata = true,
  plus_metadata = true,
}

local function notify(msg, level)
  vim.notify(msg, level or vim.log.levels.INFO, { title = "markdown-links" })
end

---GitHub-style heading slug: lowercase, punctuation dropped, spaces -> hyphens.
local function slugify(text)
  local slug = text:lower():gsub("[^%w%s%-]", "")
  return (slug:gsub("%s", "-"))
end

---1-based line number of the ATX heading whose slug matches `anchor`.
local function find_heading(anchor)
  local target = slugify(anchor)
  local in_fence = false
  for lnum, line in ipairs(vim.api.nvim_buf_get_lines(0, 0, -1, false)) do
    if line:match("^%s*```+") or line:match("^%s*~~~+") then
      in_fence = not in_fence
    elseif not in_fence then
      local heading = line:match("^#+%s+(.-)%s*#*$")
      if heading and slugify(heading) == target then
        return lnum
      end
    end
  end
end

local function jump_to_anchor(anchor)
  local lnum = find_heading(anchor)
  if not lnum then
    notify(("anchor '#%s' not found"):format(anchor), vim.log.levels.WARN)
    return
  end
  vim.api.nvim_win_set_cursor(0, { lnum, 0 })
  vim.cmd("normal! zvzz")
end

---Destination of the inline link/image whose `[...](...)` span covers
---1-based byte column `col`, with `<>` wrappers, %20 and whitespace stripped.
local function link_dest_at(line, col)
  local pos = 1
  while pos <= #line do
    local s, e, _, paren = line:find("!?(%b[])(%b())", pos)
    if not s then
      return nil
    end
    if col >= s and col <= e then
      local dest = paren:sub(2, -2)
      if dest:sub(1, 1) == "<" and dest:sub(-1) == ">" then
        dest = dest:sub(2, -2)
      end
      dest = dest:gsub("%%20", " "):gsub("^%s+", ""):gsub("%s+$", "")
      if dest ~= "" then
        return dest
      end
    end
    pos = e + 1
  end
end

---Plain or angle-bracketed URL covering 1-based byte column `col`
---(trailing punctuation trimmed so sentences don't break the URL).
local function bare_url_at(line, col)
  local pos = 1
  while true do
    local s, e = line:find("https?://%S+", pos)
    if not s then
      return nil
    end
    local url = line:sub(s, e):gsub("[.,;:!?%)%]>'\"…]+$", "")
    if col >= s and col <= s + #url - 1 then
      return url
    end
    pos = e + 1
  end
end

---True inside fenced code blocks, inline code spans or frontmatter. Checks
---both the outer markdown tree (fences, frontmatter) and the markdown_inline
---injection tree (code spans), since neither tree sees the other's nodes.
local function in_excluded_context()
  for _, ignore_injections in ipairs({ true, false }) do
    local ok, node = pcall(vim.treesitter.get_node, { ignore_injections = ignore_injections })
    if ok then
      while node do
        if EXCLUDED_NODES[node:type()] then
          return true
        end
        node = node:parent()
      end
    end
  end
  return false
end

local function follow_dest(dest)
  local path, anchor = dest:match("^([^#]*)#(.+)$")
  if not path then
    path, anchor = dest, nil
  end

  if path == "" then
    if anchor then
      jump_to_anchor(anchor)
    end
    return
  end

  local target = vim.fn.expand(path)
  if not target:match("^/") then
    local base = vim.fs.dirname(vim.api.nvim_buf_get_name(0))
    if base == "" then
      base = vim.uv.cwd()
    end
    target = vim.fs.joinpath(base, target)
  end

  if vim.fn.filereadable(target) == 0 then
    notify(("file not found: %s"):format(path), vim.log.levels.WARN)
    return
  end

  local ext = target:match("%.(%w+)$")
  if ext and vim.tbl_contains(IMAGE_AND_DOC_EXTS, ext:lower()) then
    vim.ui.open(target)
    return
  end

  vim.cmd.edit(vim.fn.fnameescape(target))
  if anchor then
    jump_to_anchor(anchor)
  end
end

---Actual link following; runs as an Ex command so buffer-changing side
---effects happen outside expression-mapping evaluation.
function M._follow()
  local line = vim.api.nvim_get_current_line()
  local col = vim.api.nvim_win_get_cursor(0)[2] + 1

  local dest = link_dest_at(line, col) or bare_url_at(line, col)
  if not dest or in_excluded_context() then
    return
  end

  if dest:match("^%w[%w+.-]*:") then
    vim.ui.open(dest)
    return
  end
  follow_dest(dest)
end

---<CR> handler (expr mapping): in obsidian vault buffers delegates to
---obsidian's smart_action, else follows the link under the cursor.
function M.follow()
  if vim.b.obsidian_buffer then
    local ok, actions = pcall(require, "obsidian.actions")
    if ok then
      return actions.smart_action()
    end
  end
  return "<cmd>lua require('config.markdown-links')._follow()<cr>"
end

---Buffer-local <CR> mapping for markdown-like filetypes (called from ftplugin).
function M.map()
  vim.keymap.set("n", "<CR>", function()
    return M.follow()
  end, { expr = true, buffer = true, desc = "Follow markdown link under cursor" })
end

return M
