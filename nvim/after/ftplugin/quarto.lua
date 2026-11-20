-- The runtime `ftplugin/quarto.vim` sources `ftplugin/rmd.vim`, which sets
-- `formatexpr=FormatRmd()` (that function always falls back to the internal
-- formatter, so it cannot protect code cells). Our ftplugin runs before the
-- runtime one, so the override has to live in `after/` — the last entry in
-- 'runtimepath'.
--
-- See lua/config/notebook-format.lua: prose is formatted (wrapped at
-- 'textwidth'), code cells and the jupytext frontmatter are left untouched.
vim.bo.formatexpr = "v:lua.require'config.notebook-format'.formatexpr()"
