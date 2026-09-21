-- Keymaps for Neovim

--------------------------------------------------------------------------------------------------------------------
-- Disable Keymaps
--------------------------------------------------------------------------------------------------------------------

-- set by Lazy
vim.keymap.del("n", "<leader>L") -- LazyVim changelog
vim.keymap.del("n", "<leader>N") -- NeoVim news

--------------------------------------------------------------------------------------------------------------------
-- Set Keymaps
--------------------------------------------------------------------------------------------------------------------

-- file browser
vim.keymap.set("n", "<space>B", function()
  Snacks.picker.files({ cwd = vim.fn.getcwd() })
end, { desc = "File Fuzzy-Finder (cwd)" })

-- bookmarks.nvim keymaps
vim.keymap.set({ "n", "v" }, "mm", "<cmd>BookmarksMark<cr>", { noremap = true })
vim.keymap.set({ "n", "v" }, "mo", "<cmd>BookmarksGoto<cr>", { noremap = true })
vim.keymap.set({ "n", "v" }, "mc", "<cmd>BookmarksCommands<cr>", { noremap = true })
vim.keymap.set({ "n", "v" }, "md", "<cmd>BookmarksDesc<cr>", { noremap = true })
vim.keymap.set({ "n", "v" }, "mt", "<cmd>BookmarksTree<cr>", { noremap = true })

wk.add({
  { "<leader>m", group = "bookmarks", icon = "󰂺" },

  { "<leader>mm", desc = "Bookmark Line", icon = "" },
  { "<leader>mo", desc = "Open Bookmark", icon = "" },
  { "<leader>mc", desc = "Bookmark Commands", icon = "" },
  { "<leader>md", desc = "Add Bookmark Description", icon = "󱇗" },
  { "<leader>mt", desc = "Open Bookmarks Tree", icon = "󱘎" },
})

-- sudo-tee/opencode.nvim keymaps - using default keymaps with group for custom icon
wk.add({
  { "<leader>o", group = "opencode", icon = { icon = "󱙺", color = "green" } },
})

-- keywordprg
vim.keymap.del("n", "<leader>K") -- Remove LazyVim's default

wk.add({
  {
    "<leader>K",
    function()
      vim.cmd("norm! K")
    end,
    desc = "Keywordprg",
    icon = { icon = "", color = "green" },
    mode = "n",
  },
})
