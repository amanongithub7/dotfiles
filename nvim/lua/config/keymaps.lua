-- Keymaps for Neovim

-- Disable Keymaps
-- set by Lazy
vim.keymap.del("n", "<leader>L") -- LazyVim changelog
vim.keymap.del("n", "<leader>N") -- NeoVim news
vim.keymap.del("n", "<leader>E") -- duplicate snacks explorer

-- Set Keymaps
-- file browser
vim.keymap.set("n", "<space>B", function()
  require("telescope").extensions.file_browser.file_browser()
end, { desc = "File Fuzzy-Finder (cwd)" })

-- codecompanion keymaps
vim.keymap.set({ "n", "v" }, "<leader>cca", "<cmd>CodeCompanionActions<cr>", { noremap = true, silent = true })
vim.keymap.set({ "n", "v" }, "<leader>cct", "<cmd>CodeCompanionChat Toggle<cr>", { noremap = true, silent = true })

local wk = require("which-key")
wk.add({
  { "<leader>cc", group = "CodeCompanion", icon = "🤖" },

  { "<leader>cct", desc = "Toggle Chat", icon = "󰭻" },
  { "<leader>cca", desc = "Actions", icon = "" },
})
