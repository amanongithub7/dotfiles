-- Autocmds are automatically loaded on the VeryLazy event
-- Default autocmds that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/autocmds.lua
--
-- Add any additional autocmds here
-- with `vim.api.nvim_create_autocmd`
--
-- Or remove existing autocmds by their group name (which is prefixed with `lazyvim_` for the defaults)
-- e.g. vim.api.nvim_del_augroup_by_name("lazyvim_wrap_spell")

-- Reduce conceal level for markdown files (stops backticks in code blocks from hiding, which would lead to buffer infinite bounce glitch on scroll)
-- Conceal Level of 1 allows enough rendering UI features for markdown files without jeopardizing scollability
vim.api.nvim_create_autocmd("FileType", {
  pattern = "markdown",
  callback = function()
    vim.wo.conceallevel = 1
  end,
})

-- Soft-wrap prose buffers, notebooks included. LazyVim's own `wrap_spell` list
-- covers markdown but not quarto, so notebooks (jupytext gives them ft=quarto)
-- were the only prose buffers that did not wrap. Display-only: no textwidth or
-- formatoptions changes, because a shared hard-wrap width would also break long
-- Python lines inside code cells.
--
-- 'wrap' is window-local, so setting it here once would leak onto whatever
-- buffer the window shows next (e.g. a .py file after a notebook); this
-- reapplies on every BufWinEnter and clears it for non-prose buffers.
local prose_fts = {
  markdown = true,
  quarto = true,
  text = true,
  plaintex = true,
  typst = true,
  gitcommit = true,
}

-- Global values at load time, before any buffer has borrowed this window.
local default_linebreak = vim.o.linebreak
local default_breakindent = vim.o.breakindent

local function apply_prose_wrap(bufnr)
  local on = prose_fts[vim.bo[bufnr].filetype] or false
  vim.wo.wrap = on
  vim.wo.linebreak = on or default_linebreak
  vim.wo.breakindent = on or default_breakindent
end

vim.api.nvim_create_autocmd("BufWinEnter", {
  group = vim.api.nvim_create_augroup("prose-wrap", { clear = true }),
  callback = function(ev)
    apply_prose_wrap(ev.buf)
  end,
})

-- BufWinEnter already fired for the buffer this config file loads after.
apply_prose_wrap(vim.api.nvim_get_current_buf())

-- molten.nvim preserve notebook cell outputs
--
-- automatically import output chunks from a jupyter notebook
-- tries to find a kernel that matches the kernel in the jupyter notebook
-- falls back to a kernel that matches the name of the active venv (if any)
local imb = function(e) -- init molten buffer
  vim.schedule(function()
    -- molten requires a real JSON notebook; a corrupt file (e.g. jupytext
    -- markdown written into an .ipynb) would raise a python traceback
    local f = io.open(e.file, "r")
    local head = f and f:read(512) or ""
    if f then
      f:close()
    end
    if not head:match("^%s*{") then
      vim.notify(
        ("molten: skipped %s — not a valid ipynb (corrupt file or jupytext markdown twin?)"):format(
          vim.fs.basename(e.file or "")
        ),
        vim.log.levels.WARN
      )
      return
    end
    local kernels = vim.fn.MoltenAvailableKernels()
    -- kernel priority: explicit per-notebook binding (lua/molten-kernel.lua,
    -- set with <localleader>mk) > notebook kernelspec > active venv/conda
    local kernel_name = require("molten-kernel").candidate(e.file, kernels)
    if kernel_name ~= nil then
      vim.cmd(("MoltenInit %s"):format(kernel_name))
    end
    -- molten draws plots through image.nvim, which is ft-lazy: the BufAdd/
    -- BufEnter import can beat the FileType event, so load it before importing
    pcall(require("lazy").load, { plugins = { "image.nvim" } })
    vim.cmd("MoltenImportOutput")
  end)
end

-- automatically import output chunks from a jupyter notebook
vim.api.nvim_create_autocmd("BufAdd", {
  pattern = { "*.ipynb" },
  callback = imb,
})

-- we have to do this as well so that we catch files opened like nvim ./hi.ipynb
vim.api.nvim_create_autocmd("BufEnter", {
  pattern = { "*.ipynb" },
  callback = function(e)
    if vim.api.nvim_get_vvar("vim_did_enter") ~= 1 then
      imb(e)
    end
  end,
})

-- Safety net: never let a non-JSON buffer be written to an .ipynb path.
-- Catches raw writes from hookless buffers (e.g. jupytext.nvim's startup
-- race: file read before its BufReadCmd hook exists, so :w would dump the
-- markdown content straight into the notebook). jupytext.nvim's own save
-- flow is unaffected: it writes the markdown twin via a *.md BufWritePre
-- and regenerates the .ipynb with the jupytext CLI (BufWriteCmd path).
-- Aborting via error() cancels the write (verified: file stays untouched).
vim.api.nvim_create_autocmd("BufWritePre", {
  group = vim.api.nvim_create_augroup("ipynb-json-guard", { clear = true }),
  pattern = "*.ipynb",
  callback = function(e)
    local lines = vim.api.nvim_buf_get_lines(e.buf, 0, 5, false)
    if not table.concat(lines, "\n"):match("^%s*{") then
      local md = e.file:gsub("%.ipynb$", ".md")
      error(
        ("blocked write to %s — buffer is not JSON (jupytext markdown twin?). Restore with: jupytext --to ipynb -o %s %s"):format(
          vim.fs.basename(e.file),
          vim.fs.basename(e.file),
          vim.fs.basename(md)
        )
      )
    end
  end,
})

-- automatically export output chunks to a jupyter notebook on write
vim.api.nvim_create_autocmd("BufWritePost", {
  pattern = { "*.ipynb" },
  callback = function()
    if require("molten.status").initialized() == "Molten" then
      vim.cmd("MoltenExportOutput!")
    end
  end,
})

-- Create a blank but valid Python notebook.
-- The nbformat template lives in lua/config/notebook.lua, because the same
-- template is also written by the auto-seed BufReadCmd (an empty or missing
-- .ipynb is seeded on open instead of erroring in jupytext/molten). If you use
-- another language than Python, change the kernelspec in that template.
vim.api.nvim_create_user_command("NewNotebook", function(opts)
  require("config.notebook").create(opts.args)
end, {
  nargs = 1,
  complete = "file",
  desc = "Create a new ipynb notebook",
})

-- The guide to this setup (also on <localleader>h in notebook buffers, where
-- it is the same key as the LaTeX guide in .tex buffers).
vim.api.nvim_create_user_command("NotebookGuide", function()
  require("config.notebook-guide").open()
end, { desc = "Open the notebook setup guide" })

-- Helper function to open files with external viewer
local function open_with_external_viewer(file_path, viewer_cmd)
  vim.fn.jobstart(vim.list_extend(viewer_cmd, { file_path }), {
    detach = true,
  })
  -- Close the buffer Neovim created after the :edit machinery finishes
  local buf = vim.api.nvim_get_current_buf()
  vim.schedule(function()
    if vim.api.nvim_buf_is_valid(buf) then
      vim.api.nvim_buf_delete(buf, { force = true })
    end
  end)
end

-- open pdfs in sioyek instead of a neovim buffer
vim.api.nvim_create_autocmd("BufReadCmd", {
  pattern = "*.pdf",
  callback = function()
    local file_path = vim.api.nvim_buf_get_name(0)
    open_with_external_viewer(file_path, { "sioyek", "--new-window" })
  end,
})

-- open png and jpeg files in preview instead of a neovim buffer
vim.api.nvim_create_autocmd("BufReadCmd", {
  pattern = { "*.png", "*.jpg", "*.jpeg", "*.gif", "*.bmp", "*.webp" },
  callback = function()
    local file_path = vim.api.nvim_buf_get_name(0)
    open_with_external_viewer(file_path, { "open", "-a", "Preview" })
  end,
})

-- keywordprg config
vim.api.nvim_create_autocmd("FileType", {
  pattern = { "python", "lua", "sh", "man" },
  callback = function()
    local ft = vim.bo.filetype -- Get the current filetype

    if ft == "python" then
      -- Use pydoc for Python
      vim.opt_local.keywordprg = ":!python3 -m pydoc "
    elseif ft == "lua" then
      -- Use :help for Lua files
      vim.opt_local.keywordprg = ":help "
    elseif ft == "sh" or ft == "man" then
      -- Use the system man page for shell scripts and man pages themselves
      vim.opt_local.keywordprg = ":Man "
    end
  end,
})

-- Per-agent-mode colors for the opencode footer badge (cycle modes with <leader>om).
-- build/plan have dedicated highlight groups; every other agent (chat, custom)
-- shares OpencodeAgentCustom. The plugin defines them with `default = true`, so
-- our values win. Backgrounds come from the active cyberdream palette
-- (variant = "auto" -> default on dark, light on light); the foreground is
-- cyberdream's base bg (dark text on the neon dark badges, white on the light
-- badges). Note: with transparent = true the dark palette reports bg = "NONE",
-- hence the literal.
local function set_opencode_agent_highlights()
  local dark = vim.o.background == "dark"
  local ok, palette = pcall(function()
    local colors = require("cyberdream.colors")
    return dark and colors.default or colors.light
  end)
  if not ok or not palette then
    return
  end
  local modes = {
    OpencodeAgentBuild = palette.red, -- build
    OpencodeAgentPlan = palette.purple, -- plan
    OpencodeAgentCustom = palette.blue, -- chat / other agents
  }
  local fg = dark and "#16181a" or "#ffffff"
  for group, bg in pairs(modes) do
    vim.api.nvim_set_hl(0, group, { bg = bg, fg = fg, bold = true })
  end
end

set_opencode_agent_highlights()
vim.api.nvim_create_autocmd("ColorScheme", { callback = set_opencode_agent_highlights })
