-- Per-notebook molten kernel bindings: opening the same notebook auto-inits
-- the kernel you chose instead of prompting every time.
-- Resolution priority: explicit binding > notebook kernelspec > active venv.
local M = {}

M.file = vim.fn.stdpath("data") .. "/molten/bindings.json"

---@param bufname string
---@return string|nil
function M.get(bufname)
  local f = io.open(M.file, "r")
  if not f then
    return nil
  end
  local ok, data = pcall(vim.json.decode, f:read("a"))
  f:close()
  if ok and type(data) == "table" then
    return data[bufname]
  end
  return nil
end

---@param bufname string
---@param kernel string
function M.bind(bufname, kernel)
  local data = {}
  local f = io.open(M.file, "r")
  if f then
    local ok, decoded = pcall(vim.json.decode, f:read("a"))
    f:close()
    if ok and type(decoded) == "table" then
      data = decoded
    end
  end
  data[bufname] = kernel
  vim.fn.mkdir(vim.fn.fnamemodify(M.file, ":h"), "p")
  vim.fn.writefile({ vim.json.encode(data) }, M.file)
end

---Kernel to auto-init for a notebook: explicit binding, else the notebook's
---kernelspec metadata, else the active venv/conda kernel. Returns nil when
---nothing matches an available kernel (caller may prompt).
---@param bufname string
---@param kernels string[] available kernels (MoltenAvailableKernels)
---@return string|nil
function M.candidate(bufname, kernels)
  local known = function(name)
    return name ~= nil and vim.tbl_contains(kernels, name)
  end
  local bound = M.get(bufname)
  if known(bound) then
    return bound
  end
  local f = io.open(bufname, "r")
  if f then
    local ok, meta = pcall(function()
      return vim.json.decode(f:read("a"))["metadata"].kernelspec.name
    end)
    f:close()
    if ok and known(meta) then
      return meta
    end
  end
  local venv = os.getenv("VIRTUAL_ENV") or os.getenv("CONDA_PREFIX")
  local venv_kernel = venv and string.match(venv, "/.+/(.+)") or nil
  if known(venv_kernel) then
    return venv_kernel
  end
  return nil
end

---Prompt for a kernel, bind it to the current notebook, and switch to it now
---(deinit the live kernel first if one is running).
function M.switch()
  local ok, kernels = pcall(vim.fn.MoltenAvailableKernels)
  if not ok or type(kernels) ~= "table" or #kernels == 0 then
    vim.notify("molten-kernel: no kernels available (is jupyter installed?)", vim.log.levels.WARN)
    return
  end
  local bufname = vim.api.nvim_buf_get_name(0)
  local bound = M.get(bufname)
  vim.ui.select(kernels, {
    prompt = "Select kernel for this notebook:",
    format_item = function(k)
      return k .. (k == bound and "  (bound)" or "")
    end,
  }, function(choice)
    if not choice then
      return
    end
    M.bind(bufname, choice)
    if require("molten.status").initialized() == "Molten" then
      vim.cmd("MoltenDeinit")
    end
    vim.cmd(("MoltenInit %s"):format(choice))
    vim.notify(
      "molten-kernel: bound " .. choice .. " to " .. vim.fn.fnamemodify(bufname, ":t"),
      vim.log.levels.INFO
    )
  end)
end

return M
