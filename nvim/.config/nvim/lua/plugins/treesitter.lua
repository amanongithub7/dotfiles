return {
    {
      "nvim-treesitter/nvim-treesitter",
      build = ":TSUpdate",
      config = function()
        local config = require("nvim-treesitter.configs")
        config.setup({
          auto_install = false,
          ensure_installed = {
            "bash",
            "ruby",
            "html",
            "css",
            "scss",
            "javascript",
            "typescript",
            "json",
            "lua",
            "go",
            "yaml",
            "markdown",
            "markdown_inline",
            "vim",
            "gitcommit",
            "git_rebase",
            "gitignore",
            "dockerfile",
            "regex",
            "sql",
            "toml",
          },
          highlight = { enable = true },
          indent = { enable = false },
        })
      end
    }
  }
