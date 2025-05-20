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
            "zirenbaum/copilot.lua",
            "fang2hou/blink-copilot",
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
                default = { "lsp", "path", "snippets", "buffer", "copilot", "dadbod" },
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
                        score_offset = 900,
                        max_items = 5,
                    },
                    -- relegation zone
                    copilot = {
                        name = "copilot",
                        enabled = true,
                        module = "blink-copilot",
                        kind = "Copilot",
                        score_offset = -100,
                        async = true,
                        opts = {
                            max_completions = 3,
                        },
                    },
                },
            },
            signature = { enabled = true },
            fuzzy = { implementation = "prefer_rust_with_warning" },
        },
        opts_extend = { "sources.default" },
    },
}
