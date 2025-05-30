return {
  {
    "mason-org/mason.nvim",
    dependencies = {
      "WhoIsSethDaniel/mason-tool-installer.nvim",
    },
    config = function()
      local mason = require("mason")
      local mason_tool_installer = require("mason-tool-installer")

      mason.setup({
        ui = {
          icons = {
            package_installed = "✓",
            package_pending = "➜",
            package_uninstalled = "✗",
          },
        },
        max_concurrent_installers = 4,
      })

      mason_tool_installer.setup({
        ensure_installed = {
          "stylua",
          "shfmt",
          "shellcheck",
          "prettier",
          "eslint_d",
          "black",
          "ruff",
          "isort",
          "gofumpt",
          "gopls",
          "delve",
        },
      })
    end,
  },
  {
    "mason-org/mason-lspconfig.nvim",
    dependencies = { "mason-org/mason.nvim" },
    config = function()
      require("mason-lspconfig").setup({
        ensure_installed = { "gopls", "lua_ls" },
      })
    end,
  },
  {
    "neovim/nvim-lspconfig",
    dependencies = {
      "saghen/blink.cmp",
      {
        "folke/lazydev.nvim",
        ft = "lua", -- only load for lua files
      },
    },
    config = function(_, opts)
      -- Get blink.cmp capabilities
      local blink = require("blink.cmp")
      local capabilities = blink.get_lsp_capabilities()
      local lspconfig = require("lspconfig")

      -- Merge with existing capabilities if present
      opts.capabilities = vim.tbl_deep_extend("force", opts.capabilities or {}, capabilities)

      require("mason").setup()

      -- Go language server setup
      lspconfig.gopls.setup({
        capabilities = opts.capabilities,
      })

      -- Lua language server setup
      lspconfig.lua_ls.setup({
        capabilities = opts.capabilities,
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
