-- bootstrap lazy.nvim, LazyVim and your plugins
require("config.lazy")
require("lazy").setup({
  root = "~/.config/nvim/lazy.nvim",
  plugins = { "nvim-lua/plenary.nvim" },
})

-- personal configuration settings
vim.opt.number = true
