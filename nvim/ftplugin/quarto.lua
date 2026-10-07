-- Molten keymaps for notebook buffers (ft=quarto: .qmd files and jupytext-
-- converted .ipynb buffers). localleader is "\".
--
-- Note: `MoltenEvaluateCell` does not exist in molten (checked the command
-- registry on branch main) — "run cell" is implemented below by locating the
-- fenced block under the cursor and calling the MoltenEvaluateRange API.
-- `MoltenReevaluateCell` only works on cells that have been run at least once
-- (it looks up existing cell spans).

---Evaluate the fenced code block under the cursor with molten.
---Uses MoltenEvaluateRange (the programmatic API) so no visual-mode dance is
---needed; errors politely if molten's remote plugin isn't registered yet.
local function run_cell()
  local lnum = vim.api.nvim_win_get_cursor(0)[1]
  local lines = vim.api.nvim_buf_get_lines(0, 0, -1, false)
  local fences = {}
  for i, l in ipairs(lines) do
    if l:match("^%s*```") then
      fences[#fences + 1] = i
    end
  end
  local opening, closing
  -- fences alternate open/close, so cells are (1,2), (3,4), ...
  for k = 1, #fences - 1, 2 do
    if lnum >= fences[k] and lnum <= fences[k + 1] then
      opening, closing = fences[k], fences[k + 1]
      break
    end
  end
  if not opening then
    vim.notify("molten: cursor is not inside a code cell", vim.log.levels.WARN)
    return
  end
  if closing - opening < 2 then
    vim.notify("molten: cell is empty", vim.log.levels.WARN)
    return
  end
  local ok, err = pcall(vim.fn.MoltenEvaluateRange, opening + 1, closing - 1)
  if not ok then
    vim.notify("molten: " .. tostring(err), vim.log.levels.ERROR)
  end
end

local map = function(lhs, rhs, desc, mode)
  vim.keymap.set(mode or "n", lhs, rhs, { buffer = true, desc = desc, silent = true })
end

-- run / evaluate
map("<localleader>rc", run_cell, "run cell")
map("<localleader>rr", ":MoltenReevaluateCell<CR>", "re-run cell")
map("<localleader>e", ":MoltenEvaluateOperator<CR>", "evaluate operator/motion")
map("<localleader>r", ":<C-u>MoltenEvaluateVisual<CR>gv", "evaluate selection", "v")
map("<leader>mr", ":MoltenEvaluateLine<CR>", "Molten: evaluate line")
map("<leader>mc", run_cell, "Molten: run cell")

-- kernel
map("<localleader>mi", ":MoltenInit<CR>", "init kernel")
map("<localleader>x", ":MoltenInterrupt<CR>", "interrupt kernel")
map("<localleader>R", ":MoltenRestart<CR>", "restart kernel")
map("<localleader>ms", ":MoltenSave<CR>", "save kernel state")
map("<localleader>ml", ":MoltenLoad<CR>", "load kernel state")

-- output
map("<localleader>os", ":noautocmd MoltenEnterOutput<CR>", "show/enter output")
map("<localleader>oh", ":MoltenHideOutput<CR>", "hide output")
map("<localleader>ob", ":MoltenOpenInBrowser<CR>", "output in browser")
map("<localleader>ip", ":MoltenImagePopup<CR>", "image popup")
map("<localleader>my", ":MoltenYankOutput<CR>", "yank output")
-- Expand the output float to fit its full buffer (works only while the
-- cursor is inside it, i.e. after <localleader>os). Molten re-renders the
-- window at max height on the next evaluation, so this is per-render.
map("<localleader>oe", function()
  local cfg = vim.api.nvim_win_get_config(0)
  if cfg.relative == "" and cfg.external == false then
    vim.notify("molten: cursor is not inside the output window — use <localleader>os first", vim.log.levels.WARN)
    return
  end
  local lines = vim.api.nvim_buf_line_count(0)
  if lines > vim.api.nvim_win_get_height(0) then
    vim.api.nvim_win_set_height(0, lines)
  end
end, "expand output window")

-- cell management
map("<localleader>md", ":MoltenDelete<CR>", "delete molten cell")

-- which-key: groups + nerd-font icons (buffer-local, notebook buffers only)
local wk = require("which-key")
local buf = vim.api.nvim_get_current_buf()
wk.add({
  { "<leader>m", group = "Molten", icon = "󱁯", buffer = buf },
  { "<leader>mr", desc = "Evaluate line", icon = "󰐊", buffer = buf },
  { "<leader>mc", desc = "Run cell", icon = "󰐊", buffer = buf },

  { "<localleader>r", group = "run", icon = "󰐊", buffer = buf },
  { "<localleader>rc", desc = "run cell", icon = "󰐊", buffer = buf },
  { "<localleader>rr", desc = "re-run cell", icon = "󰑓", buffer = buf },
  { "<localleader>e", desc = "evaluate operator/motion", icon = "󰐊", buffer = buf },
  { "<localleader>r", desc = "evaluate selection", icon = "󰐊", mode = "v", buffer = buf },

  { "<localleader>mi", desc = "init kernel", icon = "󰌠", buffer = buf },
  { "<localleader>x", desc = "interrupt kernel", icon = "󰓛", buffer = buf },
  { "<localleader>R", desc = "restart kernel", icon = "󰦓", buffer = buf },
  { "<localleader>ms", desc = "save kernel state", icon = "󰆓", buffer = buf },
  { "<localleader>ml", desc = "load kernel state", icon = "󰍖", buffer = buf },

  { "<localleader>o", group = "output", icon = "󰕮", buffer = buf },
  { "<localleader>os", desc = "show/enter output", icon = "󰕮", buffer = buf },
  { "<localleader>oh", desc = "hide output", icon = "󰘁", buffer = buf },
  { "<localleader>ob", desc = "output in browser", icon = "󰈹", buffer = buf },
  { "<localleader>oe", desc = "expand output window", icon = "󰊓", buffer = buf },
  { "<localleader>ip", desc = "image popup", icon = "", buffer = buf },
  { "<localleader>my", desc = "yank output", icon = "󰆏", buffer = buf },

  { "<localleader>md", desc = "delete molten cell", icon = "󰆴", buffer = buf },
})
