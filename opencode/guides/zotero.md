
# Zotero - Opencode setup

No CLIs were added to your PATH — each extra is a **Python library inside the `zotero-mcp-server` uv venv** (`~/.local/share/uv/tools/zotero-mcp-server/...`). opencode calls `zotero-cli`, which calls the libs; you never invoke a PDF/vector tool directly. (The venv does ship helper executables like `pymupdf`, `chroma`, `hf` — but they're inside the venv, not exported.)

## `pdf` → PyMuPDF (`pymupdf 1.28.2`)
- A PDF engine (the MuPDF C library is compiled into the wheel — no external `mutool` needed). It parses PDFs and **rasterizes pages/clip-rects to PNG** and finds figure/table/equation boxes.
- Backs `zotero-cli outline`, `layout`, and `read --format image`.
- **How opencode "interprets figures":** PyMuPDF just produces a PNG on disk; opencode's `read` tool loads that PNG as an image, and the **model** interprets it. So image rendering needs a **vision-capable model** — PyMuPDF doesn't analyze the figure itself.

## `semantic` → ChromaDB + an embedding model
- **ChromaDB 1.5.9** (vector store) + **ONNX Runtime**, with the default embedding function = **`all-MiniLM-L6-v2`** (a small sentence-transformer, CPU/ONNX). Also installed for other providers: **sentence-transformers 6.1.0**, **transformers 5.17.0**, **PyTorch 2.14.0**, `tokenizers`, `scikit-learn`, `scipy`.
- Provider options (`zotero_mcp/embeddings/registry.py`): `default` (MiniLM), `openai` (`text-embedding-3-small`), `gemini` (`gemini-embedding-001`), `ollama` (`qwen3-embedding`), `huggingface` (`Qwen/Qwen3-Embedding-0.6B`).
- **How "semantic interpretation" works:** the library embeds each item into a vector and stores it in Chroma; `search --mode semantic` embeds your query and does nearest-neighbour search. The LLM reasons over the returned items — it doesn't compute embeddings.

## Current state — you're already indexed
`zotero-cli db status` shows the semantic DB is **built**:
```
Collection: zotero_library   Document count: 121
Embedding model: default
Database path: ~/.config/zotero-mcp/chroma_db   (3.2 MB)
Auto update: True (on startup)   Last update: 2026-09-29
```
So semantic search is ready now (auto-updates on startup); the default MiniLM model was fetched automatically. (The `pdftoppm` you'll see on PATH is unrelated Homebrew poppler.)

So in short: **PyMuPDF** = render/geometry for figures; **ChromaDB + MiniLM (ONNX)** = local embeddings for meaning-based search. Neither is a standalone CLI, and figure *understanding* still depends on a multimodal model.
