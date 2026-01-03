vim.lsp.config("basedpyright", {
  settings = {
    basedpyright = {
      analysis = {
        inlayHints = {
          genericTypes = true,
        },
      },
      disableOrganizeImports = true, -- Ruff does it better
    },
  },
})
