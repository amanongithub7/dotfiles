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
    ft = { "markdown", "codecompanion", "quarto" },
    ---@module 'render-markdown'
    ---@type render.md.UserConfig
    opts = {},
    config = function()
      require("render-markdown").setup({
        completions = { lsp = { enabled = true } },
        anti_conceal = {
          enabled = true,
          above = 5,
          below = 5,
        },
        code = {
          border = "thick",
          conceal_delimiters = false,
        },
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
  { -- follow links within md files using <CR>
    "jghauser/follow-md-links.nvim",
    config = function()
      vim.keymap.set("n", "<bs>", ":edit #<cr>", { silent = true })
    end,
  },
}
