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
      -- cyberdream ships FloatBorder as fg = bg_highlight (#3c4048 dark,
      -- #acacac light) with an opaque bg, i.e. ~1.6:1 against the float
      -- background: on the translucent ghostty window every float looks
      -- borderless even though the window does have a border. Re-anchor all
      -- float borders on a visible grey, background-free so the rounded corners
      -- stay translucent. Snacks' picker/notifier windows map FloatBorder onto
      -- their own groups via winhl, so those are pinned here too (the theme
      -- never defined them, so they silently inherited the dim default).
      overrides = function(colors)
        local util = require("cyberdream.util")
        local light = vim.o.background == "light"
        -- blend(a, b, w) is a at weight w and b at (1 - w). 0.7/0.8 of the
        -- theme grey lands around 3:1 against the float background in both
        -- variants: visible, without turning into a bright frame.
        local bg = colors.bg_solid or colors.bg
        local border = util.blend(colors.grey, bg, light and 0.8 or 0.7)
        local float = { fg = border, bg = "NONE" }
        local overrides = {
          FloatBorder = float,
          SnacksPickerBorder = float,
          SnacksPickerInputBorder = float,
          SnacksPickerListBorder = float,
          SnacksPickerPreviewBorder = float,
          SnacksPickerBoxBorder = float,
          SnacksNotifierBorderDebug = { fg = border },
          SnacksNotifierBorderInfo = { fg = border },
          SnacksNotifierBorderWarn = { fg = border },
          SnacksNotifierBorderError = { fg = border },
          SnacksNotifierBorderTrace = { fg = border },
        }
        if not light then
          return overrides
        end
        -- cyberdream's grey (#7b8496) washes out on the translucent ghostty
        -- window in light mode: it paints markdown ordered-list numbers
        -- (RenderMarkdownBullet), quote markers (RenderMarkdownQuote1-6) and
        -- text (@markup.quote), hrules (Dash) and table rows/head. Re-anchor
        -- those greys on the same-hue blue-grey darkened to ~5:1 contrast
        -- against white (#5f6777).
        local grey = "#5f6777"
        -- deeper quote nesting fades toward the background: w is the weight of
        -- the grey, so 0.9 is the brightest step (upstream fades 0.9 -> 0.5)
        local fade = function(w)
          return util.blend(grey, colors.bg_solid, w)
        end
        return vim.tbl_extend("force", overrides, {
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
        })
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
