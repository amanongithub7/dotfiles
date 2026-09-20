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
          ["<leader>om"] = { "switch_mode" },
        },
        input_window = {
          ["<C-l>"] = { "switch_mode" },
        },
      },
      ui = {
        window_width = 0.30,
      },
    },
  },
}
