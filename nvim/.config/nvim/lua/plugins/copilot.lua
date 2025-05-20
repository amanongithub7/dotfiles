return {
  {
    "zbirenbaum/copilot.lua",
    version = "*",
    event = "InsertEnter",
    opts = {
      suggestion = { enabled = false },
      panel = { enabled = false },
      filetypes = {
        markdown = true,
        help = true,
        gitcommit = true,
        gitrebase = true,
        hgcommit = true,
        hgrebase = true,
      },
    },
  },
}
