-- Zotero integration: citation picker + insert, open PDF (Sioyek), open note.
-- Bibliography is a Better BibTeX auto-export consumed offline.
-- See nvim/zotero-setup.md for the full plan.

local M = {}

local uv = vim.uv or vim.loop

-- Paths ----------------------------------------------------------------------
local DATA_DIR = vim.fn.expand("~/climate-crisis/research-papers/organization-tools/zotero")
M.bib_file = DATA_DIR .. "/exports/library.bib"
M.zotero_db = DATA_DIR .. "/zotero.sqlite"

M.vaults = {
  vim.fn.expand("~/vaults/climate-crisis"),
  vim.fn.expand("~/vaults/personal"),
}
M.notes_subdir = "research-papers-🔬/notes"
M.pdfs_subdir = "research-papers-🔬/pdfs"

---Realpath-normalized check: is this buffer path a literature note?
---(vault paths can be symlinks, so names may differ from the resolved path.)
---@param name string
---@return boolean
function M.is_note_path(name)
  if not name or name == "" then
    return false
  end
  local resolved = uv.fs_realpath(name) or name
  for _, v in ipairs(M.vaults) do
    local base = uv.fs_realpath(v .. "/" .. M.notes_subdir) or (v .. "/" .. M.notes_subdir)
    if resolved:sub(1, #base) == base then
      return true
    end
  end
  return false
end

-- BibTeX parsing -------------------------------------------------------------
local cache = { mtime = nil, entries = nil }
local zcache = { mtime = nil, map = nil }

-- Zotero keeps the DB open, so a direct read-only open fails with
-- "database is locked". Copy the DB (+ WAL/SHM) to a cache dir and query the
-- copy instead, which is safe while Zotero runs.
local DB_CACHE_DIR = vim.fn.stdpath("cache") .. "/zotero"
local db_copy_state = { mtime = nil }

local function db_copy()
  local stat = uv.fs_stat(M.zotero_db)
  if not stat then
    return nil
  end
  local mtime = stat.mtime.sec
  local wst = uv.fs_stat(M.zotero_db .. "-wal")
  if wst and wst.mtime.sec > mtime then
    mtime = wst.mtime.sec
  end
  local path = DB_CACHE_DIR .. "/zotero.sqlite"
  if db_copy_state.mtime ~= mtime or not uv.fs_stat(path) then
    vim.fn.mkdir(DB_CACHE_DIR, "p")
    if not pcall(uv.fs_copyfile, M.zotero_db, path) then
      return nil
    end
    pcall(uv.fs_copyfile, M.zotero_db .. "-wal", path .. "-wal")
    pcall(uv.fs_copyfile, M.zotero_db .. "-shm", path .. "-shm")
    db_copy_state.mtime = mtime
  end
  return path
end

---Run a SELECT against a lock-safe copy of the Zotero DB.
---@param sql string
---@return string[]
function M.query(sql)
  local path = db_copy()
  if not path then
    return {}
  end
  return vim.fn.systemlist({ "sqlite3", "-readonly", path, sql })
end

---Recursively replace JSON null (vim.NIL) with nil.
---@param v any
---@return any
local function denull(v)
  if v == vim.NIL then
    return nil
  end
  if type(v) == "table" then
    for k, val in pairs(v) do
      if val == vim.NIL then
        v[k] = nil
      else
        v[k] = denull(val)
      end
    end
  end
  return v
end

---Run a SELECT and decode the JSON rows.
---@param sql string
---@return table[]
function M.query_json(sql)
  local path = db_copy()
  if not path then
    return {}
  end
  local out = vim.fn.systemlist({ "sqlite3", "-readonly", "-json", path, sql })
  local text = table.concat(out, "\n")
  if text == "" then
    return {}
  end
  local ok, data = pcall(vim.json.decode, text)
  if ok and type(data) == "table" then
    return denull(data)
  end
  return {}
end

---Read a balanced or quoted field value from an entry body.
---@param body string
---@param name string
---@return string|nil
local function read_field(body, name)
  local start = body:find("[,%s]" .. name .. "%s*=[%s]*", 1)
  if not start then
    return nil
  end
  local eq = body:find("=", start, true)
  if not eq then
    return nil
  end
  local i = eq + 1
  while i <= #body and body:sub(i, i):match("%s") do
    i = i + 1
  end
  local c = body:sub(i, i)
  if c == "{" then
    local depth, from = 0, i
    while i <= #body do
      local ch = body:sub(i, i)
      if ch == "{" then
        depth = depth + 1
      elseif ch == "}" then
        depth = depth - 1
        if depth == 0 then
          return body:sub(from + 1, i - 1)
        end
      end
      i = i + 1
    end
  elseif c == '"' then
    local j = body:find('"', i + 1, true)
    if j then
      return body:sub(i + 1, j - 1)
    end
  else
    local j = body:find("[,%\n]", i)
    return body:sub(i, (j and j - 1) or #body)
  end
  return nil
end

local function clean(v)
  if not v then
    return ""
  end
  return (v:gsub("[{}]", ""):gsub("%s+", " "):gsub("^%s+", ""):gsub("%s+$", ""))
end

---@param text string
---@return table[]
local function parse_bib(text)
  local entries = {}
  local pos = 1
  while true do
    local at = text:find("@", pos, true)
    if not at then
      break
    end
    local open = text:find("{", at, true)
    if not open then
      break
    end
    local typ = text:sub(at + 1, open - 1):gsub("%s", "")
    if typ:lower() == "comment" then
      -- skip @comment{...}
    end
    local depth, i, close = 1, open + 1, nil
    while i <= #text do
      local ch = text:sub(i, i)
      if ch == "{" then
        depth = depth + 1
      elseif ch == "}" then
        depth = depth - 1
        if depth == 0 then
          close = i
          break
        end
      end
      i = i + 1
    end
    if not close then
      break
    end
    local body = text:sub(open + 1, close - 1)
    local key = body:match("^%s*([^,]+),")
    if key and typ:lower() ~= "comment" and typ:lower() ~= "string" and typ:lower() ~= "preamble" then
      key = clean(key)
      local title = clean(read_field(body, "title"))
      local year = clean(read_field(body, "year"))
      if year == "" then
        year = clean(read_field(body, "date")):sub(1, 4)
      end
      local entry = {
        key = key,
        type = typ,
        title = title,
        author = clean(read_field(body, "author")),
        year = year,
        journal = clean(read_field(body, "journaltitle"))
          or clean(read_field(body, "journal"))
          or clean(read_field(body, "booktitle")),
        file = clean(read_field(body, "file")),
      }
      entry.text = table.concat({ entry.key, entry.title, entry.author, entry.year }, "  ")
      entries[#entries + 1] = entry
    end
    pos = close + 1
  end
  return entries
end

---All bib entries (mtime-cached).
---@return table[]
function M.entries()
  local stat = uv.fs_stat(M.bib_file)
  if not stat then
    return {}
  end
  if cache.mtime == stat.mtime.sec and cache.entries then
    return cache.entries
  end
  local fd = io.open(M.bib_file, "r")
  if not fd then
    return {}
  end
  local text = fd:read("*a")
  fd:close()
  cache.entries = parse_bib(text)
  cache.mtime = stat.mtime.sec
  return cache.entries
end

function M.reload()
  cache.mtime = nil
  cache.entries = nil
  zcache.mtime = nil
  zcache.map = nil
  local n = #M.entries()
  vim.notify(("Zotero: reloaded %d entries"):format(n), vim.log.levels.INFO)
end

---Find an entry by citekey.
---@param key string
---@return table|nil
function M.entry(key)
  for _, e in ipairs(M.entries()) do
    if e.key == key then
      return e
    end
  end
end

---Map citekey -> { attach = <pdf attachment item key>, item = <item key> }.
---Read from the Zotero SQLite DB (BBT citation keys live in fields.citationKey).
---@return table<string, {attach:string, item:string}>
function M.zmap()
  local stat = uv.fs_stat(M.zotero_db)
  if not stat then
    return {}
  end
  if zcache.mtime == stat.mtime.sec and zcache.map then
    return zcache.map
  end
  local query = table.concat({
    "select v.value, ai.key, i.key",
    "from itemData d",
    "join itemDataValues v on v.valueID=d.valueID",
    "join fields f on f.fieldID=d.fieldID",
    "join items i on i.itemID=d.itemID",
    "join itemAttachments a on a.parentItemID=i.itemID",
    "join items ai on ai.itemID=a.itemID",
    "where f.fieldName='citationKey' and a.contentType='application/pdf';",
  }, " ")
  local out = M.query(query)
  local map = {}
  for _, line in ipairs(out) do
    local ck, ak, ik = line:match("^(.-)|(.-)|(.*)$")
    if ck and ck ~= "" then
      map[ck] = { attach = ak, item = ik }
    end
  end
  zcache.map = map
  zcache.mtime = stat.mtime.sec
  return map
end

---Full item metadata for a citekey (from the Zotero DB).
---@param citekey string
---@return table|nil
function M.item_data(citekey)
  local rows = M.query_json(string.format(
    "select i.key as itemKey, i.itemID as itemID, i.dateAdded as dateAdded, it.typeName as itemType "
      .. "from items i join itemTypes it on it.itemTypeID=i.itemTypeID "
      .. "where i.itemID=(select d.itemID from itemData d join itemDataValues v on v.valueID=d.valueID "
      .. "join fields f on f.fieldID=d.fieldID where f.fieldName='citationKey' and v.value='%s' limit 1)",
    citekey
  ))
  local it = rows[1]
  if not it then
    return nil
  end

  local fields = {}
  for _, r in ipairs(M.query_json(("select f.fieldName as name, v.value as value from itemData d "
    .. "join itemDataValues v on v.valueID=d.valueID join fields f on f.fieldID=d.fieldID "
    .. "where d.itemID=%s"):format(it.itemID))) do
    fields[r.name] = r.value
  end

  local authors = {}
  for _, r in ipairs(M.query_json(("select c.lastName as last, c.firstName as first from itemCreators ic "
    .. "join creators c on c.creatorID=ic.creatorID where ic.itemID=%s order by ic.orderIndex"):format(it.itemID))) do
    local name = r.last or ""
    if r.first and r.first ~= "" then
      name = name .. ", " .. r.first
    end
    authors[#authors + 1] = name
  end

  local tags = {}
  for _, r in ipairs(M.query_json(("select t.name as name from itemTags it join tags t on t.tagID=it.tagID "
    .. "where it.itemID=%s"):format(it.itemID))) do
    tags[#tags + 1] = r.name
  end

  local att = M.query_json(("select i2.key as key, att.path as path, "
    .. "(select v.value from itemData d join itemDataValues v on v.valueID=d.valueID join fields f on f.fieldID=d.fieldID "
    .. "where d.itemID=att.itemID and f.fieldName='title') as title "
    .. "from itemAttachments att join items i2 on i2.itemID=att.itemID "
    .. "where att.parentItemID=%s and att.contentType='application/pdf' limit 1"):format(it.itemID))[1]

  local pdf_file = ""
  if att then
    pdf_file = (att.title and att.title ~= "") and att.title or ((att.path or ""):match("([^/]+)$") or "")
  end

  local date = fields.date or ""
  return {
    itemKey = it.itemKey,
    itemType = it.itemType,
    dateAdded = (it.dateAdded or ""):sub(1, 16),
    title = fields.title or "",
    publication = fields.publicationTitle or "",
    doi = fields.DOI or "",
    url = fields.url or "",
    abstract = fields.abstractNote or "",
    year = date:sub(1, 4),
    authors = authors,
    tags = tags,
    pdfFile = pdf_file,
    attachKey = att and att.key or "",
    desktopURI = "zotero://select/library/items/" .. it.itemKey,
  }
end

---All annotations for a citekey's PDF attachment(s).
---@param citekey string
---@return table[]
function M.annotations(citekey)
  return M.query_json(string.format(
    "select a.type as type, a.text as text, a.comment as comment, a.color as color, "
      .. "a.pageLabel as page, ai.key as key "
      .. "from itemAnnotations a "
      .. "join itemAttachments att on att.itemID=a.parentItemID "
      .. "join items pi on pi.itemID=att.parentItemID "
      .. "join itemData d on d.itemID=pi.itemID "
      .. "join itemDataValues v on v.valueID=d.valueID "
      .. "join fields f on f.fieldID=d.fieldID "
      .. "join items ai on ai.itemID=a.itemID "
      .. "where f.fieldName='citationKey' and v.value='%s' "
      .. "order by att.itemID, a.sortIndex",
    citekey
  ))
end

-- Helpers --------------------------------------------------------------------
---@return string|nil citekey under the cursor
function M.key_under_cursor()
  local cword = vim.fn.expand("<cWORD>")
  local key = cword:match("@([%w_%-%.:]+)") or cword:match("([%w_%-%.:]+)") or cword
  key = key:gsub("[{},;%]%[%(%)]", "")
  if key == "" then
    return nil
  end
  return key
end

---Citekey for the current context: the one under the cursor (if it's a real
---key), else the `citekey:` from the current literature note's frontmatter.
---@return string|nil
function M.current_citekey()
  local word = M.key_under_cursor()
  if word and (M.entry(word) or M.zmap()[word]) then
    return word
  end
  if M.is_note_path(vim.api.nvim_buf_get_name(0)) then
    local n = math.min(40, vim.api.nvim_buf_line_count(0))
    for _, l in ipairs(vim.api.nvim_buf_get_lines(0, 0, n, false)) do
      local ck = l:match("^%s*citekey:%s*(%S+)")
      if ck then
        return ck
      end
    end
  end
  return nil
end

---Find the literature note for a citekey across the vaults.
---@param key string
---@return string|nil
function M.resolve_note(key)
  for _, vault in ipairs(M.vaults) do
    local dir = vault .. "/" .. M.notes_subdir
    local ok, entries = pcall(vim.fn.readdir, dir)
    if ok then
      -- filename match first
      for _, name in ipairs(entries) do
        if name:find(key, 1, true) then
          return dir .. "/" .. name
        end
      end
      -- frontmatter `citekey:` scan
      for _, name in ipairs(entries) do
        if name:match("%.md$") then
          local f = io.open(dir .. "/" .. name, "r")
          if f then
            local head = f:read(4096) or ""
            f:close()
            if head:find("citekey:%s*" .. key .. "%f[%W]") then
              return dir .. "/" .. name
            end
          end
        end
      end
    end
  end
  return nil
end

-- Actions --------------------------------------------------------------------
---@param entry table
function M.insert(entry)
  local ft = vim.bo.filetype
  local text
  if ft == "tex" or ft == "plaintex" then
    text = "\\cite{" .. entry.key .. "}"
  else
    text = "[@" .. entry.key .. "]"
  end
  vim.api.nvim_put({ text }, "c", true, true)
end

---Open a URL with the system opener.
---@param url string
local function open_url(url)
  local ok = pcall(vim.ui.open, url)
  if not ok then
    vim.fn.jobstart({ "open", url }, { detach = true })
  end
end

---Open the paper in **Zotero** (reader for the PDF, else the item), since that
---is where annotations are made.
---@param entry table
function M.open_pdf(entry)
  local m = M.zmap()[entry.key]
  if m and m.attach and m.attach ~= "" then
    open_url("zotero://open-pdf/library/items/" .. m.attach)
    return
  end
  if m and m.item and m.item ~= "" then
    open_url("zotero://select/library/items/" .. m.item)
    return
  end
  vim.notify("Zotero: no PDF/item found for " .. entry.key, vim.log.levels.WARN)
end

---@param entry table
function M.open_note(entry)
  local path = M.resolve_note(entry.key)
  if not path then
    vim.notify("Zotero: no note found for " .. entry.key, vim.log.levels.WARN)
    return
  end
  vim.cmd.edit(vim.fn.fnameescape(path))
end

---Open the note for an entry, creating a fresh one if it doesn't exist.
---@param entry table
function M.open_or_create_note(entry)
  local path = M.resolve_note(entry.key)
  if path then
    vim.cmd.edit(vim.fn.fnameescape(path))
  else
    M.create_note(entry.key)
  end
end

function M.copy_key(key)
  vim.fn.setreg(vim.v.register, key)
  vim.notify("Zotero: yanked " .. key, vim.log.levels.INFO)
end

-- Picker ---------------------------------------------------------------------
---@param opts? { action?: "insert"|"pdf"|"note" }
function M.pick(opts)
  opts = opts or {}
  local entries = M.entries()
  if #entries == 0 then
    vim.notify("Zotero: no entries in " .. M.bib_file .. " (configure the BBT export)", vim.log.levels.WARN)
    return
  end
  Snacks.picker({
    title = "Zotero Citations",
    items = entries,
    preview = "none",
    confirm = function(picker, item)
      if not item then
        return
      end
      picker:close()
      if opts.action == "pdf" then
        M.open_pdf(item)
      elseif opts.action == "note" then
        M.open_or_create_note(item)
      elseif opts.action == "yank" then
        M.copy_key(item.key)
      else
        M.insert(item)
      end
    end,
    actions = {
      zotero_insert = function(_, item)
        if item then
          M.insert(item)
        end
      end,
      zotero_pdf = function(picker, item)
        if item then
          M.open_pdf(item)
          picker:close()
        end
      end,
      zotero_note = function(picker, item)
        if item then
          picker:close()
          vim.schedule(function()
            M.open_or_create_note(item)
          end)
        end
      end,
      zotero_yank = function(picker, item)
        if item then
          M.copy_key(item.key)
          picker:close()
        end
      end,
    },
    win = {
      input = {
        keys = {
          -- plain letters in normal mode (insert mode still types for search)
          ["o"] = { "zotero_pdf", mode = "n" },
          ["n"] = { "zotero_note", mode = "n" },
          ["y"] = { "zotero_yank", mode = "n" },
        },
      },
      list = {
        keys = {
          ["o"] = "zotero_pdf",
          ["n"] = "zotero_note",
          ["y"] = "zotero_yank",
        },
      },
    },
    format = function(item)
      local a = item.author ~= "" and (" — " .. item.author) or ""
      local y = item.year ~= "" and (" (" .. item.year .. ")") or ""
      return {
        { item.key, "Title" },
        { "  " },
        { item.title, "Comment" },
        { a .. y, "Comment" },
      }
    end,
  })
end

---Insert citation via picker.
function M.pick_citation()
  M.pick({ action = "insert" })
end

---Open the paper for the current context (cursor citekey or note's citekey),
---else pick.
function M.open_pdf_at_cursor()
  local key = M.current_citekey()
  if key then
    M.open_pdf(M.entry(key) or { key = key })
  else
    M.pick({ action = "pdf" })
  end
end

---Open note for the current context (cursor citekey or note's citekey), else
---pick (open or create).
function M.open_note_at_cursor()
  local key = M.current_citekey()
  if key then
    M.open_or_create_note(M.entry(key) or { key = key })
  else
    M.pick({ action = "note" })
  end
end

-- Rendering (Phase 5) --------------------------------------------------------

-- Annotation colour -> type mapping. This is the SINGLE source of truth for how
-- nvim renders Zotero highlights. Edit freely to match your conventions.
-- `hex` is Zotero's default palette; `name` is the callout label.
M.annotation_colors = {
  { name = "disagreement", hex = "#ff6666", emoji = "❌", heading = "Disagreements / Critique" },
  { name = "caveat", hex = "#f19837", emoji = "⚠️", heading = "Caveats & Limitations" },
  { name = "definition", hex = "#ffd400", emoji = "ℹ️", heading = "Definitions & Concepts" },
  { name = "keypoint", hex = "#5fb236", emoji = "⭐", heading = "Key Points" },
  { name = "methodology", hex = "#2ea8e5", emoji = "🧪", heading = "Methodology" },
  { name = "connection", hex = "#a28ae5", emoji = "🔗", heading = "Connections & Related Work" },
  { name = "idea", hex = "#e56eee", emoji = "💡", heading = "Ideas & Questions" },
  { name = "reference", hex = "#aaaaaa", emoji = "📚", heading = "References / Follow-up" },
}

-- Extra hexes (PDF++/template variants) mapped to the same type names.
local HEX_ALIASES = {
  ["#ea5252"] = "disagreement",
  ["#ff0000"] = "disagreement",
  ["#ffa500"] = "caveat",
  ["#ffd700"] = "definition",
  ["#ffff00"] = "definition",
  ["#ffe600"] = "definition",
  ["#51c7a0"] = "keypoint",
  ["#00ff00"] = "keypoint",
  ["#086ddd"] = "methodology",
  ["#cee2f8"] = "methodology",
  ["#0000ff"] = "methodology",
  ["#c586c0"] = "connection",
  ["#800080"] = "connection",
  ["#ff7eb3"] = "idea",
  ["#ff00ff"] = "idea",
  ["#a0a0a0"] = "reference",
  ["#808080"] = "reference",
}

local OTHER = { name = "other", emoji = "📝", heading = "Other Highlights" }

---Resolve an annotation colour hex to a type name.
---@param hex string|nil
---@return string
local function color_name(hex)
  hex = (hex or ""):lower()
  for _, c in ipairs(M.annotation_colors) do
    if c.hex == hex then
      return c.name
    end
  end
  return HEX_ALIASES[hex] or "other"
end

---Ordered categories (configured colours, then the "other" bucket).
---@return table[]
local function categories()
  local out = {}
  for _, c in ipairs(M.annotation_colors) do
    out[#out + 1] = c
  end
  out[#out + 1] = OTHER
  return out
end

---Markdown table describing the colour -> type convention.
---@return string
function M.annotation_legend()
  local out = { "| Color | Type |", "|:-----:|------|" }
  for _, c in ipairs(M.annotation_colors) do
    out[#out + 1] = ("| %s | %s |"):format(c.emoji, c.heading)
  end
  return table.concat(out, "\n")
end

local ANNOT_START = "<!-- zotero:annotations:start -->"
local ANNOT_END = "<!-- zotero:annotations:end -->"

---Zotero URI to open a paper's PDF (falls back to selecting the item).
---@param d table item_data result
---@return string
local function pdf_uri(d)
  if d.attachKey and d.attachKey ~= "" then
    return "zotero://open-pdf/library/items/" .. d.attachKey
  end
  return d.desktopURI
end

---Render the color-grouped annotations section.
---@param annots table[]
---@param pdf_uri string Zotero URI for the PDF (deep-links get page/annotation)
---@return string
function M.render_annotations(annots, pdf_uri)
  local by_name = {}
  for _, a in ipairs(annots) do
    local n = color_name(a.color)
    by_name[n] = by_name[n] or {}
    table.insert(by_name[n], a)
  end
  local out, any = {}, false
  for _, c in ipairs(categories()) do
    local list = by_name[c.name]
    if list and #list > 0 then
      any = true
      out[#out + 1] = "### " .. c.emoji .. " " .. c.heading
      out[#out + 1] = ""
      for _, a in ipairs(list) do
        local text = (a.text or ""):gsub("\n", " ")
        local page = a.page or ""
        out[#out + 1] = "> " .. text
        if pdf_uri:find("zotero://open-pdf", 1, true) then
          out[#out + 1] = ("**<u>[📍 p. %s](%s?page=%s&annotation=%s)</u>**"):format(page, pdf_uri, page, a.key or "")
        else
          out[#out + 1] = ("**<u>📍 p. %s</u>**"):format(page)
        end
        if a.comment and a.comment ~= "" then
          out[#out + 1] = ""
          out[#out + 1] = "**Note:** " .. (a.comment:gsub("\n", " "))
        end
        out[#out + 1] = ""
      end
    end
  end
  if not any then
    out[#out + 1] = "*No annotations yet. Add highlights and notes in Zotero, then re-import this note.*"
    out[#out + 1] = ""
  end
  return table.concat(out, "\n")
end

---Full note text for a citekey (template-compatible structure).
---@param citekey string
---@return string|nil
function M.render_note(citekey)
  local d = M.item_data(citekey)
  if not d then
    return nil
  end
  local uri = pdf_uri(d)
  local fm = table.concat({
    "---",
    "title: " .. d.title,
    "citekey: " .. citekey,
    "authors: " .. table.concat(d.authors, ", "),
    "year: " .. d.year,
    "publication: " .. d.publication,
    "doi: " .. d.doi,
    "url: " .. d.url,
    "type: " .. d.itemType,
    "tags:",
    " - literature",
    " - status/unread",
    "date-added: " .. d.dateAdded,
    'pdf: "' .. uri .. '"',
    "zotero-link: " .. d.desktopURI,
    "rating:",
    "cssclasses: literature-note",
    "---",
    "",
    "# 📄 " .. d.title,
    "",
    "> [!abstract]- Abstract",
    "> " .. (d.abstract ~= "" and (d.abstract:gsub("\n", "\n> ")) or ""),
    "",
    "## 🧠 Summary & Notes",
    "",
    '{% persist "summary" %}',
    "{% endpersist %}",
    "",
    "## 🖍️ Annotations",
    "",
    ANNOT_START,
    M.render_annotations(M.annotations(citekey), uri),
    ANNOT_END,
    "",
    "### 🗂️ Annotation Legend",
    "",
    M.annotation_legend(),
    "",
    "## 🔗 References",
    "",
    "- **Cite Key:** `" .. citekey .. "`",
    "- **Zotero:** " .. d.desktopURI,
    "",
  }, "\n")
  return fm
end

---Preserve `{% persist "id" %}…{% endpersist %}` blocks from an existing note.
---@param new_text string
---@param old_text? string
---@return string
function M.merge_persist(new_text, old_text)
  if not old_text or old_text == "" then
    return new_text
  end
  local old = {}
  for id, body in old_text:gmatch('{%% persist "([^"]+)" %%}(.-){%% endpersist %%}') do
    old[id] = body
  end
  return (new_text:gsub('({%% persist "([^"]+)" %%})(.-)({%% endpersist %%})', function(a, id, default, b)
    local prev = old[id]
    if prev and prev:match("%S") then
      return a .. prev .. b
    end
    return a .. default .. b
  end))
end

---@param name string
---@return string
local function notes_dir_for(name)
  local function pick(cand)
    if not cand or cand == "" then
      return nil
    end
    local resolved = uv.fs_realpath(cand) or cand
    for _, v in ipairs(M.vaults) do
      local root = uv.fs_realpath(v) or v
      if resolved:sub(1, #root) == root then
        return v .. "/" .. M.notes_subdir
      end
    end
    return nil
  end
  return pick(name) or pick(vim.fn.getcwd()) or (M.vaults[1] .. "/" .. M.notes_subdir)
end

---Create or refresh the literature note for a citekey.
---@param citekey? string
function M.create_note(citekey)
  citekey = citekey or M.current_citekey()
  if not citekey or citekey == "" then
    vim.notify("ZoteroNote: no citekey", vim.log.levels.WARN)
    return
  end
  local text = M.render_note(citekey)
  if not text then
    vim.notify("ZoteroNote: citekey not found in Zotero DB: " .. citekey, vim.log.levels.WARN)
    return
  end
  local dir = notes_dir_for(vim.api.nvim_buf_get_name(0))
  vim.fn.mkdir(dir, "p")
  local path = M.resolve_note(citekey) or (dir .. "/" .. citekey .. ".md")
  local old
  if uv.fs_stat(path) then
    old = table.concat(vim.fn.readfile(path), "\n")
  end
  text = M.merge_persist(text, old)
  vim.fn.writefile(vim.split(text, "\n", { plain = true }), path)
  vim.cmd.edit(vim.fn.fnameescape(path))
  vim.notify("ZoteroNote: wrote " .. path, vim.log.levels.INFO)
end

M.refreshing = false

---Refresh only the managed annotations region of a note buffer (region-scoped,
---so manual notes elsewhere are untouched).
---@param buf? integer
function M.refresh_annotations(buf)
  buf = buf or vim.api.nvim_get_current_buf()
  if not vim.api.nvim_buf_is_valid(buf) then
    return
  end
  local lines = vim.api.nvim_buf_get_lines(buf, 0, -1, false)
  local key = table.concat(lines, "\n"):match("citekey:%s*([^\n]+)")
  if not key then
    return
  end
  key = key:gsub("%s+$", "")
  local start_i, end_i
  for i, l in ipairs(lines) do
    if l:find(ANNOT_START, 1, true) then
      start_i = i
    end
    if l:find(ANNOT_END, 1, true) then
      end_i = i
    end
  end
  if not (start_i and end_i and end_i > start_i) then
    return
  end
  local d = M.item_data(key)
  if not d then
    return
  end
  local section = vim.split(
    M.render_annotations(M.annotations(key), pdf_uri(d)),
    "\n",
    { plain = true }
  )
  local mid = {}
  for i = start_i + 1, end_i - 1 do
    mid[#mid + 1] = lines[i]
  end
  if table.concat(mid, "\n") == table.concat(section, "\n") then
    return
  end
  local new = {}
  for i = 1, start_i do
    new[#new + 1] = lines[i]
  end
  vim.list_extend(new, section)
  for i = end_i, #lines do
    new[#new + 1] = lines[i]
  end
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, new)
end

---Insert the annotations for the citekey under the cursor at the cursor.
function M.insert_annotations()
  local key = M.current_citekey()
  if not key then
    vim.notify("Zotero: no citekey under cursor", vim.log.levels.WARN)
    return
  end
  local annots = M.annotations(key)
  if #annots == 0 then
    vim.notify("Zotero: no annotations for " .. key, vim.log.levels.WARN)
    return
  end
  local d = M.item_data(key)
  local section = vim.split(
    M.render_annotations(annots, d and pdf_uri(d) or ""),
    "\n",
    { plain = true }
  )
  local line = vim.api.nvim_win_get_cursor(0)[1]
  vim.api.nvim_buf_set_lines(0, line, line, false, section)
end

-- OpenCode handoff -------------------------------------------------------------
---tmux window name for an item: "Title — Surname Year", sanitized + truncated.
---@param d table
---@return string
local function tmux_window_name(d)
  local author = ((d.authors and d.authors[1]) or ""):match("^([^,]+)") or ""
  local name = string.format("%s — %s %s", d.title or "", author, d.year or "")
  name = name:gsub("[%c\"'\\]", " "):gsub("%s+", " ")
  name = name:gsub("^%s+", ""):gsub("%s+$", "")
  if #name > 60 then
    name = name:sub(1, 57) .. "..."
  end
  return name
end

---Open opencode with the `paper` agent in a new tmux window of the current
---session, named after the paper, pre-seeded with the citekey + note path.
---opencode runs in the vault root so the note is inside its worktree.
---@param question? string
function M.ask_opencode(question)
  if not vim.env.TMUX or vim.fn.executable("tmux") ~= 1 then
    vim.notify("Zotero: opencode handoff requires tmux", vim.log.levels.WARN)
    return
  end
  local key = M.current_citekey()
  if not key or key == "" then
    vim.notify(
      "Zotero: no citekey here — put the cursor on a citation or open a literature note",
      vim.log.levels.WARN
    )
    return
  end
  local note = M.resolve_note(key)
  local d = M.item_data(key)
  local vault = M.vaults[1]
  if note then
    vault = vim.fn.fnamemodify(note, ":h:h:h") -- notes dir → papers dir → vault
  end

  local msg = "I'm asking about the paper with citekey " .. key .. "."
  if note then
    msg = msg .. " My literature note (read it first): " .. note
  end
  if d and d.title and d.title ~= "" then
    msg = msg .. ". Title: " .. d.title
  end
  if question and question ~= "" then
    msg = msg .. ". Question: " .. question
  end

  local name = (d and d.title and d.title ~= "") and tmux_window_name(d) or ("opencode " .. key)
  -- new-window runs its shell-command via sh, so the seed message needs escaping
  local cli = "opencode --agent paper " .. vim.fn.shellescape(msg)
  local out = vim.fn.system({
    "tmux", "new-window", "-P", "-F", "#{pane_id}",
    "-c", vault, "-n", name, cli,
  })
  if vim.v.shell_error ~= 0 then
    vim.notify("Zotero: tmux new-window failed:\n" .. vim.trim(out), vim.log.levels.ERROR)
    return
  end
  -- keep the paper's name; tmux-nerd-font-window-name / tmux renames otherwise
  vim.fn.system({ "tmux", "set-option", "-w", "-t", vim.trim(out), "automatic-rename", "off" })
  vim.notify("Zotero: opened opencode (paper agent) in a new tmux window", vim.log.levels.INFO)
end

---Register the `:ZoteroNote` command and the region-refresh autocmd.
function M.setup()
  vim.api.nvim_create_user_command("ZoteroNote", function(a)
    M.create_note(a.args ~= "" and a.args or nil)
  end, { nargs = "?", desc = "Create/refresh a Zotero literature note" })

  vim.api.nvim_create_user_command("ZoteroAsk", function(a)
    M.ask_opencode(a.args ~= "" and a.args or nil)
  end, { nargs = "?", desc = "Ask opencode's paper agent about this paper (new tmux window)" })

  local grp = vim.api.nvim_create_augroup("ZoteroNotes", { clear = true })
  vim.api.nvim_create_autocmd({ "BufWritePost", "FocusGained" }, {
    group = grp,
    callback = function(ev)
      local buf = (ev and ev.buf and ev.buf ~= 0) and ev.buf or vim.api.nvim_get_current_buf()
      if M.refreshing or not vim.api.nvim_buf_is_valid(buf) then
        return
      end
      local name = vim.api.nvim_buf_get_name(buf)
      if name == "" then
        return
      end
      local is_note = false
      for _, v in ipairs(M.vaults) do
        if name:find(v .. "/" .. M.notes_subdir, 1, true) then
          is_note = true
          break
        end
      end
      if not is_note then
        return
      end
      M.refreshing = true
      vim.schedule(function()
        pcall(M.refresh_annotations, buf)
        M.refreshing = false
      end)
    end,
  })
end

return M
