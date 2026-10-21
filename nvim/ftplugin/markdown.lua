require("quarto").activate()

-- <CR> follows the link under the cursor: web URLs open externally, relative
-- file links :edit, #anchors jump to headings. In obsidian vault buffers this
-- defers to obsidian's smart_action (see lua/config/markdown-links.lua).
require("config.markdown-links").map()

-- Cap line length at the snacks zen viewport width so a full line in a normal
-- window is exactly a full line in zen mode. The viewport is a fraction of the
-- terminal width (vim.g.zen_width, see lua/config/options.lua), so recompute
-- whenever the terminal is resized.
local function set_textwidth()
  vim.bo.textwidth = math.floor(vim.o.columns * vim.g.zen_width)
end
set_textwidth()
vim.api.nvim_create_autocmd("VimResized", {
  buffer = 0,
  callback = set_textwidth,
})
