-- Zotero integration: citation picker + insert, open PDF (Sioyek), open note.
-- Bibliography is a Better BibTeX auto-export consumed offline.
-- See nvim/zotero-setup.md for the full plan.

local M = {}

local uv = vim.uv or vim.loop

-- Paths ----------------------------------------------------------------------
local DATA_DIR = vim.fn.expand("~/climate-crisis/research-papers/organization-tools/zotero")
M.bib_file = DATA_DIR .. "/exports/library.bib"
M.zotero_db = DATA_DIR .. "/zotero.sqlite"

-- BBT `file` field is often relative; resolve against this base.
-- (currently the linked ProtonDrive dir; changes to Zotero storage after the
-- storage migration — see the plan.)
M.base_attachment_path = vim.fn.expand(
  "~/Library/CloudStorage/ProtonDrive-cristianoronaldo0007@pm.me-folder/research-papers/pdfs"
)

M.vaults = {
  vim.fn.expand("~/vaults/climate-crisis"),
  vim.fn.expand("~/vaults/personal"),
}
M.notes_subdir = "research-papers-🔬/notes"
M.pdfs_subdir = "research-papers-🔬/pdfs"

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

local function sioyek(path)
  vim.fn.jobstart({ "sioyek", "--new-window", path }, { detach = true })
end

---Resolve a PDF path from the BBT `file` field.
---@param entry table
---@return string|nil
function M.resolve_pdf(entry)
  local file = entry.file
  if file and file ~= "" then
    -- BBT: file = {Title:relative/path.pdf:application/pdf} (may repeat)
    local path = file:match("^[^:]*:(.-):application/pdf") or file:match(":(.-):application/pdf")
    if path and path ~= "" then
      path = path:gsub("\\\\", "/")
      if not path:match("^/") then
        path = M.base_attachment_path .. "/" .. path
      end
      if uv.fs_stat(path) then
        return path
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
---is where annotations are made. Falls back to Sioyek via the BBT file field.
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
  local path = M.resolve_pdf(entry)
  if path then
    sioyek(path)
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
          ["<c-o>"] = { "zotero_pdf", mode = { "n", "i" } },
          ["<c-n>"] = { "zotero_note", mode = { "n", "i" } },
          ["<c-y>"] = { "zotero_yank", mode = { "n", "i" } },
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

---Open PDF for the citekey under the cursor, else pick.
function M.open_pdf_at_cursor()
  local key = M.key_under_cursor()
  local entry = key and M.entry(key)
  if entry then
    M.open_pdf(entry)
  else
    M.pick({ action = "pdf" })
  end
end

---Open note for the citekey under the cursor, else pick (open or create).
function M.open_note_at_cursor()
  local key = M.key_under_cursor()
  local entry = key and M.entry(key)
  if entry then
    M.open_or_create_note(entry)
  else
    M.pick({ action = "note" })
  end
end

-- Rendering (Phase 5) --------------------------------------------------------

local ANNOT_CATEGORIES = {
  { name = "yellow", heading = "⭐ Main Claims & Key Points" },
  { name = "red", heading = "❌ Disagree / Limitations" },
  { name = "green", heading = "✅ Methodology / Core Quotes" },
  { name = "blue", heading = "ℹ️ Definitions & Concepts" },
  { name = "purple", heading = "🔗 Connections & Future Work" },
  { name = "magenta", heading = "💡 Research Ideas" },
  { name = "orange", heading = "#️⃣ Section Headers" },
  { name = "gray", heading = "📚 References to Follow Up" },
}

-- Map annotation colours (Zotero defaults + the template's PDF++ hexes) to the
-- template's category names.
local COLOR_ALIASES = {
  ["#ffd400"] = "yellow",
  ["#ffd700"] = "yellow",
  ["#ffff00"] = "yellow",
  ["#ffe600"] = "yellow",
  ["#ff6666"] = "red",
  ["#ea5252"] = "red",
  ["#ff0000"] = "red",
  ["#5fb236"] = "green",
  ["#51c7a0"] = "green",
  ["#00ff00"] = "green",
  ["#2ea8e5"] = "blue",
  ["#086ddd"] = "blue",
  ["#cee2f8"] = "blue",
  ["#0000ff"] = "blue",
  ["#a28ae5"] = "purple",
  ["#c586c0"] = "purple",
  ["#800080"] = "purple",
  ["#e56eee"] = "magenta",
  ["#ff7eb3"] = "magenta",
  ["#ff00ff"] = "magenta",
  ["#f19837"] = "orange",
  ["#ffa500"] = "orange",
  ["#aaaaaa"] = "gray",
  ["#a0a0a0"] = "gray",
  ["#808080"] = "gray",
}

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
  local by_cat = {}
  for _, a in ipairs(annots) do
    local cat = COLOR_ALIASES[((a.color or ""):lower())] or "gray"
    by_cat[cat] = by_cat[cat] or {}
    table.insert(by_cat[cat], a)
  end
  local out, any = {}, false
  for _, c in ipairs(ANNOT_CATEGORIES) do
    local list = by_cat[c.name]
    if list and #list > 0 then
      any = true
      out[#out + 1] = "### " .. c.heading
      out[#out + 1] = ""
      for _, a in ipairs(list) do
        local text = (a.text or ""):gsub("\n", " ")
        local page = a.page or ""
        out[#out + 1] = "> [!annotation-" .. c.name .. "]- Quote"
        out[#out + 1] = "> " .. text
        out[#out + 1] = ">"
        if pdf_uri:find("zotero://open-pdf", 1, true) then
          out[#out + 1] = ("> [📍 p. %s](%s?page=%s&annotation=%s)"):format(page, pdf_uri, page, a.key or "")
        else
          out[#out + 1] = ("> 📍 p. %s"):format(page)
        end
        if a.comment and a.comment ~= "" then
          out[#out + 1] = ">"
          out[#out + 1] = "> **Note:** " .. (a.comment:gsub("\n", " "))
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
  for _, cand in ipairs({ name, vim.fn.getcwd() }) do
    for _, v in ipairs(M.vaults) do
      if cand ~= "" and cand:find(v, 1, true) then
        return v .. "/" .. M.notes_subdir
      end
    end
  end
  return M.vaults[1] .. "/" .. M.notes_subdir
end

---Create or refresh the literature note for a citekey.
---@param citekey? string
function M.create_note(citekey)
  citekey = citekey or M.key_under_cursor()
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
  local key = M.key_under_cursor()
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

---Register the `:ZoteroNote` command and the region-refresh autocmd.
function M.setup()
  vim.api.nvim_create_user_command("ZoteroNote", function(a)
    M.create_note(a.args ~= "" and a.args or nil)
  end, { nargs = "?", desc = "Create/refresh a Zotero literature note" })

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
