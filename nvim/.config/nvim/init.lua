-- bootstrap lazy.nvim, LazyVim and your plugins
require("config.lazy")
require("config.keymaps")
require("config.options")

-- Set colorscheme
vim.cmd.colorscheme("catppuccin-latte")

-- bind grep to ripgrep
vim.cmd([[set grepprg=rg\ --vimgrep\ --smart-case\ --hidden]])

-- non-relative line numbers
vim.opt.number = true
vim.opt.relativenumber = false
