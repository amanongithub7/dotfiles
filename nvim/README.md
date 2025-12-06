# 📟 NeoVim Configuration

This is my [LazyVim][] configuration for [NeoVim][].

NeoVim, a hyper-customizable [Vim][], has a steep learning curve but offers:

- rapid mouse-free buffer editing
- a rich open-source plugin ecosystem
- a deep understanding of code development utilities such as:
  - tree-sitters
  - linters
  - language server protocols

## 💻 Usage

If you are on MacOS, you may install some necessary dependencies by running `init.sh`:

```bash
chmod +x init.sh
./init.sh
```

Refer to the [LazyVim documentation][] to get started with your setup.

## 🗂️ Directory Structure

The default installation of NeoVim expects its configuration files to live inside
`~/.config/nvim/`, where `~` is the root directory of a user with NeoVim installed.

I use a symlink to re-direct access of `~/.config/nvim/` to my local `dotfiles`
git repository.

```bash
nvim/
├─ lazy.nvim/    # DO NOT TOUCH: this directory is used by LazyVim to store
│                # downloaded plugins (and will be unique to your plugin setup)
├─ lua
│  ├─ config/    # configuration for LazyVim, keybinds, etc.
│  └─ plugins/   # 3rd party plugins and their configurations
├─ init.lua      # LazyVim's starting point for the custom configuration
├─ init.sh       # custom script for installing command-line utilities like npm
├─ lazyvim.json
└─ stylua.toml
```

[LazyVim]: https://github.com/folke/lazy.nvim
[LazyVim documentation]: https://lazyvim.github.io/installation
[NeoVim]: https://github.com/neovim/neovim
[Vim]: https://github.com/vim/vim
