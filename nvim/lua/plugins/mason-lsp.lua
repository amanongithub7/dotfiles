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
        -- nested dependencies are supported by lazyvim
        -- users can also define a separate table entry for a dependency and it's dependencies...
        -- ... and the configurations will be merged by lazyvim when it builds its dependency tree
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
      -- and set up with their default configurations unless provided
      ensure_installed = {
        "basedpyright", -- Python
        "lua_ls", -- Lua
        "texlab", -- LaTeX
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
      -- ensure that the following non-lsp tools such as formatters and litners are installed
      -- NOTE: mason-tool-installer doesn't set these up to work with LSPs or Neovim buffers
      ensure_installed = {
        "black", -- Python formatter
        "isort", -- sorts and groups Python imports alphabetically
        "ruff", -- ultra-fast Python linter and formatter
        "stylua", -- Lua formatter
        "shfmt", -- shell script formatter
        "shellcheck", -- static analysis shell linter
      },
    },
  },
}
