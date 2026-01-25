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
