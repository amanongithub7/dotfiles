return {
  "voldikss/vim-floaterm",
  keys = {
    {
      "<leader>ft",
      function()
        vim.cmd("FloatermNew")
      end,
      desc = "Floating terminal (cwd)",
    },
  },
}
