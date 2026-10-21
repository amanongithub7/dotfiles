# 📟 My Z Shell Configuration

The `.zshrc` file contains my Z shell configuration for path shims,
powerlevel10k, zinit, conda, pyenv, gvm, etc.

A symlink `~/.zshrc` -> `~/dotfiles/zsh/.zshrc` keeps my dotfiles repo
and local zsh config in sync.

API keys live in `secrets.zsh`, which is **gitignored**. Like `.zshrc`, it is
symlinked into place and sourced from there:

```sh
ln -sfn ~/dotfiles/zsh/secrets.zsh ~/.config/secrets.zsh
```
