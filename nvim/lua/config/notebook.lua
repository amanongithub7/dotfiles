-- Notebook (ipynb) helpers: the nbformat template, the :NewNotebook creator,
-- and the auto-seed that runs when an empty .ipynb is opened.
--
-- Why the auto-seed exists: jupytext.nvim takes over reading every *.ipynb
-- with its own BufReadCmd and shells out to `jupytext --to md`, which needs a
-- real nbformat document. An empty file makes that throw (vim.json.decode("")
-- -> "Expected value but found T_END"), and a missing one throws earlier
-- (io.open() -> nil). Molten then reports the buffer as "not a valid ipynb".
-- autoseed registers a BufReadCmd *before* jupytext's, so the file is valid by
-- the time the conversion runs.
local M = {}

-- nbformat 4.5, one empty markdown cell (jupytext drops it on read, which is
-- why a fresh notebook opens as frontmatter only). The kernelspec is what lets
-- lua/molten-kernel.lua pick a kernel from the notebook metadata; its "name"
-- must match an entry of `jupyter kernelspec list`.
M.template = [[
{
  "cells": [
    {
      "cell_type": "markdown",
      "id": "dsh-empty",
      "metadata": {},
      "source": [""]
    }
  ],
  "metadata": {
    "kernelspec": {
      "display_name": "Python 3",
      "language": "python",
      "name": "python3"
    },
    "language_info": {
      "codemirror_mode": {
        "name": "ipython"
      },
      "file_extension": ".py",
      "mimetype": "text/x-python",
      "name": "python",
      "nbconvert_exporter": "python",
      "pygments_lexer": "ipython3"
    }
  },
  "nbformat": 4,
  "nbformat_minor": 5
}
]]

---@param path string
---@return string
local function absolute(path)
  return vim.fn.fnamemodify(vim.fn.expand(path), ":p")
end

---Write the template to `path` when the file is missing or whitespace-only.
---A file with any content is left alone, so a broken-but-nonempty notebook is
---never clobbered (the molten warning still applies to it).
---@param path string
---@return boolean seeded
function M.ensure(path)
  path = absolute(path)

  local f = io.open(path, "r")
  if f then
    -- Only the head matters: real notebooks start with "{" (or whitespace).
    local head = f:read(4096) or ""
    f:close()
    if head:find("%S") then
      return false
    end
  end

  local out, err = io.open(path, "w")
  if not out then
    vim.notify(("notebook: cannot create %s: %s"):format(path, err or "unknown error"), vim.log.levels.ERROR)
    return false
  end
  out:write(M.template)
  out:close()
  return true
end

---Create a notebook (used by :NewNotebook). Accepts a name with or without the
---.ipynb suffix, creates parent directories, and opens the result.
---@param name string
---@return string|nil path
function M.create(name)
  local stripped = (name:gsub("%.ipynb$", ""))
  if stripped == "" then
    vim.notify("notebook: a file name is required", vim.log.levels.ERROR)
    return nil
  end
  local path = stripped .. ".ipynb"
  vim.fn.mkdir(vim.fn.fnamemodify(path, ":h"), "p")
  if not M.ensure(path) then
    return nil
  end
  vim.cmd.edit(vim.fn.fnameescape(path))
  return path
end

---Register the BufReadCmd that seeds empty/missing notebooks. Must be called
---before require("jupytext").setup(), which registers its own BufReadCmd for
---the same pattern: Vim runs the autocmds in registration order.
function M.autoseed()
  local group = vim.api.nvim_create_augroup("ipynb-autoseed", { clear = true })
  vim.api.nvim_create_autocmd("BufReadCmd", {
    group = group,
    pattern = "*.ipynb",
    callback = function(ev)
      if M.ensure(ev.file or ev.match) then
        vim.notify(
          ("notebook: seeded empty %s with the nbformat template"):format(vim.fs.basename(ev.file or ev.match)),
          vim.log.levels.INFO
        )
      end
    end,
  })
end

return M
