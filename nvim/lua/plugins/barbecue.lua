return {
  {
    "utilyre/barbecue.nvim",
    name = "barbecue",
    version = "*",
    event = "LazyFile",
    dependencies = {
      "SmiteshP/nvim-navic",
      "nvim-tree/nvim-web-devicons",
    },
    opts = {},
  },
  {
    "nvim-lualine/lualine.nvim",
    opts = function(_, opts)
      opts.sections.lualine_c = {}
    end,
  },
}
