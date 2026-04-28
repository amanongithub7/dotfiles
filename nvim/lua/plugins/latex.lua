return {
  "lervag/vimtex",
  lazy = false, -- we don't want to lazy load VimTeX
  -- tag = "v2.15", -- uncomment to pin to a specific release
  init = function()
    -- VimTeX configuration
    vim.g.vimtex_format_enabled = 1
    vim.cmd("syntax enable")

    -- skim as pdf viewer
    -- vim.g.vimtex_view_method = "skim"
    -- vim.g.vimtex_view_skim_sync = 1
    -- vim.g.vimtex_view_skim_activate = 1

    -- sioyek as pdf viewer
    vim.g.vimtex_view_method = "sioyek"
    vim.g.vimtex_callback_progpath = "/opt/homebrew/bin/nvim"
    vim.g.vimtex_quickfix_open_on_warning = 0 -- don't open quickfix window when there are only warnings
  end,
}
