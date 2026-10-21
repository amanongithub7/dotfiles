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
  { "<localleader>", group = "VimTeX", icon = "", buffer = vim.api.nvim_get_current_buf() },

  { "<localleader>l", desc = "Compile document", icon = "󰙯", buffer = vim.api.nvim_get_current_buf() },
  { "<localleader>v", desc = "View PDF", icon = "", buffer = vim.api.nvim_get_current_buf() },
  { "<localleader>c", desc = "Clean aux files", icon = "󰃢", buffer = vim.api.nvim_get_current_buf() },
  { "<localleader>e", desc = "Error viewer", icon = "󰅚", buffer = vim.api.nvim_get_current_buf() },
  { "<localleader>q", desc = "Quickfix", icon = "󰨳", buffer = vim.api.nvim_get_current_buf() },
  { "<localleader>t", desc = "Toggle TOC", icon = "", buffer = vim.api.nvim_get_current_buf() },
  { "<localleader>s", desc = "Toggle spell check", icon = "󰓼", buffer = vim.api.nvim_get_current_buf() },
  { "<localleader>a", desc = "Context menu", icon = "󰌌", buffer = true },
  { "<localleader>g", desc = "Status", icon = "󰊹", buffer = true },
  { "<localleader>k", desc = "Stop compilation", icon = "󰓛", buffer = true },
  { "<localleader>m", desc = "List imaps", icon = "󰣇", buffer = true },
  { "<localleader>S", desc = "Stop compilation (ss)", icon = "󰚎", buffer = true },
  { "<localleader>x", desc = "Reload", icon = "󰜟", buffer = true },
  { "<localleader>G", desc = "Status all", icon = "󱩌", buffer = true },
  { "<localleader>K", desc = "Stop all", icon = "󰈂", buffer = true },
  { "<localleader>o", desc = "Compile output", icon = "󰐥", buffer = true },
  { "<localleader>X", desc = "Reload state", icon = "󰦉", buffer = true },
  { "<localleader>C", desc = "Clean all", icon = "󰃢", buffer = true },
  { "<localleader>i", desc = "Info", icon = "󰋼", buffer = true },
  { "<localleader>I", desc = "Info full", icon = "󱩎", buffer = true },
  { "<localleader>L", desc = "Compile selected", icon = "󰸠", buffer = true },
  { "<localleader>T", desc = "Toggle TOC", icon = "", buffer = true },
})
