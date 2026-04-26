vim.api.nvim_create_autocmd("FileType", {
  pattern = "tex",
  callback = function()
    -- desired line length
    vim.opt_local.textwidth = 80

    -- enable auto-wrapping with vimtex's formatter
    -- 't' enables auto-wrap, 'c' wraps comments, 'q' allows gq formatting
    vim.opt_local.formatoptions = { c = true, q = true, r = true, o = true }

    -- enable vimtex's formatexpr
    vim.g.vimtex_format_enabled = 1
  end,
})

-- create which-key group
local wk = require("which-key")

wk.add({
  { "<localleader>l", group = "VimTeX", icon = "", buffer = vim.api.nvim_get_current_buf() },

  { "<localleader>ll", desc = "Compile document", icon = "󰙯", buffer = vim.api.nvim_get_current_buf() },
  { "<localleader>lv", desc = "View PDF", icon = "", buffer = vim.api.nvim_get_current_buf() },
  { "<localleader>lc", desc = "Clean aux files", icon = "󰃢", buffer = vim.api.nvim_get_current_buf() },
  { "<localleader>le", desc = "Error viewer", icon = "󰅚", buffer = vim.api.nvim_get_current_buf() },
  { "<localleader>lq", desc = "Quickfix", icon = "󰨳", buffer = vim.api.nvim_get_current_buf() },
  { "<localleader>lt", desc = "Toggle TOC", icon = "", buffer = vim.api.nvim_get_current_buf() },
  { "<localleader>ls", desc = "Toggle spell check", icon = "󰓼", buffer = vim.api.nvim_get_current_buf() },
  { "<localleader>la", desc = "Context menu", icon = "󰌌", buffer = true },
  { "<localleader>lg", desc = "Status", icon = "󰊹", buffer = true },
  { "<localleader>lk", desc = "Stop compilation", icon = "󰓛", buffer = true },
  { "<localleader>lm", desc = "List imaps", icon = "󰣇", buffer = true },
  { "<localleader>lS", desc = "Stop compilation (ss)", icon = "󰚎", buffer = true },
  { "<localleader>lx", desc = "Reload", icon = "󰜟", buffer = true },
  { "<localleader>lG", desc = "Status all", icon = "󱩌", buffer = true },
  { "<localleader>lK", desc = "Stop all", icon = "󰈂", buffer = true },
  { "<localleader>lo", desc = "Compile output", icon = "󰐥", buffer = true },
  { "<localleader>lX", desc = "Reload state", icon = "󰦉", buffer = true },
  { "<localleader>lC", desc = "Clean all", icon = "󰃢", buffer = true },
  { "<localleader>li", desc = "Info", icon = "󰋼", buffer = true },
  { "<localleader>lI", desc = "Info full", icon = "󱩎", buffer = true },
  { "<localleader>lL", desc = "Compile selected", icon = "󰸠", buffer = true },
  { "<localleader>lT", desc = "Toggle TOC", icon = "", buffer = true },
})
