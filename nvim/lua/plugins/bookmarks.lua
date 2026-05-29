return {
  "LintaoAmons/bookmarks.nvim",
  -- pin the plugin at specific version for stability
  -- backup your bookmark sqlite db when there are breaking changes (major version change)
  tag = "v4.0.0",
  dependencies = {
    { "kkharji/sqlite.lua" },
    -- picker backend (choose one):
    { "folke/snacks.nvim" }, -- default picker backend
    -- {"nvim-telescope/telescope.nvim"}, -- set picker.picker_backend = "telescope" to use
  },
  config = function()
    local opts = { -- check the "./lua/bookmarks/default-config.lua" file for all the options

      treeview = {
        -- Dimension of the window spawned for Treeview
        window_split_dimension = 40,
      },
    }
    require("bookmarks").setup(opts) -- you must call setup to init sqlite db
  end,
}

-- run :BookmarksInfo to see the running status of the plugin
