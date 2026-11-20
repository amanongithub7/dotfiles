-- Opens nvim/guides/notebook-guide.md in a floating window, the same shape as
-- the LaTeX guide (see lua/plugins/latex.lua). Bound to <localleader>h in
-- notebook buffers (ftplugin/quarto.lua) and to :NotebookGuide everywhere.
local M = {}

M.path = vim.fn.stdpath("config") .. "/guides/notebook-guide.md"

function M.open()
  if vim.fn.filereadable(M.path) ~= 1 then
    vim.notify("Notebook guide not found: " .. M.path, vim.log.levels.WARN)
    return
  end

  local buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, vim.fn.readfile(M.path))
  vim.bo[buf].filetype = "markdown"

  local width = math.min(110, math.floor(vim.o.columns * 0.85))
  local height = math.floor(vim.o.lines * 0.85)
  local win = vim.api.nvim_open_win(buf, true, {
    relative = "editor",
    width = width,
    height = height,
    row = math.floor((vim.o.lines - height) / 2),
    col = math.floor((vim.o.columns - width) / 2),
    style = "minimal",
    border = "rounded",
    title = " Notebook Guide ",
    title_pos = "center",
  })

  vim.wo[win].wrap = true
  vim.wo[win].number = false
  vim.wo[win].relativenumber = false
  vim.wo[win].signcolumn = "no"

  local function close()
    if vim.api.nvim_win_is_valid(win) then
      vim.api.nvim_win_close(win, true)
    end
  end
  -- q and <Esc> to close, and <localleader>h again to toggle
  for _, key in ipairs({ "q", "<Esc>", "<localleader>h" }) do
    vim.keymap.set("n", key, close, { buffer = buf, nowait = true, desc = "Close notebook guide" })
  end
end

return M
