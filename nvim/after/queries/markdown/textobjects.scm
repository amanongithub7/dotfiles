;; extends

;; Molten's notion of a code "cell", which lua/plugins/treesitter.lua maps to
;; ]b / [b (next / previous), ib / ab (select) and <leader>sbl / sbh (swap):
;;
;;   @code_cell.inner  the body of a fenced block, fence lines excluded
;;   @code_cell.outer  the whole block, fences included
;;
;; The shipped nvim-treesitter-textobjects query already maps the same node to
;; @block.*, so this only adds the captures CodeCompanion/Molten setups expect.
;; It applies to notebook buffers too: jupytext gives them ft=quarto, which
;; Neovim parses with the markdown grammar (vim.treesitter language.register).
(fenced_code_block
  (code_fence_content) @code_cell.inner) @code_cell.outer
