-- One-page report skeleton written by :TexNewReport. Kept as a line list so the
-- source stays readable and stylua-friendly (no indentation leaking into file).
local report_template = {
  "\\documentclass[11pt]{article}",
  "\\usepackage[margin=1in]{geometry}",
  "\\usepackage{amsmath,amssymb}",
  "\\usepackage{hyperref}",
  "",
  "\\title{One-Page Report}",
  "\\author{Aman}",
  "\\date{\\today}",
  "",
  "\\begin{document}",
  "\\maketitle",
  "",
  "\\section{Introduction}",
  "",
  "\\section{Method}",
  "",
  "\\section{Results}",
  "",
  "\\end{document}",
}

-- \lh opens the LaTeX guide (nvim/guides/latex-guide.md) in a floating window.
local guide_path = vim.fn.stdpath("config") .. "/guides/latex-guide.md"

local function open_latex_guide()
  if vim.fn.filereadable(guide_path) ~= 1 then
    vim.notify("LaTeX guide not found: " .. guide_path, vim.log.levels.WARN)
    return
  end

  local buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, vim.fn.readfile(guide_path))
  vim.bo[buf].filetype = "markdown"

  local width = math.min(110, math.floor(vim.o.columns * 0.85))
  local height = math.floor(vim.o.lines * 0.85)
  local win = vim.api.nvim_open_win(buf, true, {
    relative = "editor",
    width = width,
    height = height,
    row = math.floor((vim.o.lines - height) / 2),
    col = math.floor((vim.o.columns - width) / 2),
    style = "minimal",
    border = "rounded",
    title = " LaTeX Guide ",
    title_pos = "center",
  })

  vim.wo[win].wrap = true
  vim.wo[win].number = false
  vim.wo[win].relativenumber = false
  vim.wo[win].signcolumn = "no"

  local function close()
    if vim.api.nvim_win_is_valid(win) then
      vim.api.nvim_win_close(win, true)
    end
  end
  for _, key in ipairs({ "q", "<Esc>", "<localleader>lh" }) do
    vim.keymap.set("n", key, close, { buffer = buf, nowait = true, desc = "Close LaTeX guide" })
  end
end

return {
  "lervag/vimtex",
  lazy = false, -- we don't want to lazy load VimTeX
  -- tag = "v2.15", -- uncomment to pin to a specific release
  init = function()
    -- VimTeX configuration
    vim.g.vimtex_format_enabled = 1
    vim.cmd("syntax enable")

    -- skim as pdf viewer
    -- vim.g.vimtex_view_method = "skim"
    -- vim.g.vimtex_view_skim_sync = 1
    -- vim.g.vimtex_view_skim_activate = 1

    -- sioyek as pdf viewer. `--reuse-window` makes VimTeX reuse the running
    -- sioyek window and forward-search it, instead of spawning a new window.
    vim.g.vimtex_view_method = "sioyek"
    vim.g.vimtex_view_sioyek_options = "--reuse-window"
    vim.g.vimtex_callback_progpath = "/opt/homebrew/bin/nvim"
    vim.g.vimtex_quickfix_open_on_warning = 0 -- don't open quickfix window when there are only warnings

    -- :TexNewReport [name] -> create ./main.tex (or ./<name>/main.tex)
    vim.api.nvim_create_user_command("TexNewReport", function(args)
      local dir = vim.fn.getcwd()
      if args.args ~= "" then
        dir = dir .. "/" .. args.args
        vim.fn.mkdir(dir, "p")
      end
      local path = dir .. "/main.tex"
      if vim.uv.fs_stat(path) then
        vim.notify("main.tex already exists: " .. path, vim.log.levels.WARN)
        return
      end
      vim.fn.writefile(report_template, path)
      vim.cmd.edit(vim.fn.fnameescape(path))
    end, { nargs = "?", complete = "dir", desc = "Create a one-page LaTeX report" })

    -- \lh: show the LaTeX guide in a floating window
    vim.api.nvim_create_autocmd("FileType", {
      pattern = "tex",
      callback = function()
        vim.keymap.set("n", "<localleader>lh", open_latex_guide, { buffer = true, desc = "LaTeX guide" })
      end,
    })
  end,
}
