return {
  {
    "jmbuhr/otter.nvim",
    dev = false,
    lazy = true, -- only needed for quarto/notebook LSP features
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
    lazy = true, -- loaded with blink.cmp
    opts = {},
  },
  {
    "saghen/blink.cmp",
    event = { "InsertEnter", "CmdlineEnter" },
    dependencies = {
      "hrsh7th/nvim-cmp",
      "rafamadriz/friendly-snippets",
      -- obsidian is only needed as a completion source in markdown, where it
      -- loads via its own ft=markdown spec; do not force-load it at startup.
      "saghen/blink.compat",
      "jmbuhr/otter.nvim",
      {
        "krissen/blink-cmp-bibtex",
        opts = {
          global_files = {
            vim.fn.expand("~/climate-crisis/research-papers/organization-tools/zotero/exports/library.bib"),
          },
          preview_style = "apa",
        },
        config = function(_, opts)
          require("blink-cmp-bibtex").setup(opts)
        end,
      },
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
        default = { "lsp", "path", "snippets", "buffer", "bibtex" },
        per_filetype = {
          markdown = { "lsp", "path", "snippets", "buffer", "obsidian" },
        },
        providers = {
          obsidian = {
            name = "obsidian",
            module = "blink.compat.source",
            score_offset = 100,
          },
          bibtex = {
            module = "blink-cmp-bibtex",
            name = "BibTeX",
            min_keyword_length = 2,
            score_offset = 10,
            async = true,
          },
        },
      },
      signature = { enabled = true },
      fuzzy = { implementation = "prefer_rust_with_warning" },
    },
    opts_extend = { "sources.default" },
  },
}
