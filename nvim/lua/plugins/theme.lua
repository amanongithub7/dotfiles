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
