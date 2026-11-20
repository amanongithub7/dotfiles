-- Winbar for CodeCompanion chat buffers: which provider and model the chat is
-- currently on.
--
-- The winbar is an *expression* (see setup()), re-evaluated on every redraw, so
-- a model switch (<leader>am), an adapter change (<leader>aM) or a restored
-- session shows up with no events to listen to.
--
-- It cannot live inside the chat buffer itself: with
-- display.chat.show_settings = true codecompanion regenerates the YAML settings
-- block from the adapter schema on every render, so any line written above it
-- is wiped. The window-local winbar is the surface that survives, and the
-- chat buffer's own header (roles.llm) only appears once the LLM replies.
local M = {}

M.augroup = vim.api.nvim_create_augroup("cc-winbar", { clear = true })

-- Filled by setup(): model id -> friendly label, i.e. the MODELS table from
-- lua/plugins/codecompanion.lua, so the winbar and the model picker agree.
---@type table<string, string>
M.labels = {}

---Register the winbar for every window that displays a chat buffer.
---@param labels? table<string, string>
function M.setup(labels)
  M.labels = labels or M.labels

  ---An expression, not a rendered string: `render()` runs on every redraw, and
  ---returns "" for a window that no longer shows a chat.
  ---@param bufnr number
  local function attach(bufnr)
    for _, win in ipairs(vim.fn.win_findbuf(bufnr)) do
      vim.wo[win].winbar = "%{%v:lua.require'config.cc-winbar'.render()%}"
    end
  end

  -- FileType is what actually attaches the bar: the ft is assigned *after* the
  -- window is displayed, so BufWinEnter alone sees filetype = "" and bails.
  vim.api.nvim_create_autocmd("FileType", {
    group = M.augroup,
    pattern = "codecompanion",
    callback = function(ev)
      attach(ev.buf)
    end,
  })

  -- BufWinEnter covers re-displaying a chat whose ft is already set: another
  -- window, a new split, :sbuffer, ...
  vim.api.nvim_create_autocmd("BufWinEnter", {
    group = M.augroup,
    callback = function(ev)
      if vim.bo[ev.buf].filetype == "codecompanion" then
        attach(ev.buf)
      end
    end,
  })
end

---Cut `text` down to `width` display columns, ending in an ellipsis. Never
---splits a multibyte char; wide (CJK) chars are measured with strdisplaywidth.
---@param text string
---@param width number
---@return string
local function fit(text, width)
  if width <= 0 then
    return ""
  end
  if vim.fn.strdisplaywidth(text) <= width then
    return text
  end
  local out = ""
  for _, char in ipairs(vim.fn.split(text, "\\zs")) do
    if vim.fn.strdisplaywidth(out .. char .. "…") > width then
      break
    end
    out = out .. char
  end
  return out .. "…"
end

---The gutter width and usable width of the window being drawn, as Neovim
---reports them for the winbar: the bar spans the gutter too, the buffer text
---does not. textoff is the width of 'number'/'signcolumn'/'foldcolumn'
---together.
---@return integer gutter, integer width
local function window_metrics()
  local winid = vim.fn.win_getid()
  local info = (winid and winid > 0) and vim.fn.getwininfo(winid)[1] or nil
  if not info then
    return 0, 79
  end
  local gutter = info.textoff or 0
  return gutter, info.width - gutter - 1 -- trailing space
end

---The winbar text for the chat buffer shown in the current window.
---@return string
function M.render()
  local ok, cc = pcall(require, "codecompanion")
  if not ok then
    return ""
  end

  local chat = cc.buf_get_chat(0)
  if not chat or not chat.adapter then
    return ""
  end

  local provider = chat.adapter.formatted_name or chat.adapter.name or "?"

  -- settings.model is what the YAML block edits; fall back to the adapter's
  -- schema default while the chat is still being initialised.
  local model = chat.settings and chat.settings.model
  if type(model) ~= "string" then
    local default = chat.adapter.schema and chat.adapter.schema.model and chat.adapter.schema.model.default
    model = type(default) == "function" and default(chat.adapter) or default
  end

  -- Prefer the label the adapter knows for the chosen model (set from the
  -- schema's `choices`), so provider-specific ids like Paratera's
  -- "DeepSeek-V4.1-Flash" read as "DeepSeek V4.1 Flash". MODELS is the fallback
  -- for adapters whose choices don't carry a formatted_name.
  local known = chat.adapter.model and chat.adapter.model.formatted_name
  local label = type(model) == "string" and (known or M.labels[model] or model) or nil
  local body = label and (provider .. "  ·  " .. label) or provider

  -- Centred inside the text area (the gutter is excluded, so the bar sits in
  -- the middle of the chat text rather than of the whole window). `fit` keeps
  -- it inside the width, shortening the model label from the right instead of
  -- letting Neovim truncate the left edge and hide the provider.
  --
  -- +1: Neovim swallows one leading space from a %{expression} result, so pad
  -- one extra to land on the computed column exactly.
  local gutter, width = window_metrics()
  body = fit(body, width)
  local pad = math.max(0, math.floor((width - vim.fn.strdisplaywidth(body)) / 2))
  return string.rep(" ", gutter + pad + 1) .. body
end

return M
