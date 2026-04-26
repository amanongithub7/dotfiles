-- these keymaps only load when filetype is 'jupyter'
vim.keymap.set("n", "<leader>mr", ":MoltenEvaluateLine<CR>", { buffer = true })
vim.keymap.set("n", "<leader>mc", ":MoltenEvaluateCell<CR>", { buffer = true })
vim.keymap.set("n", "<localleader>e", ":MoltenEvaluateOperator<CR>", {
  buffer = true,
  desc = "evaluate operator",
  silent = true,
})
vim.keymap.set("n", "<localleader>os", ":noautocmd MoltenEnterOutput<CR>", {
  buffer = true,
  desc = "open output window",
  silent = true,
})
vim.keymap.set("n", "<localleader>rc", ":MoltenReevaluateCell<CR>", {
  buffer = true,
  desc = "re-eval cell",
  silent = true,
})
vim.keymap.set("v", "<localleader>r", ":<C-u>MoltenEvaluateVisual<CR>gv", {
  buffer = true,
  desc = "execute visual selection",
  silent = true,
})
vim.keymap.set("n", "<localleader>oh", ":MoltenHideOutput<CR>", {
  buffer = true,
  desc = "close output window",
  silent = true,
})
vim.keymap.set("n", "<localleader>md", ":MoltenDelete<CR>", {
  buffer = true,
  desc = "delete Molten cell",
  silent = true,
})

-- create which-key group
local wk = require("which-key")
wk.add({
  -- This creates the group heading
  { "<leader>m", group = "Molten", icon = "󱁯", buffer = vim.api.nvim_get_current_buf() },
  -- These specific mappings are part of that group
  { "<leader>mr", desc = "Evaluate line", group = "Molten", buffer = vim.api.nvim_get_current_buf() },
  { "<leader>mc", desc = "Evaluate cell", group = "Molten", buffer = vim.api.nvim_get_current_buf() },
})
