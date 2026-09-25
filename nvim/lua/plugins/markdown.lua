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
      vim.fn["mkdp#util#install"]()
    init = function()
      vim.g.mkdp_filetypes = { "markdown" }
    end,
  },
  {                -- plugin that provides rendering, linking and other Obsidian-related functionality
    "obsidian-nvim/obsidian.nvim",
    version = "*", -- recommended, use latest release instead of latest commit
    ft = "markdown",
    dependencies = {
      -- Required
      "nvim-lua/plenary.nvim",
      -- Optional
      "saghen/blink.cmp",                -- completion
      "nvim-treesitter/nvim-treesitter", -- syntax highlighting
      "folke/snacks.nvim",               -- snacks.image needed for image previews
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
      },
    },
  },
  {
    "MeanderingProgrammer/render-markdown.nvim",
    dependencies = { "nvim-treesitter/nvim-treesitter", "nvim-mini/mini.icons" },
    ft = { "markdown", "quarto", "opencode_output" },
    ---@module 'render-markdown'
    ---@type render.md.UserConfig
    opts = {
      anti_conceal = { enabled = false },
      file_types = { "markdown", "quarto", "opencode_output" },
      completions = { lsp = { enabled = false } },
      code = {
        border = "none",
        conceal_delimiters = false,
      },
    },
  },
  {                   -- table of contents generator
    "hedyhli/markdown-toc.nvim",
    ft = "markdown",  -- Lazy load on markdown filetype
    cmd = { "Mtoc" }, -- Or, lazy load on "Mtoc" command
    opts = {
      -- Your configuration here (optional)
    },
  },
}
