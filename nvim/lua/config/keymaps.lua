-- Keymaps for Neovim

local keymap = vim.keymap

-- Spawn terminal using leader + t
keymap.set("n", "<leader>t", function()
  if vim.fn.bufexists("term://*") == 1 then
    vim.cmd("bdelete! term://*")
  else
    vim.cmd("split | terminal")
  end
end, { desc = "Toggle terminal" })
