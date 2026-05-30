-- Keymaps for Neovim

--------------------------------------------------------------------------------------------------------------------
-- Disable Keymaps
--------------------------------------------------------------------------------------------------------------------

-- set by Lazy
vim.keymap.del("n", "<leader>L") -- LazyVim changelog
vim.keymap.del("n", "<leader>N") -- NeoVim news
vim.keymap.del("n", "<leader>E") -- duplicate snacks explorer
vim.keymap.del("n", "<leader>e") -- snacks explorer - this config uses neo-tree

--------------------------------------------------------------------------------------------------------------------
-- Set Keymaps
--------------------------------------------------------------------------------------------------------------------

-- file browser
vim.keymap.set("n", "<space>B", function()
  require("telescope").extensions.file_browser.file_browser()
end, { desc = "File Fuzzy-Finder (cwd)" })

-- neo-tree
vim.keymap.set("n", "<leader>e", ":Neotree toggle reveal<CR>", { desc = "Toggle Neo-tree" })

-- codecompanion.nvim keymaps
vim.keymap.set({ "n", "v" }, "<leader>cca", "<cmd>CodeCompanionActions<cr>", { noremap = true, silent = true })
vim.keymap.set({ "n", "v" }, "<leader>cct", "<cmd>CodeCompanionChat Toggle<cr>", { noremap = true, silent = true })

local wk = require("which-key")
wk.add({
  { "<leader>cc", group = "CodeCompanion", icon = "🤖" },

  { "<leader>cct", desc = "Toggle Chat", icon = "󰭻" },
  { "<leader>cca", desc = "Actions", icon = "" },
})

-- bookmarks.nvim keymaps
vim.keymap.set({ "n", "v" }, "mm", "<cmd>BookmarksMark<cr>", { noremap = true })
vim.keymap.set({ "n", "v" }, "mo", "<cmd>BookmarksGoto<cr>", { noremap = true })
vim.keymap.set({ "n", "v" }, "mc", "<cmd>BookmarksCommands<cr>", { noremap = true })
vim.keymap.set({ "n", "v" }, "md", "<cmd>BookmarksDesc<cr>", { noremap = true })
vim.keymap.set({ "n", "v" }, "mt", "<cmd>BookmarksTree<cr>", { noremap = true })

wk.add({
  { "<leader>m", group = "Bookmarks", icon = "󰂺" },

  { "<leader>mm", desc = "Bookmark Line", icon = "" },
  { "<leader>mo", desc = "Open Bookmark", icon = "" },
  { "<leader>mc", desc = "Bookmark Commands", icon = "" },
  { "<leader>md", desc = "Add Bookmark Description", icon = "󱇗" },
  { "<leader>mt", desc = "Open Bookmarks Tree", icon = "󱘎" },
})
