return {
  {
    "f-person/auto-dark-mode.nvim",
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
    lazy = "false",
    name = "catppuccin",
    priority = 1000,
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
