vim.lsp.config("basedpyright", {
  settings = {
    basedpyright = {
      analysis = {
        typeCheckingMode = "standard",
        useLibraryCodeForTypes = true,
        inlayHints = {
          genericTypes = true,
        },
        pythonPath = os.getenv("CONDA_PREFIX") and (os.getenv("CONDA_PREFIX") .. "/bin/python") or "python",
        autoSearchPaths = true,
      },
      disableOrganizeImports = true, -- Ruff does it better
    },
  },
})
