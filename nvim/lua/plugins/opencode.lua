-- macOS desktop alerts for OpenCode completion/permission/question events. The
-- alert is suppressed only while the nvim UI is actually visible: nvim still
-- thinks it has focus, *and* the terminal window is on the focused AeroSpace
-- workspace. Switching to an empty/same-app workspace does not move macOS focus,
-- so nvim keeps its `focused` flag without an AeroSpace query for help.
--
-- Ghostty understands OSC 777 notifications but suppresses them while its window
-- is focused, so: if Ghostty is frontmost (e.g. you switched tmux sessions in the
-- same window) fall back to an osascript system notification, which shows
-- regardless of focus; otherwise emit the native OSC banner. When running inside
-- tmux the OSC is wrapped in a passthrough sequence (needs `allow-passthrough`).
local focused = true

local function session_name(session)
  if not session then
    return "session"
  end
  return (session.title and session.title ~= "" and session.title) or session.id or "session"
end

-- Native terminal notification (OSC 777), tmux-passthrough wrapped when needed.
-- tmux's DCS parser drops a lone ESC, so the inner ESC must be doubled
-- (\e\e) for the terminal to receive a real OSC.
local function emit_osc(title, body)
  local esc = "\27"
  local osc = "]777;notify;" .. title .. ";" .. body .. "\7"
  local seq = vim.env.TMUX and (esc .. "Ptmux;" .. esc .. esc .. osc .. esc .. "\\") or (esc .. osc)
  io.stdout:write(seq)
  io.stdout:flush()
end

-- macOS Notification Center alert. Args are passed via argv so no escaping.
local function macos_notify(title, body)
  vim.system({
    "osascript",
    "-e",
    "on run argv",
    "-e",
    "display notification (item 2 of argv) with title (item 1 of argv)",
    "-e",
    "end run",
    "--",
    title,
    body,
  })
end

-- Frontmost application name ("Ghostty", "LibreOffice", ...) or nil.
local function front_app(cb)
  vim.system({ "lsappinfo", "front" }, { text = true }, function(front)
    local asn = front.code == 0 and vim.trim(front.stdout or "") or ""
    if asn == "" then
      return cb(nil)
    end
    vim.system({ "lsappinfo", "info", "-only", "name", asn }, { text = true }, function(info)
      cb((info.stdout or ""):match('^"([^"]+)"'))
    end)
  end)
end

-- Whether `app` has a window on the focused AeroSpace workspace. Returns nil
-- when AeroSpace can't be queried (then callers keep the old focused-only
-- behavior rather than risking notification spam).
local function app_on_active_workspace(app)
  if not app or vim.fn.exepath("aerospace") == "" then
    return nil
  end
  local ws = vim.fn.systemlist({ "aerospace", "list-workspaces", "--focused" })[1]
  if not ws or ws == "" then
    return nil
  end
  local ok, wins = pcall(vim.fn.systemlist, {
    "aerospace",
    "list-windows",
    "--workspace",
    ws,
    "--format",
    "%{app-name}",
  })
  if not ok then
    return nil
  end
  return vim.tbl_contains(wins, app)
end

local function desktop_notify(title, body)
  body = body:gsub("[%c]", " ")
  vim.schedule(function()
    front_app(function(name)
      -- vim.system callbacks run in a fast-event context; hop back to the main
      -- loop before shelling out to aerospace.
      vim.schedule(function()
        -- nil (unavailable) or true means "looks visible" -> stay quiet while
        -- nvim still has focus; false means the terminal is off the active
        -- workspace.
        if focused and app_on_active_workspace(name) ~= false then
          return
        end
        if name and name:lower() == "ghostty" then
          macos_notify(title, body)
        else
          emit_osc(title, body)
        end
      end)
    end)
  end)
end

return {
  {
    "sudo-tee/opencode.nvim",
    -- OpenCode CLI v2 renamed the serve startup line ("opencode server listening
    -- on" -> "server listening on") and moved the HTTP API/event endpoints, so
    -- `main` never sees the server become ready and hangs on "Loading...".
    -- The v2 branch is the upstream-supported plugin line for OpenCode v2.
    branch = "v2",
    lazy = true,
    cmd = { "Opencode" },
    -- lazy stubs for the entry maps; the plugin's own keymaps replace them on load
    keys = {
      { "<leader>og", desc = "Toggle Opencode" },
      { "<leader>oi", desc = "Open Input Window" },
      { "<leader>os", desc = "Session Management" },
      { "<leader>op", desc = "Configure Provider" },
      { "<leader>oz", desc = "Toggle Zoom" },
      { "<leader>om", desc = "Toggle Agent Mode" },
      { "<leader>or", desc = "Toggle Reasoning" },
    },
    dependencies = {
      "nvim-lua/plenary.nvim",
      "MeanderingProgrammer/render-markdown.nvim",
      -- Optional, for file mentions and commands completion, pick only one
      "saghen/blink.cmp",
      -- 'hrsh7th/nvim-cmp',

      -- Optional, for file mentions picker, pick only one
      "folke/snacks.nvim",
      -- 'nvim-telescope/telescope.nvim',
      -- 'ibhagwan/fzf-lua',
      -- 'nvim_mini/mini.nvim',
    },
    init = function()
      -- Track UI focus so desktop alerts only fire while you're looking away.
      local focus_group = vim.api.nvim_create_augroup("OpencodeNotifyFocus", { clear = true })
      vim.api.nvim_create_autocmd({ "FocusGained", "VimResume" }, {
        group = focus_group,
        callback = function()
          focused = true
        end,
      })
      vim.api.nvim_create_autocmd({ "FocusLost", "VimSuspend" }, {
        group = focus_group,
        callback = function()
          focused = false
        end,
      })

      -- (Question-input alerts now come from the `on_question_asked` hook in
      -- opts below: the v2 branch streams `form.created`, not the old
      -- `OpencodeEvent:question.asked`, so that autocmd no longer fires.)

      -- Session picker: rename the title and stay in normal mode so the
      -- plain-letter actions (r/x/n/t/f/s) work without Ctrl. The BufEnter
      -- autocmd re-applies normal mode whenever the picker regains focus
      -- (e.g. after the rename prompt), but not when the user manually
      -- presses i to search.
      local group = vim.api.nvim_create_augroup("OpencodeSessionPicker", { clear = true })

      local function find_session_picker()
        local ok, Snacks = pcall(require, "snacks")
        if not ok then
          return nil
        end
        for _, p in ipairs(Snacks.picker.get({ tab = false })) do
          local title = type(p.title) == "string" and p.title or ""
          if title:find("Select A Session", 1, true) or title:find("Session Manager", 1, true) then
            return p
          end
        end
        return nil
      end

      local function to_normal_mode()
        vim.schedule(function()
          vim.cmd("stopinsert")
        end)
      end

      vim.api.nvim_create_autocmd("FileType", {
        group = group,
        pattern = "snacks_picker_input",
        callback = function(args)
          local picker = find_session_picker()
          if not picker then
            return
          end

          vim.schedule(function()
            if picker.closed then
              return
            end
            local title = type(picker.title) == "string" and picker.title or ""
            picker.title = title:gsub("^Select A Session", "Session Manager")
            picker:update_titles()
          end)

          vim.api.nvim_create_autocmd("BufEnter", {
            group = group,
            buffer = args.buf,
            callback = to_normal_mode,
          })

          to_normal_mode()
        end,
      })
    end,
    -- Workarounds for two upstream v2 defects (config-only; drop when fixed):
    --
    -- 1. `context.get_git_diff` runs `git diff --cached --minimal`. In a dir
    --    that is not a git repo, git (2.54 / Apple Git-157) falls back to
    --    `--no-index` mode and rejects `--cached`, exiting 129. `Promise.system`
    --    rejects on non-zero exit and `chat_context.format_message` awaits it
    --    without a pcall, so the whole `send_message` rejects. Degrade to "no
    --    diff" instead of failing the send.
    -- 2. The input-window submit action calls `send_message` and discards its
    --    Promise, so a rejection is invisible: the input clears (auto_hide), the
    --    output window never updates, and no error is shown. Surface it here.
    config = function(_, opts)
      require("opencode").setup(opts)

      local base_context = require("opencode.context.base_context")
      local get_git_diff = base_context.get_git_diff
      base_context.get_git_diff = function(context_config)
        return get_git_diff(context_config):catch(function()
          return nil
        end)
      end

      local messaging = require("opencode.services.messaging")
      local send = messaging.send_message
      messaging.send_message = function(prompt, send_opts)
        return send(prompt, send_opts):catch(function(err)
          vim.notify("[opencode.nvim] send failed: " .. vim.inspect(err):sub(1, 500), vim.log.levels.ERROR)
        end)
      end
    end,
    opts = {
      preferred_picker = "snacks",
      default_mode = "plan",
      keymap = {
        session_picker = {
          rename_session = { "r", mode = "n", desc = "Rename selected session" },
          delete_session = { "x", mode = "n", desc = "Delete selected sessions" },
          new_session = { "n", mode = "n", desc = "Create a new session" },
          open_in_tab = { "t", mode = "n", desc = "Open in new panel tab" },
          fork_session = { "f", mode = "n", desc = "Fork selected session" },
          toggle_scope = { "s", mode = "n", desc = "Toggle project/global scope" },
        },
        session_tab_picker = {
          close_tab = { "x", mode = "n", desc = "Close selected panel tab" },
        },
        history_picker = {
          delete_entry = { "x", mode = "n", desc = "Delete selected history entries" },
        },
        editor = {
          ["<leader>og"] = { "toggle", desc = "Toggle Opencode" },
          ["<leader>oi"] = { "open_input", desc = "Open Input Window" },
          ["<leader>os"] = { "select_session", desc = "Session Management" },
          ["<leader>op"] = { "configure_provider", desc = "Configure Provider" },
          ["<leader>oz"] = { "toggle_zoom", desc = "Toggle Zoom" },
          ["<leader>om"] = { "switch_mode", desc = "Toggle Agent Mode" },
          ["<leader>or"] = { "toggle_reasoning_output", desc = "Toggle Reasoning" },

          -- diff group -> <leader>od
          ["<leader>odo"] = { "diff_open", desc = "Open Diff View" },
          ["<leader>odc"] = { "diff_close", desc = "Close Diff View" },
          ["<leader>od]"] = { "diff_next", desc = "Next Diff" },
          ["<leader>od["] = { "diff_prev", desc = "Previous Diff" },
          ["<leader>odr"] = { "diff_revert_this", desc = "Revert This Change" },
          ["<leader>odR"] = { "diff_revert_all", desc = "Revert All Changes" },
          ["<leader>odu"] = { "diff_restore_snapshot_file", desc = "Restore File Snapshot" },
          ["<leader>odU"] = { "diff_restore_snapshot_all", desc = "Restore All Snapshots" },

          -- everything else disabled: lean <leader>o menu
          ["<leader>oI"] = false,
          ["<leader>oN"] = false,
          ["<leader>o<"] = false,
          ["<leader>o>"] = false,
          ["<leader>o?"] = false,
          ["<leader>o1"] = false,
          ["<leader>o2"] = false,
          ["<leader>o3"] = false,
          ["<leader>o4"] = false,
          ["<leader>o5"] = false,
          ["<leader>o6"] = false,
          ["<leader>o7"] = false,
          ["<leader>o8"] = false,
          ["<leader>o9"] = false,
          ["<leader>oh"] = false,
          ["<leader>oo"] = false,
          ["<leader>ot"] = false,
          ["<leader>oT"] = false,
          ["<leader>oq"] = false,
          ["<leader>oQ"] = false,
          ["<leader>oS"] = false,
          ["<leader>oP"] = false,
          ["<leader>oB"] = false,
          ["<leader>oR"] = false,
          ["<leader>oV"] = false,
          ["<leader>oy"] = false,
          ["<leader>oY"] = false,
          ["<leader>ov"] = false,
          ["<leader>od"] = false, -- replaced by the od group
          ["<leader>o]"] = false,
          ["<leader>o["] = false,
          ["<leader>oc"] = false,
          ["<leader>ora"] = false,
          ["<leader>ort"] = false,
          ["<leader>orA"] = false,
          ["<leader>orT"] = false,
          ["<leader>orr"] = false,
          ["<leader>orR"] = false,
          ["<leader>ox"] = false,
          ["<leader>otr"] = false, -- reasoning display toggle (use /thinking or /reasoning)
          ["<leader>ott"] = false,
          ["<leader>otm"] = false,
          ["<leader>o/"] = false,
        },
        output_window = {
          ["<leader>oD"] = false,
          ["<leader>oO"] = false,
          ["<leader>ods"] = false,
          ["<leader>oS"] = false,
          ["<leader>oP"] = false,
          ["<leader>oB"] = false,
        },
        input_window = {
          ["<C-l>"] = { "switch_mode" },
          ["<leader>oS"] = false,
          ["<leader>oP"] = false,
          ["<leader>oB"] = false,
          ["<leader>oD"] = false,
          ["<leader>oO"] = false,
          ["<leader>ods"] = false,
        },
      },
      ui = {
        window_width = 0.30,
        -- `<leader>oz` widens the split to this fraction of the screen. 1.0
        -- makes zoom fill the whole width (the editor keeps a 1-col sliver).
        zoom_width = 1.0,
        input = {
          auto_hide = true,
        },
        completion = {
          file_sources = {
            preferred_cli_tool = "rg",
          },
        },
        output = {
          max_messages = 100,
          always_scroll_to_bottom = true,
          tools = {
            -- hide reasoning by default; toggle display with <leader>or or /reasoning
            show_reasoning_output = false,
          },
        },
      },
      context = {
        cursor_data = {
          enabled = true,
          context_lines = 5,
        },
        diagnostics = {
          only_closest = true,
        },
        git_diff = {
          enabled = true,
        },
        buffer = {
          enabled = true,
        },
      },
      -- Desktop alerts only. The v2 branch flushes pending renders itself when a
      -- request completes (session_runtime's user_message_count subscriber), so
      -- the old renderer/message workaround here is no longer needed.
      hooks = {
        on_done_thinking = function(completed_session)
          desktop_notify("OpenCode", session_name(completed_session) .. " finished")
        end,
        on_permission_requested = function(session)
          desktop_notify("OpenCode", session_name(session) .. " needs your approval")
        end,
        on_question_asked = function()
          desktop_notify("OpenCode", "needs your input")
        end,
      },
    },
  },
}
