return {
  "3rd/image.nvim",
  build = false, -- so that it doesn't build the rock https://github.com/3rd/image.nvim/issues/91#issuecomment-2453430239
  opts = {
    processor = "magick_cli",
  },
  config = function()
    require("image").setup({
      integrations = {
        markdown = {
          resolve_image_path = function(document_path, image_path, fallback)
            -- document_path is the path to the file that contains the image
            -- image_path is the potentially relative path to the image. for
            -- markdown it's `![](this text)`

            -- you can call the fallback function to get the default behavior
            return fallback(document_path, image_path)
          end,
          only_render_image_at_cursor = true,
        },
      },
    })
  end,
}
