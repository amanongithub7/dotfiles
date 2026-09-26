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
    opts = {
      preferred_picker = "snacks",
      keymap = {
        session_picker = {
          delete_session = { "<C-x>", mode = { "i", "n" }, desc = "Delete selected sessions" },
          new_session = { "<C-e>", mode = { "i", "n" }, desc = "Create a new session" },
          open_in_tab = { "<C-y>", mode = { "i", "n" }, desc = "Open in new panel tab" },
          fork_session = { "<C-o>", mode = { "i", "n" }, desc = "Fork selected session" },
          toggle_scope = { "<C-z>", mode = { "i", "n" }, desc = "Toggle project/global scope" },
        },
        session_tab_picker = {
          close_tab = { "<C-x>", mode = { "i", "n" }, desc = "Close selected panel tab" },
        },
        history_picker = {
          delete_entry = { "<C-x>", mode = { "i", "n" }, desc = "Delete selected history entries" },
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
        output = {
          tools = {
            -- hide reasoning by default; toggle display with <leader>or or /reasoning
            show_reasoning_output = false,
          },
        },
      },
    },
  },
}
