-- LANG_SERVERS stores this Neovim configuration's list of LSPs for different programming languages.
-- The LSPs are enabled in nvim-lspconfig's `config` method below, and use nvim-lspconfig's specified
-- settings unless additional settings are provided locally (for example, through a `lsp/*.lua` file).
LANG_SERVERS = {
  "basedpyright", -- Python
  "lua_ls", -- Lua
  "texlab", -- LaTeX
}

-- LANG_TOOLS contains the linters/formatters/debuggers to specify to mason-tool-installer
-- for Neovim startup installation (by Mason).
LANG_TOOLS = {
  "black", -- Python formatter
  "isort", -- sorts and groups Python imports alphabetically
  "ruff", -- ultra-fast Python linter and formatter
  "stylua", -- Lua formatter
  "shfmt", -- shell script formatter
  "shellcheck", -- static analysis shell linter
}

return {
  {
    --[[                    mason-lspconfig
      mason-lspconfig is used in Neovim v0.11+ to ensure that specified LSPs are installed by Mason
      on Neovim startup.
    --]]
    "mason-org/mason-lspconfig.nvim",
    dependencies = {
      {
        --[[                     Mason
          mason is a tiny package manager for LSPs, linters, DAP, etc.
          It installs tools in ~/.local/share/nvim/mason/ for use in NeoVim,
          which is preferable over scattered brew/npm/pip installs.
        --]]
        "mason-org/mason.nvim",
        opts = {
          ui = {
            icons = {
              package_installed = "✓",
              package_pending = "➜",
              package_uninstalled = "✗",
            },
          },
          max_concurrent_installers = 4,
        },
      },
      -- nvim-lspconfig is configured in its own table below
      "neovim/nvim-lspconfig",
    },
    config = function()
      -- ensure that the following language servers are installed at neovim startup
      require("mason-lspconfig").setup({
        ensure_installed = LANG_SERVERS,
      })
    end,
  },
  --[[                    mason-tool-installer
    mason-tool-installer provides functionality for non-lsp tooling.
    It can be used to ensure that specific linters, formatters, daps, etc.
    are installed on the machine.
  --]]
  {
    "WhoIsSethDaniel/mason-tool-installer.nvim",
    dependencies = {
      "mason-org/mason.nvim",
    },
    opts = {
      -- ensure that the following non-lsp tools such as formatters and linters are installed
      -- NOTE: mason-tool-installer doesn't set these up: that is done manually or by plugins like none-ls
      ensure_installed = LANG_TOOLS,
    },
  },
  {
    "neovim/nvim-lspconfig",
    dependencies = {
      -- lazydev configures lua_ls for editing Neovim configs by lazily updating workspace libraries.
      {
        "folke/lazydev.nvim",
        ft = "lua", -- only load for lua files
      },
      -- fidget provides UI cues such as progress spinners to indicate status of LSPs.
      { "j-hui/fidget.nvim", opts = {} },
      "saghen/blink.cmp",
    },
    config = function()
      for _, lsp in ipairs(LANG_SERVERS) do
        -- auto-start lsp when a relevant buffer is opened with its default configuration from nvim-lspconfig
        -- NOTE: As of Neovim v0.11, `vim.lsp.enable` automatically find's nvim-lspconfig's configuration for
        -- the lsp, and merges it with any local lsp/*.lua config defined by a user or a plugin.
        -- Sharing a completion plugin's capabilities is no longer necessary.
        vim.lsp.enable(lsp)
      end
    end,
  },
}
