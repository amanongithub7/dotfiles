-- bind grep to ripgrep
vim.cmd([[set grepprg=rg\ --vimgrep\ --smart-case\ --hidden]])

-- relative and absolute line numbers
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.statuscolumn = "%s %l %r"
