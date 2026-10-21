-- CodeCompanion.nvim — an in-editor LLM chat/inline interface, on OpenRouter.
--
-- Pinned to the v19 release line on purpose. The plugin ships breaking config
-- changes between majors (`strategies` -> `interactions` in v18; `openai` and
-- `gemini` moved to new APIs in v20), and `main` is already ahead of the docs
-- you'll find online. Read `:help codecompanion-upgrading` before bumping this.
--
-- Auth: the built-in `openrouter` adapter resolves its `env.api_key` from the
-- `OPENROUTER_API_KEY` environment variable on every request. Put the key in
-- `~/.config/secrets.zsh` (gitignored; see zsh/README.md) and this works with
-- no further config. To keep the key out of the environment entirely, see the
-- Keychain/pass/file alternatives in the comment below `opts`.
--
-- Only OpenRouter is configured, so everything else is pared away: the bundled
-- adapters (anthropic, gemini, copilot, the *_cli agents, ...) are dropped from
-- the adapter picker, and the model picker lists only the ids in MODELS below
-- instead of OpenRouter's whole ~400-model catalogue. Nothing is unreachable --
-- a hidden adapter or model can still be used by name, e.g.
--   :CodeCompanionChat adapter=anthropic model=claude-sonnet-5
--
-- This sits next to opencode (`<leader>o`) rather than replacing it: opencode
-- is the agentic/tool-driven flow, CodeCompanion is the lighter "ask about this
-- selection / this buffer" flow.
--
-- Default model: OpenRouter's `~<family>-latest` aliases redirect to whichever
-- model is newest in that family, so this keeps tracking upstream releases
-- without config edits (the alias itself is stable). `deepseek/deepseek-v4.1-flash`
-- is the newer V4.1 line -- the same model Paratera serves as DeepSeek-V4.1-Flash
-- -- if you'd rather pin that instead.
local MODEL = "~deepseek/deepseek-v4-flash-latest"

-- The only models offered by the pickers (`<leader>am`, and `ga` inside a chat
-- buffer). Keyed by id, labelled for display. The live catalogue is still
-- consulted, so each id keeps its real capabilities (tools, vision, reasoning);
-- anything not listed here is simply not offered by the picker.
local MODELS = {
  [MODEL] = "DeepSeek V4 Flash (latest)",
  ["deepseek/deepseek-v4.1-flash"] = "DeepSeek V4.1 Flash",
  ["deepseek/deepseek-v4-pro"] = "DeepSeek V4 Pro",
}

-- Run `fn(chat)` against this buffer's chat, else the last visible one. Neither
-- exists on a cold start, so open one first: that way model switching works
-- from anywhere rather than only from inside a chat buffer.
local function with_chat(fn)
  local cc = require("codecompanion")
  local chat = cc.buf_get_chat(0) or cc.last_chat()
  if not chat then
    vim.cmd("CodeCompanionChat")
    chat = cc.buf_get_chat(0) or cc.last_chat()
  end
  if chat then
    fn(chat)
  end
end

-- The pickers behind the chat buffer's `ga` keymap. Internal to the plugin, but
-- the pin to v19 makes the path safe; `select_model` renders
-- `schema.model.choices`, which is why the filter below lives there.
local function pickers()
  return require("codecompanion.interactions.chat.keymaps.change_adapter")
end

return {
  {
    "olimorris/codecompanion.nvim",
    version = "^19.0.0",
    -- Every entry point is a command, so nothing loads until it's first used.
    cmd = {
      "CodeCompanion",
      "CodeCompanionChat",
      "CodeCompanionCodeReview",
      "CodeCompanionActions",
      "CodeCompanionCmd",
    },
    dependencies = {
      "nvim-lua/plenary.nvim",
      "nvim-treesitter/nvim-treesitter", -- yaml parser, for the prompt library
      "MeanderingProgrammer/render-markdown.nvim", -- renders the chat buffer
    },
    -- The AI menu. `keys` double as the lazy-load trigger, so these maps work
    -- on a cold start without pulling the plugin in at startup.
    keys = {
      { "<leader>aa", "<cmd>CodeCompanionActions<cr>", mode = { "n", "v" }, desc = "Actions" },
      { "<leader>ac", "<cmd>CodeCompanionChat Toggle<cr>", mode = { "n", "v" }, desc = "Toggle Chat" },
      { "<leader>an", "<cmd>CodeCompanionChat<cr>", mode = { "n", "v" }, desc = "New Chat" },
      -- `:` rather than <cmd> so visual mode gets the '<,'> range injected
      { "<leader>ai", ":CodeCompanion<cr>", mode = { "n", "v" }, desc = "Inline Prompt" },
      { "<leader>ad", "<cmd>CodeCompanionChat Add<cr>", mode = "v", desc = "Add Selection to Chat" },
      {
        "<leader>am",
        function()
          with_chat(function(chat)
            pickers().select_model(chat)
          end)
        end,
        desc = "Select Model",
      },
      {
        "<leader>aM",
        function()
          with_chat(function(chat)
            pickers().callback(chat)
          end)
        end,
        desc = "Select Adapter + Model",
      },
      { "<leader>ar", "<cmd>CodeCompanionCodeReview<cr>", desc = "Code Review" },
    },
    ---@module 'codecompanion'
    ---@type CodeCompanion.Config
    opts = {
      adapters = {
        http = {
          -- Only list adapters defined in this file. The presets stay usable by
          -- name (`:CodeCompanionChat adapter=anthropic`), they're just not
          -- offered anywhere -- which also covers the `duckduckgo`/`markitdown`
          -- adapters wired into the web search and fetch tools.
          opts = { show_presets = false },

          openrouter = function()
            local adapter = require("codecompanion.adapters").extend("openrouter", {})

            -- `choices` drives the model picker and the adapter's own capability
            -- checks, so narrow it to MODELS. The catalogue is fetched as usual
            -- (and cached); we only keep the entries we listed, taking the live
            -- entry for each so tools/vision/reasoning stay accurate.
            local catalogue = adapter.schema.model.choices
            adapter.schema.model.choices = function(self, choices_opts)
              local all = catalogue(self, choices_opts) or {}
              local kept = {}

              for id, label in pairs(MODELS) do
                -- keep the live entry, but with our own short label
                kept[id] = vim.tbl_extend("force", all[id] or {}, { formatted_name = label })
              end

              -- never hide the model actually in use, so an explicitly chosen
              -- one-off id still resolves its capabilities
              local current = self.schema.model.default
              if type(current) == "string" and all[current] and not kept[current] then
                kept[current] = all[current]
              end

              return kept
            end

            return adapter
          end,
        },
        acp = {
          -- the agent presets (claude_code, codex, opencode, ...)
          opts = { show_presets = false },
        },
      },
      interactions = {
        chat = {
          adapter = { name = "openrouter", model = MODEL },
        },
        inline = {
          -- inline edits a buffer in place via a tool call, so it needs a model
          -- that supports tool use (DeepSeek Flash does)
          adapter = { name = "openrouter", model = MODEL },
        },
        -- `:CodeCompanionCmd` and the background tasks (chat titles, the tool
        -- auto-approval "judge" gate) both default to Copilot, which isn't set
        -- up here -- without this they'd fail against a provider you don't have
        cmd = {
          adapter = { name = "openrouter", model = MODEL },
        },
        background = {
          adapter = { name = "openrouter", model = MODEL },
        },
      },
      display = {
        -- match the snacks pickers used elsewhere in this config
        action_palette = {
          provider = "snacks",
        },
        chat = {
          window = {
            layout = "vertical",
            position = "right",
            width = 0.35,
            full_height = true,
          },
        },
      },
    },
  },
  -- To read the key from somewhere other than the environment, add this to the
  -- spec above. The adapter resolves `env.api_key` on every request, so the
  -- command runs per request (20s timeout):
  --
  --   adapters = {
  --     http = {
  --       openrouter = function()
  --         return require("codecompanion.adapters").extend("openrouter", {
  --           env = {
  --             -- macOS Keychain. Create the item once (prompts for the value,
  --             -- keeps it out of your shell history):
  --             --   security add-generic-password -a "$USER" -s openrouter-api-key -w
  --             api_key = "cmd:security find-generic-password -s openrouter-api-key -w",
  --             -- or pass(1):
  --             --   api_key = "cmd:pass show openrouter/api-key",
  --             -- or a mode-600 file:
  --             --   api_key = "file:~/.config/openrouter_api_key",
  --           },
  --         })
  --       end,
  --     },
  --   },
}
