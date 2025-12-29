return {
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

      --[[                     Mason
        mason is a tiny package manager for LSPs, linters, DAP, etc.
        It installs tools in ~/.local/share/nvim/mason/ for use in NeoVim,
        which is preferable over scattered brew/npm/pip installs.
      --]]
      {
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
      --[[                    mason-lspconfig
        mason-lspconfig is a bridge between Mason and nvim-lspconfig.
        It sets up installed servers if no explicit setup() is provided.
        It also translates server names between mason and nvim-lspconfig.
        Ex. lua_ls <-> lua-language-server
      --]]
      {
        "mason-org/mason-lspconfig.nvim",
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

      -- Install blink.cmp, our auto-completion plugin, before nvim-lspconfig so that
      -- we can give LSPs a full picture of the capabilities of our Neovim setup.
      "saghen/blink.cmp",
    },
    config = function(_, opts)
      local blink = require("blink.cmp")
      local capabilities = blink.get_lsp_capabilities()
      local lspconfig = require("lspconfig")

      -- Merge with existing capabilities if present
      opts.capabilities = vim.tbl_deep_extend("force", opts.capabilities or {}, capabilities)

      -- Go language server setup
      lspconfig.gopls.setup({
        capabilities = opts.capabilities,
      })

      -- Lua language server setup
      lspconfig.lua_ls.setup({
        capabilities = opts.capabilities,
      })

      -- Python language server setup
      lspconfig.basedpyright.setup({
        capabilities = opts.capabilities,
        filetypes = { "python" },
      })

      vim.diagnostic.config({
        virtual_text = {
          prefix = function(diagnostic)
            local icons = {
              [vim.diagnostic.severity.ERROR] = "", -- Error
              [vim.diagnostic.severity.WARN] = "", -- Warning
              [vim.diagnostic.severity.INFO] = "", -- Info
              [vim.diagnostic.severity.HINT] = "", -- Hint
            }
            return icons[diagnostic.severity] or "●"
          end,
          spacing = 4,
          severity = nil,
        },
        signs = true,
        underline = true,
        update_in_insert = false,
        severity_sort = true,
      })

      vim.keymap.set("n", "gd", vim.lsp.buf.definition, {})
      vim.keymap.set({ "n", "v" }, "<space>ca", vim.lsp.buf.code_action, { desc = "Code Action" })
    end,
  },
}
