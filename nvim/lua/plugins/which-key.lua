-- ui overlay for keymaps
return {
  "folke/which-key.nvim",
  event = "VeryLazy",
  opts = {
    preset = "modern", -- this preset also sets a rounded border
    -- Explicit so the menu keeps a rounded border if the preset changes. The
    -- border colour comes from FloatBorder (see lua/plugins/theme.lua).
    win = { border = "rounded" },
  },
  keys = {
    {
      "<leader>?",
      function()
        require("which-key").show({ global = false })
      end,
      desc = "Buffer Local Keymaps",
    },
  },
}
