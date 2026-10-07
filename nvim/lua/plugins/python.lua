return {
  { -- access python package documentation using :h module, class, function etc.
    "RazorBest/pydoc.nvim",
    ft = "python",
    opts = {
      version = "3.12", -- Python version
    },
  },
  -- virtual env selector
  {
    "linux-cultist/venv-selector.nvim",
    dependencies = {
      { "folke/snacks.nvim" },
    },
    ft = { "python", "jupyter" }, -- Load when opening python and python notebook files
    keys = { { ",v", "<cmd>VenvSelect<cr>" } }, -- Open picker on keymap
    opts = {
      options = {
        picker = "snacks",
      },
      search = {}, -- custom search definitions
    },
  },
  -- ipynb plugins
  { -- ipynb to markdown conversion and back
    "GCBallesteros/jupytext.nvim",
    config = function()
      require("jupytext").setup({
        style = "markdown",
        output_extension = "md",
        force_ft = "quarto",
      })
      -- Regenerate the .ipynb from its markdown twin from whichever side of
      -- the pair you're on. Same command jupytext.nvim runs on save, but
      -- usable from the plain .md buffer (whose :w does NOT touch the ipynb).
      -- Run cells with molten + :w first so MoltenExportOutput! embeds outputs.
      vim.api.nvim_create_user_command("JupytextSync", function()
        local bufname = vim.api.nvim_buf_get_name(0)
        local md, ipynb
        if bufname:match("%.ipynb$") then
          ipynb = bufname
          md = bufname:gsub("%.ipynb$", ".md")
        elseif bufname:match("%.md$") then
          md = bufname
          ipynb = bufname:gsub("%.md$", ".ipynb")
        else
          vim.notify("JupytextSync: open the notebook or its markdown twin first", vim.log.levels.WARN)
          return
        end
        if vim.fn.filereadable(md) == 0 then
          vim.notify("JupytextSync: no markdown twin at " .. md, vim.log.levels.WARN)
          return
        end
        local out = vim.fn.system({ "jupytext", "--update", "--to", "ipynb", "--output", ipynb, md })
        if vim.v.shell_error ~= 0 then
          vim.notify("JupytextSync failed:\n" .. vim.trim(out), vim.log.levels.ERROR)
          return
        end
        local f = io.open(ipynb, "r")
        local head = f and f:read(16) or ""
        if f then
          f:close()
        end
        if not head:match("^%s*{") then
          vim.notify("JupytextSync: " .. vim.fn.fnamemodify(ipynb, ":t") .. " is still not JSON", vim.log.levels.ERROR)
          return
        end
        vim.notify("JupytextSync: wrote " .. vim.fn.fnamemodify(ipynb, ":t"), vim.log.levels.INFO)
      end, { desc = "Regenerate the .ipynb from its markdown twin" })
    end,
  },
  { -- python lsp inside markdown files and code running integration with molten
    "quarto-dev/quarto-nvim",
    dependencies = {
      "jmbuhr/otter.nvim",
      "nvim-treesitter/nvim-treesitter",
    },
    ft = { "quarto", "markdown" },
    config = function()
      local quarto = require("quarto")
      quarto.setup({
        lspFeatures = {
          enabled = true,
          -- NOTE: put whatever languages are needed here:
          languages = { "python" },
          chunks = "all",
          diagnostics = {
            enabled = true,
            triggers = { "BufWritePost" },
          },
          completion = {
            enabled = true,
          },
        },
        keymap = {
          -- NOTE: setup your own keymaps:
          hover = "K",
          definition = "gd",
          rename = "<leader>rn",
          references = "gr",
          format = "<leader>gf",
        },
        codeRunner = {
          enabled = true,
          default_method = "molten",
          ft_runners = {
            python = "molten",
          },
          never_run = { "yaml" },
        },
      })
      local runner = require("quarto.runner")
      vim.keymap.set("n", "<localleader>rc", runner.run_cell, { desc = "run cell", silent = true })
      vim.keymap.set("n", "<localleader>ra", runner.run_above, { desc = "run cell and above", silent = true })
      vim.keymap.set("n", "<localleader>rA", runner.run_all, { desc = "run all cells", silent = true })
      vim.keymap.set("n", "<localleader>rl", runner.run_line, { desc = "run line", silent = true })
      vim.keymap.set("v", "<localleader>r", runner.run_range, { desc = "run visual range", silent = true })
      vim.keymap.set("n", "<localleader>RA", function()
        runner.run_all(true)
      end, { desc = "run all cells of all languages", silent = true })
    end,
  },
  {
    "benlubas/molten-nvim",
    branch = "main", -- Neovim 0.12 fix (#340, #offset! metadata) only exists on main; no release since v1.9.2
    build = ":UpdateRemotePlugins",
    ft = { "python", "quarto", "markdown" }, -- run code cells in these filetypes
    dependencies = { "3rd/image.nvim" }, -- for images and plots
    init = function()
      vim.g.molten_image_provider = "image.nvim"
      vim.g.molten_output_win_max_height = 20

      -- a keybind for `:noautocmd MoltenEnterOutput` is defined in config/keymaps.lua to open the output again
      vim.g.molten_auto_open_output = false

      -- MoltenEnterOutput (<localleader>os) opens AND moves the cursor into
      -- the float in one press. Molten's default "open_then_enter" only opens
      -- on the first press and enters on the second, which feels broken.
      vim.g.molten_enter_output_behavior = "open_and_enter"

      -- wrapping for virt text and the output window
      vim.g.molten_wrap_output = true

      -- display output -- including images -- as virtual text
      vim.g.molten_virt_text_output = true

      -- this will make it so the output shows up below the \`\`\` cell delimiter
      vim.g.molten_virt_lines_off_by_1 = true

      -- show " N More Lines " in the output window footer when the buffer is
      -- longer than the max height (scroll inside the float, or expand with
      -- <localleader>oe)
      vim.g.molten_output_show_more = true
    end,
  },
}
