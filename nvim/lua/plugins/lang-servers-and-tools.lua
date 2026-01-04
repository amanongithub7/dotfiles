-- LANG_SERVERS stores this Neovim configuration's list of LSPs for different programming languages.
-- The LSPs are enabled in nvim-lspconfig's `config` method below, and use nvim-lspconfig's specified
-- settings unless additional settings are provided locally (for example, through a `lsp/*.lua` file).
LANG_SERVERS = {
  -- LaTeX
  "texlab",

  -- Lua
  "lua_ls",

  -- Python
  "basedpyright", -- lsp for auto-complete, code suggestions & error (eg. syntax) checking
  "ruff", -- linter and formatter
}

-- LANG_TOOLS contains the linters/formatters/debuggers to specify to mason-tool-installer
-- for Neovim startup installation (by Mason).
LANG_TOOLS = {
  -- Lua
  "stylua", -- formatter

  -- Markdown
  "prettier",

  -- Python
  "debugpy", -- debugging tool

  -- Shell Scipting
  "shellcheck", -- static analysis & linter
  "shfmt", -- formatter
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
  {
    --[[                    mason-tool-installer
      mason-tool-installer provides functionality for non-lsp tooling.
      It can be used to ensure that specific linters, formatters, daps, etc.
      are installed on the machine.
    --]]
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
    --[[
      nvim-lspconfig stores default configurations for several commonly-used LSPs.
      Importin nvim-lspconfig and running vim.lsp.enable for a specific LSP automatically configures 
      that LSP with the settings specified by nvim-lspconfig.
      Additional settings/overrides can be made by creating local lsp/*.lua files.
    --]]
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
  {
    "nvimtools/none-ls.nvim",
    dependencies = {
      "mason.nvim",
      "mason-tool-installer.nvim",
      "nvimtools/none-ls-extras.nvim",
    },
    config = function()
      local null_ls = require("null-ls")

      local sources = {
        -- Markdown
        null_ls.builtins.formatting.prettier.with({
          filetypes = { "markdown" }, -- limit to markdown
          extra_args = { "--prose-wrap", "always" }, -- optional tweaks
        }),
        -- Python
        require("none-ls.formatting.ruff").with({ extra_args = { "--extend-select", "I" } }),
        require("none-ls.formatting.ruff_format"),
      }

      local augroup = vim.api.nvim_create_augroup("LspFormatting", {})

      null_ls.setup({
        sources = sources,
        on_attach = function(client, bufnr)
          if client.supports_method("textDocument/formatting") then
            vim.api.nvim_clear_autocmds({ group = augroup, buffer = bufnr })
            vim.api.nvim_create_autocmd("BufWritePre", {
              group = augroup,
              buffer = bufnr,
              callback = function()
                vim.lsp.buf.format({ async = false })
              end,
            })
          end
        end,
      })
    end,
  },
}
