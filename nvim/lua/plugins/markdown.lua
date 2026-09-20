return {
  { -- provides editing features for tables and lists especially
    "yousefhadder/markdown-plus.nvim",
    ft = "markdown",
    opts = {},
  },
  {
    "iamcco/markdown-preview.nvim",
    cmd = { "MarkdownPreviewToggle", "MarkdownPreview", "MarkdownPreviewStop" },
    build = "cd app && yarn install",
    init = function()
      vim.g.mkdp_filetypes = { "markdown" }
    end,
    ft = { "markdown" },
  },
  { -- plugin that provides rendering, linking and other Obsidian-related functionality
    "obsidian-nvim/obsidian.nvim",
    version = "*", -- recommended, use latest release instead of latest commit
    ft = "markdown",
    dependencies = {
      -- Required
      "nvim-lua/plenary.nvim",
      -- Optional
      {
        "saghen/blink.cmp", -- completion
        config = function()
          require("blink.cmp").setup({
            per_filetype = {
              markdown = {
                "lsp",
              },
            },
          })
        end,
      },
      "nvim-treesitter/nvim-treesitter", -- syntax highlighting
      "folke/snacks.nvim", -- snacks.image needed for image previews
    },
    ---@module 'obsidian'
    ---@type obsidian.config
    opts = {
      legacy_commands = false,
      ---@diagnostic disable: missing-fields
      ui = { enable = false },
      ---@diagnostic enable: missing-fields
      workspaces = {
        {
          name = "personal",
          path = "~/vaults/personal",
        },
        {
          name = "climate-crisis",
          path = "~/vaults/climate-crisis",
        },
        {
          name = "tech-stack",
          path = "~/vaults/tech-stack",
        },
      },
    },
  },
  {
    "MeanderingProgrammer/render-markdown.nvim",
    dependencies = { "nvim-treesitter/nvim-treesitter", "nvim-mini/mini.icons" },
    ft = { "markdown", "codecompanion", "quarto", "opencode_output" },
    ---@module 'render-markdown'
    ---@type render.md.UserConfig
    opts = {
      anti_conceal = { enabled = false },
      file_types = { "markdown", "codecompanion", "quarto", "opencode_output" },
      completions = { lsp = { enabled = false } },
      code = {
        border = "thick",
        conceal_delimiters = false,
      },
    },
  },
  { -- table of contents generator
    "hedyhli/markdown-toc.nvim",
    ft = "markdown", -- Lazy load on markdown filetype
    cmd = { "Mtoc" }, -- Or, lazy load on "Mtoc" command
    opts = {
      -- Your configuration here (optional)
    },
  },
  {
    "hedyhli/outline.nvim",
    config = function()
      -- Example mapping to toggle outline
      vim.keymap.set("n", "<leader>co", "<cmd>Outline<CR>", { desc = "Toggle Outline" })

      require("outline").setup({
        providers = {
          priority = { "markdown", "lsp" },
        },
        outline_window = {
          center_on_jump = false,
        },
        outline_items = {
          show_symbol_details = false,
          auto_update_events = {
            follow = { "CursorMoved" },
            items = { "InsertLeave", "BufWritePost" },
          },
        },
      })
    end,
  },
  { -- modify tables, move rows and columns, etc with keyboard shortcuts
    "SCJangra/table-nvim",
    ft = "markdown",
    opts = {},
  },
}
