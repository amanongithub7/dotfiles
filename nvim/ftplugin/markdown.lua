require("quarto").activate()

-- <CR> follows the link under the cursor: web URLs open externally, relative
-- file links :edit, #anchors jump to headings. In obsidian vault buffers this
-- defers to obsidian's smart_action (see lua/config/markdown-links.lua).
require("config.markdown-links").map()
