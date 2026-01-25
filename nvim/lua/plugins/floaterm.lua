return {
  "voldikss/vim-floaterm",
  keys = {
    {
      "<leader>T",
      function()
        vim.cmd("FloatermNew")
      end,
      desc = "Floating Terminal (cwd)",
    },
  },
}
