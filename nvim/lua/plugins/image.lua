return {
  {
    "vhyrro/luarocks.nvim",
    priority = 1001,
    opts = {
      rocks = { "dkjson", "magick" },
    },
  },
  {
    "3rd/image.nvim",
    version = "1.1.0",
    dependencies = { "luarocks.nvim" },
    build = false,
    opts = {
      processor = "magick_cli",
      backend = "kitty",
      max_width = 100,
      max_height = 12,
      max_height_window_percentage = math.huge,
      max_width_window_percentage = math.huge,
      window_overlap_clear_enabled = true,
      window_overlap_clear_ft_ignore = { "cmp_menu", "cmp_docs", "" },
      integrations = {
        markdown = {
          resolve_image_path = function(document_path, image_path, fallback)
            return fallback(document_path, image_path)
          end,
          only_render_image_at_cursor = true,
        },
      },
    },
    config = function(_, opts)
      pcall(require("image").setup, opts)
    end,
  },
}
