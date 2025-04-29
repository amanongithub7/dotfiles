-- bootstrap lazy.nvim, LazyVim and your plugins
require("config.keymaps")
require("config.lazy")

vim.cmd.colorscheme("catppuccin-latte")

-- bind grep to ripgrep
vim.cmd([[set grepprg=rg\ --vimgrep\ --smart-case\ --hidden]])

-- personal configuration settings
vim.opt.number = true
vim.opt.relativenumber = false
