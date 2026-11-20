-- 'formatexpr' for notebook buffers: hard-wrap markdown prose at 'textwidth'
-- while leaving code cells and the jupytext YAML frontmatter alone.
--
-- Notebook buffers mix prose and code, so 'formatoptions' with 't' plus a
-- 'textwidth' would otherwise split long Python lines mid-cell. Nvim calls this
-- expression both for gq and for automatic formatting (see :h 'formatexpr').
-- The return value is easy to get backwards: non-zero means "fall back to the
-- internal formatter", zero means "leave the range alone". So prose gets 1
-- (Neovim wraps it with 'textwidth') and frontmatter/fences get 0.
--
-- Installed from after/ftplugin/quarto.lua: the runtime ftplugin/quarto.vim
-- sources ftplugin/rmd.vim, which sets formatexpr=FormatRmd() and would win if
-- this were set from ftplugin/quarto.lua.
local M = {}

---@param line string
---@return boolean
local function is_delimiter(line)
  return line:match("^%s*```") ~= nil or line:match("^%s*~~~") ~= nil
end

---Which region a row belongs to.
---@param row integer 1-based row
---@param lines string[] buffer lines 1..last
---@return "frontmatter"|"fence"|"prose"
local function region(row, lines)
  -- jupytext YAML frontmatter: starts on line 1, ends at the next bare ---.
  if lines[1] and lines[1]:match("^%-%-%-%s*$") then
    if row == 1 then
      return "frontmatter"
    end
    local closed_at
    for i = 2, #lines do
      if lines[i]:match("^%-%-%-%s*$") then
        closed_at = i
        break
      end
    end
    -- no closing marker within the fetched lines means it is still open
    if closed_at == nil or row <= closed_at then
      return "frontmatter"
    end
  end

  -- fence state *before* this row, plus the row itself when it is a delimiter
  local in_fence = false
  for i = 1, row - 1 do
    if lines[i] and is_delimiter(lines[i]) then
      in_fence = not in_fence
    end
  end
  if in_fence or (lines[row] and is_delimiter(lines[row])) then
    return "fence"
  end
  return "prose"
end

---@return integer 1 to let Neovim wrap the range with 'textwidth', 0 to skip
function M.formatexpr()
  local first = vim.v.lnum
  local last = math.min(first + math.max(vim.v.count, 1) - 1, vim.api.nvim_buf_line_count(0))
  if first < 1 or first > last then
    return 0
  end

  local lines = vim.api.nvim_buf_get_lines(0, 0, last, false)
  for row = first, last do
    if region(row, lines) ~= "prose" then
      return 0
    end
  end
  return 1
end

return M
