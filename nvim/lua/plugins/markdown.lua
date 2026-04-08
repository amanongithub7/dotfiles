return {
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
      "saghen/blink.cmp", -- completion
      "nvim-telescope/telescope.nvim", -- pickers
      "nvim-treesitter/nvim-treesitter", -- syntax highlighting
      "folke/snacks.nvim", -- snacks.image needed for image previews
    },
    ---@module 'obsidian'
    ---@type obsidian.config
    opts = {
      legacy_commands = false,
      ui = { enable = false },
      workspaces = {
        {
          name = "personal",
          path = "~/vaults/personal",
        },
        {
          name = "education-initiative",
          path = "~/vaults/education-initiative",
        },
      },
    },
  },
  {
    "MeanderingProgrammer/render-markdown.nvim",
    dependencies = { "nvim-treesitter/nvim-treesitter", "nvim-mini/mini.icons" },
    ft = { "markdown", "codecompanion", "quarto" },
    ---@module 'render-markdown'
    ---@type render.md.UserConfig
    opts = {},
    config = function()
      require("render-markdown").setup({
        completions = { lsp = { enabled = true } },
      })
    end,
  },
  { -- table of contents generator
    "hedyhli/markdown-toc.nvim",
    ft = "markdown", -- Lazy load on markdown filetype
    cmd = { "Mtoc" }, -- Or, lazy load on "Mtoc" command
    opts = {
      -- Your configuration here (optional)
    },
  },
}
