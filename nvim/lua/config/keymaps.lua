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

-- molten.nvim - plugins/ipynb.lua
vim.keymap.set("n", "<leader>mr", ":MoltenEvaluateLine<CR>")
vim.keymap.set("n", "<leader>mc", ":MoltenEvaluateCell<CR>")
vim.keymap.set("n", "<localleader>e", ":MoltenEvaluateOperator<CR>", { desc = "evaluate operator", silent = true })
vim.keymap.set(
  "n",
  "<localleader>os",
  ":noautocmd MoltenEnterOutput<CR>",
  { desc = "open output window", silent = true }
)
vim.keymap.set("n", "<localleader>rc", ":MoltenReevaluateCell<CR>", { desc = "re-eval cell", silent = true })
vim.keymap.set(
  "v",
  "<localleader>r",
  ":<C-u>MoltenEvaluateVisual<CR>gv",
  { desc = "execute visual selection", silent = true }
)
vim.keymap.set("n", "<localleader>oh", ":MoltenHideOutput<CR>", { desc = "close output window", silent = true })
vim.keymap.set("n", "<localleader>md", ":MoltenDelete<CR>", { desc = "delete Molten cell", silent = true })
