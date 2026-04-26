return {
  "olimorris/codecompanion.nvim",
  version = "^19.0.0",
  dependencies = {
    "franco-ruggeri/codecompanion-spinner.nvim",
    "j-hui/fidget.nvim",
    "nvim-lua/plenary.nvim",
    "nvim-treesitter/nvim-treesitter",
    "ravitemer/mcphub.nvim",
  },
  init = function()
    require("plugins.codecompanion.fidget-spinner"):init()
  end,
  config = function()
    require("codecompanion").setup({
      interactions = {
        chat = {
          editor_context = {
            ["buffer"] = {
              opts = {
                -- always sync the buffer by sharing its "diff"
                -- or choose "all" to share the entire buffer
                default_params = "diff",
              },
            },
          },
        },
      },
      display = {
        chat = {
          separator = "---", -- separator between messages
          show_settings = true, -- show buffer settings at the top of the companion buffer
          start_in_insert_mode = true,
          icons = {
            buffer_sync_all = "󰪴 ",
            buffer_sync_diff = " ",
            chat_context = " ",
            chat_fold = " ",
            tool_pending = "  ",
            tool_in_progress = "  ",
            tool_failure = "  ",
            tool_success = "  ",
          },
          window = {
            border = "rounded",
            layout = "float",
            -- ensure that long paragraphs of markdown are wrapped
            opts = {
              breakindent = true,
              linebreak = true,
              wrap = true,
            },
          },
          floating_window = {
            ---@return number|fun(): number
            width = function()
              return vim.o.columns - 5
            end,
            ---@return number|fun(): number
            height = function()
              return vim.o.lines - 2
            end,
            row = "center",
            col = "center",
            relative = "editor",
            opts = {
              wrap = false,
              number = false,
              relativenumber = false,
            },
          },
          fold_context = true,
        },
      },
      extensions = {
        spinner = {},
        mcphub = {
          callback = "mcphub.extensions.codecompanion",
          opts = {
            make_vars = true,
            make_slash_commands = true,
            show_result_in_chat = true,
          },
        },
        -- interactions = {
        --   chat = {
        --     tools = {
        --       ["grep_search"] = {
        --         ---@param adapter CodeCompanion.HTTPAdapter
        --         ---@return boolean
        --         enabled = function(adapter)
        --           return vim.fn.executable("rg") == 1
        --         end,
        --       },
        --     },
        --   },
        -- },
      },
      strategies = {
        chat = {
          adapter = "openrouter",
        },
        inline = {
          adapter = "openrouter",
        },
      },
      adapters = {
        http = {
          openrouter = function()
            return require("codecompanion.adapters").extend("openai_compatible", {
              name = "openrouter",
              formatted_name = "OpenRouter",
              env = {
                url = "https://openrouter.ai/api",
                api_key = "cmd:gpg --quiet --decrypt ~/.config/openrouter-key.gpg 2>/dev/null",
                chat_url = "/v1/chat/completions",
              },
              schema = {
                model = {
                  -- preferred OpenRouter model's ID
                  default = "deepseek/deepseek-v3.2",
                  choices = {
                    -- models list with cost per 1m input tokens / cost per 1m output tokens

                    -- Chinese models
                    ["deepseek/deepseek-chat-v3.1"] = {}, -- $0.15 / $0.75
                    ["deepseek/deepseek-v3.1-terminus"] = {}, -- $0.21 / $0.79
                    ["deepseek/deepseek-v3.2"] = {}, -- $0.25 / $0.40
                    ["moonshotai/kimi-k2.5"] = {}, -- $0.45 / $2.20
                    ["qwen/qwen3-235b-a22b-2507"] = {}, -- $0.071 / 0.10
                    ["qwen/qwen3-coder-next"] = {}, -- $0.12 / $0.75
                    ["stepfun/step-3.5-flash:free"] = {}, -- $0 / $0
                    ["z-ai/glm-5"] = {}, -- $0.95 / $2.55
                    ["z-ai/glm-4.7"] = {}, -- $0.30 / $1.40
                    ["z-ai/glm-4.5-air:free"] = {}, -- $0 / $0

                    -- French models
                    ["mistralai/mistral-nemo"] = {}, -- $0.02 / $0.04
                    ["mistralai/mistral-small-3.2-24b-instruct"] = {}, -- $0.06 / $0.18
                  },
                },
              },
            })
          end,
        },
      },
    })

    vim.keymap.set("v", "ga", "<cmd>CodeCompanionChat Add<cr>", { noremap = true, silent = true })

    -- expand 'cc' into 'CodeCompanion' in the command line
    vim.cmd([[cab cc CodeCompanion]])
  end,
}
