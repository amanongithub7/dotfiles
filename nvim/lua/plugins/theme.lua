return {
  {
    "f-person/auto-dark-mode.nvim",
  },
  {
    "folke/tokyonight.nvim",
    enabled = false,
  },
  {
    "scottmckendry/cyberdream.nvim",
    lazy = false,
    priority = 1000,
    opts = {
      variant = "auto",
      transparent = true,
      -- cyberdream's grey (#7b8496) washes out on the translucent ghostty
      -- window in light mode: it paints markdown ordered-list numbers
      -- (RenderMarkdownBullet), quote markers (RenderMarkdownQuote1-6) and
      -- text (@markup.quote), hrules (Dash) and table rows/head. Re-anchor
      -- those greys on the same-hue blue-grey darkened to ~5:1 contrast
      -- against white (#5f6777). Dark variants are untouched.
      overrides = function(colors)
        if vim.o.background ~= "light" then
          return {}
        end
        local grey = "#5f6777"
        -- blend(grey, bg, w) = w towards the background; mirrors cyberdream's
        -- "deeper quote nesting fades out" gradient but anchored on the
        -- visible grey (upstream fades from 0.9 and step 0.1)
        local fade = function(w)
          return require("cyberdream.util").blend(grey, colors.bg_solid, w)
        end
        return {
          RenderMarkdownBullet = { fg = grey },
          RenderMarkdownQuote = { fg = grey },
          ["@markup.quote"] = { fg = grey }, -- quote text, links Comment otherwise
          RenderMarkdownQuote1 = { fg = grey },
          RenderMarkdownQuote2 = { fg = fade(0.9) },
          RenderMarkdownQuote3 = { fg = fade(0.8) },
          RenderMarkdownQuote4 = { fg = fade(0.7) },
          RenderMarkdownQuote5 = { fg = fade(0.6) },
          RenderMarkdownQuote6 = { fg = fade(0.5) },
          RenderMarkdownDash = { fg = grey },
          RenderMarkdownTableHead = { fg = grey },
          RenderMarkdownTableRow = { fg = fade(0.7) },
        }
      end,
    },
  },
  {
    "catppuccin/nvim",
    name = "catppuccin",
    lazy = true,
    config = function()
      require("catppuccin").setup({
        auto_integrations = true,
        -- use latte for light mode and mocha for dark mode ^_^
        background = {
          light = "latte",
          dark = "mocha",
        },
      })
    end,
  },
}
