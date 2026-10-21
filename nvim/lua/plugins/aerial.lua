-- Extends LazyVim's aerial.nvim extra (enabled via
-- lazyvim.plugins.extras.editor.aerial in lazyvim.json).
--
-- Markdown headings render poorly in aerial out of the box:
--   * obsidian-ls (the LSP obsidian.nvim starts for vault buffers) reports each
--     heading as the literal source text, e.g. "# Heading" / "## Sub".
--   * the treesitter/markdown backends give clean names, but every heading
--     shares the generic "Interface"/"File" kind, so they all get one icon and
--     one colour.
-- Give each heading level its own icon and colour instead, matching what
-- render-markdown.nvim draws in the buffer so the outline and the document agree.
return {
  {
    "stevearc/aerial.nvim",
    opts = function(_, opts)
      -- render-markdown.nvim's default heading icons, h1..h6.
      local heading_icons = { "󰲡 ", "󰲣 ", "󰲥 ", "󰲧 ", "󰲩 ", "󰲫 " }
      local markdown_fts = { markdown = true, quarto = true }

      -- Headings get a per-level kind (MarkdownH1..MarkdownH6) so aerial picks a
      -- matching icon.
      opts.icons = opts.icons or {}
      for _, ft in ipairs({ "markdown", "quarto" }) do
        opts.icons[ft] = opts.icons[ft] or {}
        for lvl, icon in ipairs(heading_icons) do
          opts.icons[ft]["MarkdownH" .. lvl] = icon
        end
      end

      -- Colour each level like the document (RenderMarkdownH1..H6 are the groups
      -- render-markdown.nvim links to @markup.heading.1..6).
      local function set_heading_highlights()
        for lvl = 1, 6 do
          local hl = "RenderMarkdownH" .. lvl
          vim.api.nvim_set_hl(0, "AerialMarkdownH" .. lvl, { link = hl, default = true })
          vim.api.nvim_set_hl(0, "AerialMarkdownH" .. lvl .. "Icon", { link = hl, default = true })
        end
      end
      set_heading_highlights()
      vim.api.nvim_create_autocmd("ColorScheme", {
        group = vim.api.nvim_create_augroup("AerialMarkdownHeadings", { clear = true }),
        callback = set_heading_highlights,
      })

      local parent_parse = opts.post_parse_symbol
      opts.post_parse_symbol = function(bufnr, item, ctx)
        if markdown_fts[vim.bo[bufnr].filetype] and item.name then
          -- obsidian-ls names are "# Heading"; the treesitter/markdown backends
          -- give clean names and set item.level instead.
          local hashes, text = item.name:match("^(#+)%s+(.*)$")
          local level = hashes and #hashes or (item.level and item.level + 1)
          if level then
            item.name = text or item.name
            item.level = level - 1
            item.kind = "MarkdownH" .. math.min(level, 6)
          end
        end
        if parent_parse then
          return parent_parse(bufnr, item, ctx)
        end
      end

      local parent_highlight = opts.get_highlight
      opts.get_highlight = function(symbol, is_icon, is_collapsed)
        if symbol.kind and symbol.kind:match("^MarkdownH%d$") then
          return "Aerial" .. symbol.kind .. (is_icon and "Icon" or "")
        end
        if parent_highlight then
          return parent_highlight(symbol, is_icon, is_collapsed)
        end
      end

      return opts
    end,
  },
}
