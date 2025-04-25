-- bootstrap lazy.nvim, LazyVim and your plugins
require("config.lazy")

-- bind grep to ripgrep
vim.cmd([[set grepprg=rg\ --vimgrep\ --smart-case\ --hidden]])

-- keymaps
vim.keymap.set("n", "<leader>t", function()
  if vim.fn.bufexists("term://*") == 1 then
    vim.cmd("bdelete! term://*")
  else
    vim.cmd("split | terminal")
  end
end, { desc = "Toggle terminal" })

-- personal configuration settings
vim.opt.number = true
