return {
  {
    "hrsh7th/nvim-cmp",
    lazy = false,
  },
  {
    "saghen/blink.cmp",
    dependencies = {
      "hrsh7th/nvim-cmp",
      "rafamadriz/friendly-snippets",
    },
    version = "1.*",
    opts = {
      keymap = { preset = "default" },
      appearance = {
        nerd_font_variant = "mono",
      },
      completion = {
        documentation = { auto_show = true },
        menu = {
          border = "rounded",
        },
        ghost_text = {
          enabled = true,
        },
      },
      sources = {
        default = { "lsp", "path", "snippets", "buffer", "dadbod" },
        providers = {
          lsp = {
            name = "lsp",
            enabled = true,
            module = "blink.cmp.sources.lsp",
            kind = "LSP",
            score_offset = 1000,
          },
          dadbod = {
            name = "Dadbod",
            enabled = true,
            module = "vim_dadbod_completion.blink",
            score_offset = 950,
          },
          snippets = {
            name = "snippets",
            enabled = true,
            module = "blink.cmp.sources.snippets",
            score_offset = 800,
            max_items = 3,
          },
        },
      },
      signature = { enabled = true },
      fuzzy = { implementation = "prefer_rust_with_warning" },
    },
    opts_extend = { "sources.default" },
  },
}
