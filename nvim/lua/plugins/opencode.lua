-- macOS desktop alerts for OpenCode completion/permission events. Only fires
-- while the nvim UI is unfocused. Ghostty understands OSC 777 notifications but
-- suppresses them while its window is focused, so: if Ghostty is frontmost
-- (e.g. you switched tmux sessions in the same window) fall back to an osascript
-- system notification, which shows regardless of focus; otherwise emit the
-- native OSC banner. When running inside tmux the OSC is wrapped in a
-- passthrough sequence (needs `allow-passthrough`).
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

local function desktop_notify(title, body)
  if focused then
    return
  end
  body = body:gsub("[%c]", " ")
  vim.schedule(function()
    vim.system({ "lsappinfo", "front" }, { text = true }, function(front)
      local asn = front.code == 0 and vim.trim(front.stdout or "") or ""
      if asn == "" then
        return emit_osc(title, body)
      end
      vim.system({ "lsappinfo", "info", "-only", "name", asn }, { text = true }, function(info)
        local name = (info.stdout or ""):match('^"([^"]+)"')
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
          ["<leader>o1"] = false, ["<leader>o2"] = false, ["<leader>o3"] = false,
          ["<leader>o4"] = false, ["<leader>o5"] = false, ["<leader>o6"] = false,
          ["<leader>o7"] = false, ["<leader>o8"] = false, ["<leader>o9"] = false,
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
      -- Safety net for the final turn occasionally not appearing until the
      -- next prompt. On idle: flush any pending render, and if the finished
      -- turn is genuinely absent from state, do a full refresh (which is what
      -- sending the next prompt was effectively doing).
      hooks = {
        on_done_thinking = function(completed_session)
          desktop_notify("OpenCode", session_name(completed_session) .. " finished")
          vim.defer_fn(function()
            local state = require("opencode.state")
            local active = state.active_session
            if not active or (completed_session and completed_session.id ~= active.id) then
              return
            end

            require("opencode.ui.renderer.flush").resume_deferred_rendering()

            local messages = state.messages or {}
            local last_user = 0
            for i, m in ipairs(messages) do
              if m.info and m.info.role == "user" then
                last_user = i
              end
            end
            local has_reply = false
            for i = last_user + 1, #messages do
              if messages[i].info and messages[i].info.role == "assistant" then
                has_reply = true
                break
              end
            end

            local renderer = require("opencode.ui.renderer")
            if not has_reply then
              renderer.render_full_session():and_then(function()
                renderer.scroll_to_bottom(true)
              end)
            else
              renderer.scroll_to_bottom(true)
            end
          end, 30)
        end,
        on_permission_requested = function(session)
          desktop_notify("OpenCode", session_name(session) .. " needs your approval")
        end,
      },
    },
  },
}
