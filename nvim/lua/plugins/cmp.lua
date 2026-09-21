return {
  {
    "jmbuhr/otter.nvim",
    dev = false,
    dependencies = {
      {
        "neovim/nvim-lspconfig",
        "nvim-treesitter/nvim-treesitter",
      },
    },
    opts = {},
  },
  {
    "saghen/blink.compat",
    opts = {},
  },
  {
    "saghen/blink.cmp",
    dependencies = {
      "hrsh7th/nvim-cmp",
      "rafamadriz/friendly-snippets",
      "obsidian-nvim/obsidian.nvim",
      "saghen/blink.compat",
      "jmbuhr/otter.nvim",
    },
    version = "1.*",
    opts = {
      snippets = { preset = "mini_snippets" },
      keymap = { preset = "default" },
      appearance = {
        nerd_font_variant = "mono",
        use_nvim_cmp_as_default = true,
      },
      completion = {
        documentation = { auto_show = true },
        menu = {
          border = "rounded",
          draw = {
            columns = { { "kind_icon", gap = 1 }, { "label", "label_description", gap = 1 }, { "kind" } },
            components = {
              kind_icon = {
                text = function(ctx)
                  local kind_icon, _, _ = require("mini.icons").get("lsp", ctx.kind)
                  return kind_icon
                end,
                highlight = function(ctx)
                  local _, hl, _ = require("mini.icons").get("lsp", ctx.kind)
                  return hl
                end,
              },
              kind = {
                highlight = function(ctx)
                  local _, hl, _ = require("mini.icons").get("lsp", ctx.kind)
                  return hl
                end,
              },
            },
          },
        },
        ghost_text = {
          enabled = true,
        },
      },
      sources = {
        default = { "lsp", "path", "snippets", "buffer" },
        per_filetype = {
          codecompanion = { "codecompanion" },
          markdown = { "lsp", "path", "snippets", "buffer", "obsidian" },
        },
        providers = {
          obsidian = {
            name = "obsidian",
            module = "blink.compat.source",
            score_offset = 100,
          },
        },
      },
      signature = { enabled = true },
      fuzzy = { implementation = "prefer_rust_with_warning" },
    },
    opts_extend = { "sources.default" },
  },
}
