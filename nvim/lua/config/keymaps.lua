-- Keymaps for Neovim

----------------------------------------------------------------------------------------------------
-- Purge LazyVim / plugin default maps (superseded or unused)
--
-- Plugins register their maps at different stages (lazy.nvim setup,
-- VeryLazy, DeferredUIEnter), so we run the purge after each of those
-- windows. Idempotent (runs once) and pcall-guarded, so absent maps are
-- skipped and upstream changes never break startup.
----------------------------------------------------------------------------------------------------
local purge_maps
purge_maps = vim.schedule_wrap(function()
  local purge = {
    "<leader>`",                                          -- switch buffer (native <C-^> is faster)
    "<leader>K",                                          -- Keywordprg (native K; LSP hover)
    "<leader>L",                                          -- LazyVim changelog
    "<leader>,",                                          -- duplicate of <leader>b buffers picker
    "<leader>-", "<leader>|",                             -- splits moved into <leader>w group
    "<leader>t",                                          -- global empty +test marker (python-scoped below)
    "<leader>bb", "<leader>bd", "<leader>bD", "<leader>bi", -- buffer menu -> <leader>b picker
    "<leader>bj", "<leader>bl", "<leader>bo", "<leader>bP", "<leader>bp", "<leader>br",
    "<leader>qq", "<leader>qd", "<leader>ql", "<leader>qs", "<leader>qS", -- sessions unused
    "<leader>gG", "<leader>gY", "<leader>gD",             -- git duplicates
    "<leader>gi", "<leader>gI", "<leader>gp", "<leader>gP", "<leader>gB", -- GitHub -> <leader>G group
    "<leader>wd", "<leader>wm",                           -- window menu gone (nav/resize on <C-*> keys)
    "<leader>xl", "<leader>xL", "<leader>xQ", "<leader>xt", "<leader>xT", -- trouble/picker duplicates
    "<leader>sG", "<leader>sW", "<leader>sc",             -- search menu duplicates (<leader>/, sw, <leader>:)
    "<leader>uS",                                         -- toggle for disabled snacks.scroll
    "<leader>E", "<leader>fe", "<leader>fE",              -- explorer: keep only <leader>e
    "<leader>ff", "<leader>fF", "<leader>fb", "<leader>fB", "<leader>fn", -- find menu gone
    "<leader>fc", "<leader>fp", "<leader>fr", "<leader>fR", "<leader>fP", "<leader>fg",
    "<leader>ft", "<leader>fT",
    "<leader><tab>[", "<leader><tab>]", "<leader><tab><tab>", "<leader><tab>d",
    "<leader><tab>f", "<leader><tab>l", "<leader><tab>o", -- tabs unused
    -- neotest: scenario-scoped maps are created per-buffer below
    "<leader>ta", "<leader>td", "<leader>to", "<leader>tO", "<leader>tr",
    "<leader>tS", "<leader>tw", "<leader>tt", "<leader>tT", "<leader>tl", "<leader>ts",
    -- opencode session numbers (rarely needed)
    "<leader>o1", "<leader>o2", "<leader>o3", "<leader>o4", "<leader>o5",
    "<leader>o6", "<leader>o7", "<leader>o8", "<leader>o9",
  }
  for _, lhs in ipairs(purge) do
    pcall(vim.keymap.del, "n", lhs)
  end
end)

-- LazyVim loads this file on the VeryLazy event. Plugins are on the rtp by
-- then, but which-key may not be *loaded* yet, so its require stays deferred.

local purged = false
local function purge_once(delay)
  if purged then
    return
  end
  vim.defer_fn(function()
    if purged then
      return
    end
    purged = true
    purge_maps()
  end, delay)
end

-- Interactive sessions: UI attaches within ~100ms and all plugin map
-- registrations (setup, VeryLazy, DeferredUIEnter) settle well under 2s.
-- Registered plugin maps keep appearing through the first seconds of startup
-- (lazy setup, VeryLazy, DeferredUIEnter); run the purge once they settled.
vim.defer_fn(function()
  purge_once(0)
end, 2000)

----------------------------------------------------------------------------------------------------
-- Set Keymaps
----------------------------------------------------------------------------------------------------

-- LSP restart (code menu)
vim.keymap.set("n", "<leader>cl", "<cmd>LspRestart<cr>", { desc = "LSP Restart" })

-- explorer: LazyVim only defines <leader>e as a remap to <leader>fe (purged),
-- so map it directly. Keeps a single explorer key as preferred.
vim.keymap.set("n", "<leader>e", function()
  Snacks.explorer({ cwd = LazyVim.root() })
end, { desc = "Explorer" })

-- window splits (moved into the <leader>w group)
vim.keymap.set("n", "<leader>w-", "<cmd>split<cr>", { desc = "Split Window Below" })
vim.keymap.set("n", "<leader>w|", "<cmd>vsplit<cr>", { desc = "Split Window Right" })

-- yank history (same behavior as LazyVim's yanky extra, renamed desc)
vim.keymap.set({ "n", "x" }, "<leader>p", function()
  Snacks.picker.yanky()
end, { desc = "Yank History" })

-- GitHub (moved out of <leader>g into <leader>G); GB lives in snacks.lua
vim.keymap.set("n", "<leader>Gi", function()
  Snacks.picker.gh_issue()
end, { desc = "Issues (open)" })
vim.keymap.set("n", "<leader>GI", function()
  Snacks.picker.gh_issue({ state = "all" })
end, { desc = "Issues (all)" })
vim.keymap.set("n", "<leader>Gp", function()
  Snacks.picker.gh_pr()
end, { desc = "Pull Requests (open)" })
vim.keymap.set("n", "<leader>GP", function()
  Snacks.picker.gh_pr({ state = "all" })
end, { desc = "Pull Requests (all)" })

-- bookmarks
vim.keymap.set({ "n", "v" }, "<leader>mm", "<cmd>BookmarksMark<cr>", { desc = "Bookmark Line" })
vim.keymap.set({ "n", "v" }, "<leader>mo", "<cmd>BookmarksGoto<cr>", { desc = "Open Bookmark" })
vim.keymap.set({ "n", "v" }, "<leader>mc", "<cmd>BookmarksCommands<cr>", { desc = "Bookmark Commands" })
vim.keymap.set({ "n", "v" }, "<leader>md", "<cmd>BookmarksDesc<cr>", { desc = "Add Bookmark Description" })
vim.keymap.set({ "n", "v" }, "<leader>mt", "<cmd>BookmarksTree<cr>", { desc = "Bookmarks Tree" })

-- neotest: only exist in python buffers
vim.api.nvim_create_autocmd("FileType", {
  pattern = "python",
  callback = function(args)
    local map = function(lhs, rhs, desc)
      vim.keymap.set("n", lhs, rhs, { buffer = args.buf, desc = desc })
    end
    map("<leader>tr", function() require("neotest").run.run() end, "Run Nearest Test")
    map("<leader>tT", function() require("neotest").run.run(vim.fn.expand("%")) end, "Run All Tests in File")
    map("<leader>tl", function() require("neotest").run.run_last() end, "Re-run Last Test")
    map("<leader>ts", function() require("neotest").summary.toggle() end, "Toggle Test Summary")
    map("<leader>ta", function() require("neotest").run.attach() end, "Attach to Test")
    map("<leader>td", function() require("neotest").run.run({ strategy = "dap" }) end, "Debug Nearest Test")
    map("<leader>to", function() require("neotest").output.open() end, "Show Test Output")
    map("<leader>tO", function() require("neotest").output_panel.toggle() end, "Toggle Output Panel")
    map("<leader>tS", function() require("neotest").run.stop() end, "Stop Test")
    map("<leader>tw", function() require("neotest").watch.toggle() end, "Toggle Watch")
    vim.schedule(function()
      require("which-key").add({
        { "<leader>t", group = "test", icon = "󰙨", buffer = args.buf },
      })
    end)
  end,
})

-- which-key group docs.
-- Deferred: plugins aren't on the rtp yet when LazyVim loads this file,
-- so a top-level require("which-key") would abort the rest of the file.
vim.schedule(function()
  local wk = require("which-key")
  wk.add({
    { "<leader>b", desc = "Buffers", icon = "󰈔" },
    { "<leader>m", group = "bookmarks", icon = "󰂺" },
    { "<leader>o", group = "opencode", icon = { icon = "󱙺", color = "green" } },
    { "<leader>G", group = "GitHub", icon = "󰊤" },
    { "<leader>od", group = "diff", icon = "󰊢" },
    { "<leader>?", desc = "Buffer Local Keymaps", icon = "󰋗" },
    { "<leader>w", group = "windows", icon = "󰖲" },
    -- groups whose maps were removed: hide the empty menu entries
    { "<leader>f", hidden = true },
    { "<leader>q", hidden = true },
    { "<leader><tab>", hidden = true },
  })
end)

-- markdown-only headings/markdown-plus group
vim.api.nvim_create_autocmd("FileType", {
  pattern = "markdown",
  callback = function(args)
    vim.schedule(function()
      require("which-key").add({
        { "<leader>h", group = "headings", icon = "󰎚", buffer = args.buf },
      })
    end)
  end,
})
