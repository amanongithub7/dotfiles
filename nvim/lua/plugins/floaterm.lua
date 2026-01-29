return {
  "voldikss/vim-floaterm",
  keys = {
    {
      "<leader>F",
      function()
        vim.cmd("FloatermNew")
      end,
      desc = "Floating Terminal (cwd)",
    },
  },
}
