-- Cyan -> blue gradient for the dashboard header art, sourced from the active
-- cyberdream palette (variant auto: default on dark, light on light). Returns
-- one styled chunk per line; "\n" prefixes make snacks start a new row.
-- The gradient can flow downward on demand: a timer rotates the per-line
-- highlight groups while the dashboard is open and focused. It starts idle;
-- press `a` on the dashboard to toggle the animation (see `ANIMATE`, `anim`,
-- and the autocmds in `init`).
local function hex_mix(a, b, t)
  local ar, ag, ab = tonumber(a:sub(2, 3), 16), tonumber(a:sub(4, 5), 16), tonumber(a:sub(6, 7), 16)
  local br, bg, bb = tonumber(b:sub(2, 3), 16), tonumber(b:sub(4, 5), 16), tonumber(b:sub(6, 7), 16)
  return string.format(
    "#%02x%02x%02x",
    math.floor(ar + (br - ar) * t + 0.5),
    math.floor(ag + (bg - ag) * t + 0.5),
    math.floor(ab + (bb - ab) * t + 0.5)
  )
end

-- Set to `false` to opt out of the header animation completely: the gradient
-- stays static and the `a` toggle key is not offered. Leave `true` to allow the
-- animation on demand (it stays idle until you press `a`).
local ANIMATE = true

-- Animation state for the dashboard header gradient. `base` holds one color per
-- art row (symmetric cyan -> blue -> cyan so the wrap is seamless) and `phase`
-- is rotated through it on a timer to make the gradient flow. The timer only
-- runs when the feature is enabled, the user toggled it on (`wanted`), the
-- dashboard is open, and the UI is focused, so switching tmux sessions pauses it
-- automatically.
local anim = {
  enabled = ANIMATE,
  wanted = false,
  focused = true,
  open = false,
  phase = 0,
  timer = nil,
  fps = 12,
  n = 0,
  base = {},
}

local function anim_apply()
  if anim.n == 0 then
    return
  end
  local p = anim.phase % anim.n
  for i = 1, anim.n do
    local c = anim.base[((i - 1 + p) % anim.n) + 1]
    vim.api.nvim_set_hl(0, "SnacksDashboardHeader" .. i, { fg = c, bold = true })
  end
end

local function anim_stop()
  if anim.timer then
    anim.timer:stop()
    anim.timer:close()
    anim.timer = nil
  end
end

local function anim_start()
  if anim.timer or not anim.enabled or not anim.wanted or not anim.focused or not anim.open or anim.n == 0 then
    return
  end
  anim.timer = vim.uv.new_timer()
  anim.timer:start(
    0,
    math.floor(1000 / anim.fps),
    vim.schedule_wrap(function()
      anim.phase = anim.phase + 1
      anim_apply()
    end)
  )
end

-- Start or stop the timer so it matches the current state.
local function anim_sync()
  if anim.enabled and anim.wanted and anim.focused and anim.open and anim.n > 0 then
    anim_start()
  else
    anim_stop()
  end
end

-- Toggle between the idle gradient and the flowing animation (dashboard `a`).
local function anim_toggle()
  if not anim.enabled then
    return
  end
  anim.wanted = not anim.wanted
  anim_sync()
end

-- Pause while the nvim UI (tmux session/pane) is unfocused, resume on return.
local function anim_focus(focused)
  anim.focused = focused
  if focused then
    anim_sync()
  else
    anim_stop()
  end
end

local function dashboard_header_gradient(item)
  local ok, colors = pcall(require, "cyberdream.colors")
  if not ok then
    return { { item.header, hl = "SnacksDashboardHeader" } }
  end
  local palette = vim.o.background == "light" and colors.light or colors.default
  local from, to = palette.cyan, palette.blue
  local lines = vim.split(item.header, "\n", { plain = true })
  -- drop leading/trailing blank lines so the gradient spans the visible art
  while #lines > 0 and lines[1]:find("^%s*$") do
    table.remove(lines, 1)
  end
  while #lines > 0 and lines[#lines]:find("^%s*$") do
    table.remove(lines)
  end
  local n = #lines
  -- symmetric cyan -> blue -> cyan curve so line 1 and line n meet seamlessly
  anim.base = {}
  for i = 1, n do
    local t = (i - 1) / n
    anim.base[i] = hex_mix(from, to, 1 - math.abs(2 * t - 1))
  end
  anim.n = n
  local out = {}
  for i, line in ipairs(lines) do
    local hl = "SnacksDashboardHeader" .. i
    vim.api.nvim_set_hl(0, hl, { fg = anim.base[i], bold = true })
    out[#out + 1] = { (i == 1 and "" or "\n") .. line, hl = hl }
  end
  return out
end

-- trimmed from LazyVim's set: drop Find File, Find Text, Config, Lazy Extras
-- and Lazy (all have <leader> maps already). The animation toggle is only
-- offered when `ANIMATE` is enabled.
---@type snacks.dashboard.Item[]
local dashboard_keys = {
  { icon = vim.fn.nr2char(0xf15b) .. " ", key = "n", desc = "New File", action = ":ene | startinsert" },
  {
    icon = vim.fn.nr2char(0xf0c5) .. " ",
    key = "r",
    desc = "Recent Files",
    action = ":lua Snacks.dashboard.pick('oldfiles')",
  },
  { icon = vim.fn.nr2char(0xe348) .. " ", key = "s", desc = "Restore Session", section = "session" },
  { icon = vim.fn.nr2char(0xf426) .. " ", key = "q", desc = "Quit", action = ":qa" },
}
if ANIMATE then
  table.insert(dashboard_keys, 4, {
    icon = vim.fn.nr2char(0xf04b) .. " ",
    key = "a",
    desc = "Toggle Animation",
    action = anim_toggle,
  })
end

return {
  "folke/snacks.nvim",
  priority = 1000,
  lazy = false,
  ---@type snacks.Config
  opts = {
    bigfile = { enabled = true },
    dashboard = {
      enabled = true,
      preset = {
        header = [[
                                                                     
       ████ ██████           █████      ██                     
      ███████████             █████                             
      █████████ ███████████████████ ███   ███████████   
     █████████  ███    █████████████ █████ ██████████████   
    █████████ ██████████ █████████ █████ █████ ████ █████   
  ███████████ ███    ███ █████████ █████ █████ ████ █████  
 ██████  █████████████████████ ████ █████ █████ ████ ██████ 
        ]],
        keys = dashboard_keys,
      },
      formats = {
        header = dashboard_header_gradient,
      },
    },
    explorer = { enabled = true },
    indent = { enabled = true },
    input = { enabled = true },
    notifier = {
      enabled = true,
      timeout = 3000,
    },
    picker = {
      enabled = true,
      layouts = {
        -- NOTE: match the telescope format but have the input field above the results
        telescope = {
          reverse = false,
          layout = {
            box = "horizontal",
            backdrop = false,
            width = 0.8,
            height = 0.9,
            border = "none",
            {
              box = "vertical",
              { win = "input", height = 1, border = "rounded", title = "{title} {live} {flags}", title_pos = "center" },
              { win = "list", title = " Results ", title_pos = "center", border = "rounded" },
            },
            {
              win = "preview",
              title = "{preview:Preview}",
              width = 0.45,
              border = "rounded",
              title_pos = "center",
            },
          },
        },
      },
      layout = "telescope",
      -- delete buffers from the picker with x (keeps snacks' <c-x>/dd defaults)
      sources = {
        buffers = {
          win = {
            input = {
              keys = {
                ["<c-x>"] = { "bufdelete", mode = { "n", "i" } },
                ["x"] = { "bufdelete", mode = { "n", "i" } },
              },
            },
            list = { keys = { ["dd"] = "bufdelete", ["x"] = "bufdelete" } },
          },
        },
      },
    },
    quickfile = { enabled = true },
    scope = { enabled = true },
    scroll = { enabled = false }, -- breaks gg/G jumps: interrupted smooth-scroll leaves cursor mid-flight
    statuscolumn = { enabled = true },
    words = { enabled = true },
    styles = {
      notification = {
        wo = { wrap = true }, -- Wrap notifications
      },
    },
    zen = {
      win = {
        style = "zen",
        width = 0.55, -- 80% of terminal width
      },
    },
  },
  keys = {
    -- Top Pickers & Explorer
    {
      "<leader><space>",
      function()
        Snacks.picker.smart()
      end,
      desc = "Files",
    },
    {
      "<leader>b",
      function()
        Snacks.picker.buffers()
      end,
      desc = "Buffers",
    },
    {
      "<leader>/",
      function()
        Snacks.picker.grep()
      end,
      desc = "Grep",
    },
    {
      "<leader>:",
      function()
        Snacks.picker.command_history()
      end,
      desc = "Vim Command History",
    },
    -- git
    {
      "<leader>gl",
      function()
        Snacks.picker.git_log()
      end,
      desc = "Git Log",
    },
    {
      "<leader>gL",
      function()
        Snacks.picker.git_log_line()
      end,
      desc = "Git Log Line",
    },
    {
      "<leader>gs",
      function()
        Snacks.picker.git_status()
      end,
      desc = "Git Status",
    },
    {
      "<leader>gS",
      function()
        Snacks.picker.git_stash()
      end,
      desc = "Git Stash",
    },
    {
      "<leader>gd",
      function()
        Snacks.picker.git_diff()
      end,
      desc = "Git Diff (Hunks)",
    },
    {
      "<leader>gf",
      function()
        Snacks.picker.git_log_file()
      end,
      desc = "Git Log File",
    },
    -- Grep
    {
      "<leader>sb",
      function()
        Snacks.picker.lines()
      end,
      desc = "Buffer Lines",
    },
    {
      "<leader>sB",
      function()
        Snacks.picker.grep_buffers()
      end,
      desc = "Grep Open Buffers",
    },
    {
      "<leader>sg",
      function()
        Snacks.picker.grep()
      end,
      desc = "Grep",
    },
    {
      "<leader>sw",
      function()
        Snacks.picker.grep_word()
      end,
      desc = "Visual selection or word",
      mode = { "n", "x" },
    },
    -- search
    {
      '<leader>s"',
      function()
        Snacks.picker.registers()
      end,
      desc = "Registers",
    },
    {
      "<leader>s/",
      function()
        Snacks.picker.search_history()
      end,
      desc = "Search History",
    },
    {
      "<leader>sC",
      function()
        Snacks.picker.commands()
      end,
      desc = "Commands",
    },
    {
      "<leader>sd",
      function()
        Snacks.picker.diagnostics()
      end,
      desc = "Diagnostics",
    },
    {
      "<leader>sD",
      function()
        Snacks.picker.diagnostics_buffer()
      end,
      desc = "Buffer Diagnostics",
    },
    {
      "<leader>sh",
      function()
        Snacks.picker.help()
      end,
      desc = "Help Pages",
    },
    {
      "<leader>sH",
      function()
        Snacks.picker.highlights()
      end,
      desc = "Highlights",
    },
    {
      "<leader>si",
      function()
        Snacks.picker.icons()
      end,
      desc = "Icons",
    },
    {
      "<leader>sj",
      function()
        Snacks.picker.jumps()
      end,
      desc = "Jumps",
    },
    {
      "<leader>sk",
      function()
        Snacks.picker.keymaps()
      end,
      desc = "Keymaps",
    },
    {
      "<leader>sl",
      function()
        Snacks.picker.loclist()
      end,
      desc = "Location List",
    },
    {
      "<leader>sm",
      function()
        Snacks.picker.marks()
      end,
      desc = "Marks",
    },
    {
      "<leader>sM",
      function()
        Snacks.picker.man()
      end,
      desc = "Man Pages",
    },
    {
      "<leader>sp",
      function()
        Snacks.picker.lazy()
      end,
      desc = "Search for Plugin Spec",
    },
    {
      "<leader>sq",
      function()
        Snacks.picker.qflist()
      end,
      desc = "Quickfix List",
    },
    {
      "<leader>sR",
      function()
        Snacks.picker.resume()
      end,
      desc = "Resume",
    },
    {
      "<leader>su",
      function()
        Snacks.picker.undo()
      end,
      desc = "Undo History",
    },
    {
      "<leader>uC",
      function()
        Snacks.picker.colorschemes()
      end,
      desc = "Colorschemes",
    },
    -- LSP
    {
      "gd",
      function()
        Snacks.picker.lsp_definitions()
      end,
      desc = "Goto Definition",
    },
    {
      "gD",
      function()
        Snacks.picker.lsp_declarations()
      end,
      desc = "Goto Declaration",
    },
    {
      "gr",
      function()
        Snacks.picker.lsp_references()
      end,
      nowait = true,
      desc = "References",
    },
    {
      "gI",
      function()
        Snacks.picker.lsp_implementations()
      end,
      desc = "Goto Implementation",
    },
    {
      "gy",
      function()
        Snacks.picker.lsp_type_definitions()
      end,
      desc = "Goto T[y]pe Definition",
    },
    {
      "<leader>ss",
      function()
        Snacks.picker.lsp_symbols()
      end,
      desc = "LSP Symbols",
    },
    {
      "<leader>sS",
      function()
        Snacks.picker.lsp_workspace_symbols()
      end,
      desc = "LSP Workspace Symbols",
    },
    -- Other
    {
      "<leader>.",
      function()
        Snacks.scratch()
      end,
      desc = "Toggle Scratch Buffer",
    },
    {
      "<leader>n",
      function()
        Snacks.notifier.show_history()
      end,
      desc = "Notification History",
    },
    {
      "<leader>bd",
      function()
        Snacks.bufdelete()
      end,
      desc = "Delete Buffer",
    },
    {
      "<leader>cR",
      function()
        Snacks.rename.rename_file()
      end,
      desc = "Rename File",
    },
    {
      "<leader>GB",
      function()
        Snacks.gitbrowse()
      end,
      desc = "Browse",
      mode = { "n", "v" },
    },
    {
      "<leader>gg",
      function()
        Snacks.lazygit()
      end,
      desc = "Lazygit",
    },
    {
      "<leader>un",
      function()
        Snacks.notifier.hide()
      end,
      desc = "Dismiss All Notifications",
    },
    {
      "<c-/>",
      function()
        Snacks.terminal()
      end,
      desc = "Toggle Terminal",
    },
    {
      "<c-_>",
      function()
        Snacks.terminal()
      end,
      desc = "which_key_ignore",
    },
    {
      "]]",
      function()
        Snacks.words.jump(vim.v.count1)
      end,
      desc = "Next Reference",
      mode = { "n", "t" },
    },
    {
      "[[",
      function()
        Snacks.words.jump(-vim.v.count1)
      end,
      desc = "Prev Reference",
      mode = { "n", "t" },
    },
  },
  init = function()
    vim.api.nvim_create_autocmd("User", {
      pattern = "SnacksDashboardOpened",
      callback = function()
        anim.open = true
        anim_sync()
      end,
    })
    vim.api.nvim_create_autocmd("User", {
      pattern = "SnacksDashboardClosed",
      callback = function()
        anim.open = false
        anim_stop()
      end,
    })
    if ANIMATE then
      vim.api.nvim_create_autocmd("FocusGained", {
        callback = function()
          anim_focus(true)
        end,
      })
      vim.api.nvim_create_autocmd("FocusLost", {
        callback = function()
          anim_focus(false)
        end,
      })
      vim.api.nvim_create_autocmd("VimResume", {
        callback = function()
          anim_focus(true)
        end,
      })
      vim.api.nvim_create_autocmd("VimSuspend", {
        callback = function()
          anim_focus(false)
        end,
      })
    end
    vim.api.nvim_create_autocmd("User", {
      pattern = "VeryLazy",
      callback = function()
        -- Setup some globals for debugging (lazy-loaded)
        _G.dd = function(...)
          Snacks.debug.inspect(...)
        end
        _G.bt = function()
          Snacks.debug.backtrace()
        end
        vim.print = _G.dd -- Override print to use snacks for `:=` command
      end,
    })
  end,
}
