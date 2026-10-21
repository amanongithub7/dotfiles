return {
  {
    "3rd/image.nvim",
    -- no version pin: image.nvim >= v1.2 recognizes `allow-passthrough all`,
    -- which tmux.conf sets (needed for OSC 777 from backgrounded panes)
    build = false, -- magick_cli shells out to the ImageMagick CLI; nothing to build
    -- only needed for inline images in these filetypes
    ft = { "markdown", "python", "quarto", "jupyter", "r", "norg", "org" },
    opts = {
      processor = "magick_cli",
      backend = "kitty",
      max_width = 100,
      max_height = 12,
      max_height_window_percentage = math.huge,
      max_width_window_percentage = math.huge,
      window_overlap_clear_enabled = true,
      window_overlap_clear_ft_ignore = {
        "cmp_menu",
        "cmp_docs",
        "snacks_notif",
        "scrollview",
        "scrollview_sign",
      },
      integrations = {
        markdown = {
          -- NOTE: a function-valued option here (the docs' resolve_image_path
          -- example, even as a pass-through) makes :ImageReport fail with
          -- "invalid type: function" — image.nvim serializes its options.
          -- Restore it if you ever need per-vault image path resolution:
          -- resolve_image_path = function(document_path, image_path, fallback)
          --   return fallback(document_path, image_path)
          -- end,
          only_render_image_at_cursor = true,
        },
      },
    },
    -- no pcall: a failed setup must be loud, otherwise every molten image
    -- render raises "image.nvim is not setup" on each scroll
    config = function(_, opts)
      require("image").setup(opts)
    end,
  },
}
