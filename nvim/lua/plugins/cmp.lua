return {
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
        use_nvim_cmp_as_default = true,
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
      },
      signature = { enabled = true },
      fuzzy = { implementation = "prefer_rust_with_warning" },
    },
    opts_extend = { "sources.default" },
  },
}
