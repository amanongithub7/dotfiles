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
  end,
  -- config = function()
  --   vim.cmd("syntax enable")
  --   vim.cmd("let g:vimtex_view_general_viewer='sioyek'")
  --   -- %1: file, %2: line number
  --   local options = string.format(
  --     '--reuse-window --inverse-search="nvr --servername %s +%%2 %%1" --forward-search-file @tex --forward-search-line @line @pdf',
  --     vim.v.servername
  --   )
  --
  --   local command = string.format("let g:vimtex_view_general_options='%s'", options)
  --   vim.cmd(command)
  --   vim.cmd("let g:vimtex_compiler_progname='nvr'")
  -- end,
}
