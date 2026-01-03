vim.lsp.config("ruff", {
  init_options = {
    settings = {
      lint = {
        enable = true,
        preview = true,

        -- --------------------------- Rules Customization --------------------------- --
        -- By default, Ruff enables Flake8's F rules, along with a subset of the E rules,
        -- omitting any stylistic rules that overlap with the use of a formatter, like
        -- ruff format or Black.
        -- NOTE: in case of overlap ignore (rules) takes precedence over select (rules)
        ignore = {
          -- for list of rules:
          -- https://docs.astral.sh/ruff/rules/#pydocstyle-d
          -- covered by basedpyright
          "F401", -- unused imports
          "F841", -- unused variables
        },
        select = {
          -- for list of rules:
          -- https://docs.astral.sh/ruff/rules/#pydocstyle-d
        },
      },
      lineLength = 100,
      organizeImports = false,
      showSyntaxErrors = false,
    },
  },
})
