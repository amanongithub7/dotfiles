-- A stable server address so external tools can reach this instance.
--
-- The DeepSeek Harness research-tools plugin talks to the running editor over
-- `nvim --server <socket> --remote-expr`. LazyVim does not start a server on
-- its own, and `$NVIM` only exists inside a Neovim child process, so publish
-- one fixed address instead.
--
-- Skipped when this instance already listens somewhere (a --listen launch, or
-- another plugin that started a server first).
local socket = vim.fn.expand("~/.cache/nvim/dsh.sock")

if vim.v.servername == "" then
  vim.fn.mkdir(vim.fn.fnamemodify(socket, ":h"), "p")
  -- serverstart fails on a socket file left behind by a crash; a live one is
  -- returned as-is, so only a failure is worth clearing and retrying.
  if not pcall(vim.fn.serverstart, socket) then
    vim.fn.delete(socket)
    pcall(vim.fn.serverstart, socket)
  end
end
