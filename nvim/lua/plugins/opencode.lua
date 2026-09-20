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
      keymap = {
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
