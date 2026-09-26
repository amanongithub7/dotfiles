-- Options are automatically loaded before lazy.nvim startup
-- Default options that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/options.lua
-- Add any additional options here

-- leader keys: must be set before lazy.nvim loads plugins so every
-- "<leader>..." keymap registers under the expanded lhs
vim.g.mapleader = " "
-- keep localleader as backslash: setting it to <space> made plugin
-- localleader maps (e.g. quarto runner) collide with <leader>
vim.g.maplocalleader = "\\"

-- bind grep to ripgrep
vim.cmd([[set grepprg=rg\ --vimgrep\ --smart-case\ --hidden]])

-- relative and absolute line numbers
vim.opt.number = true
vim.opt.relativenumber = true

-- use the virtualenv saved as "neovim" for python3
vim.g.python3_host_prog = vim.fn.expand("~/.virtualenvs/neovim/bin/python3")
