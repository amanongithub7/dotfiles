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

-- Width of the snacks zen-mode viewport as a fraction of terminal columns.
-- Single source of truth: snacks zen sizes its floating window with this and
-- markdown buffers derive their textwidth from it (see ftplugin/markdown.lua)
-- so a full line wraps exactly at the zen viewport edge.
vim.g.zen_width = 0.55

-- Neovim's markdown ftplugin sets list-friendly indent (expandtab, ts/sts/sw=4)
-- when this is 1. LazyVim sets it to 0, leaving shiftwidth=2; markdown-plus' <Tab>
-- then nests list items by 2 spaces, which is too shallow for a child of "1. "
-- (needs >=3) in CommonMark, so Prettier hoists/un-nests the list on save.
vim.g.markdown_recommended_style = 1
