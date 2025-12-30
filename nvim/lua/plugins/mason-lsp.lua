return {
  {
    --[[                    mason-lspconfig
      mason-lspconfig is a bridge between Mason and nvim-lspconfig.
      It sets up installed servers if no explicit setup() is provided, and 
      it translates server names between mason and nvim-lspconfig.
      Ex. lua-language-server (mason) <-> lua_ls (nvim-lspconfig)

      It requires mason and nvim-lspconfig to be set up before itself.
    --]]
    "mason-org/mason-lspconfig.nvim",
    dependencies = {
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
      {
        "nvim-lspconfig",
        dependencies = {
          -- lazydev configures lua_ls for editing Neovim configs by lazily updating workspace libraries.
          {
            "folke/lazydev.nvim",
            ft = "lua", -- only load for lua files
          },
          -- fidget provides UI cues such as progress spinners to indicate status of LSPs.
          { "j-hui/fidget.nvim", opts = {} },
        },
      },
    },
    -- mason-lspconfig opts
    opts = {
      -- ensure that the following language servers are installed at neovim startup
      ensure_installed = {
        "basedpyright",
        "gopls",
        "lua_ls",
        "texlab",
      },
    },
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
      ensure_installed = {
        "black",
        "delve",
        "eslint_d",
        "gofumpt",
        "isort",
        "prettier",
        "ruff",
        "stylua",
        "shfmt",
        "shellcheck",
      },
    },
  },
}
