# enable powerlevel10k instant prompt. 
# should stay close to the top of ~/.zshrc.
# initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must go above this block; everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

# path shims
export PATH="$HOME/.npm-packages/bin:$PATH"   # npm package binaries
export PATH="/usr/local/bin:$PATH"            # legacy user-specific binaries
export PATH="/opt/homebrew/bin:$PATH"         # homebrew-installed binaries

# nvm setup
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # load nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # load nvm bash_completion

# zinit - zsh plugin manager
#
# home directory for zinit and plugins
ZINIT_HOME="${XDG_DATA_HOME:-${HOME}/.local/share}/zinit/zinit.git"

# download zinit if it doesn't exist
if [ ! -d "$ZINIT_HOME" ]; then
	mkdir -p "$(dirname $ZINIT_HOME)"
	git clone https://github.com/zdharma-continuum/zinit.git "$ZINIT_HOME" 
fi

# load zinit
source "${ZINIT_HOME}/zinit.zsh"

# themes
# TODO: add options for other themes in the terminal by syncing bat, eza, nvim & omz themes
# requirements:
# - bat: add theme to bat if it doesn't exist, then set the corresponding dark & light env vars
# - eza: add theme to dotfiles/eza/*theme-name*/*dark-mode or light-mode* (perhaps an extra map of themes is needed)
# - nvim: add theme to plugins and then update theme.lua -> after that glhf!
# - oh-my-zsh: figure out
#
# load eza, bat-extras and fzf theme based on macOS' current dark/light style
# NOTE: this conditional export is only re-evaluated when a new shell session is created
# it does'nt change the theme for existing shell sessions when dark/light style is toggled
if [[ "$(defaults read -g AppleInterfaceStyle 2>/dev/null)" == "Dark" ]]; then
  export EZA_CONFIG_DIR="${HOME}/dotfiles/eza/dark-mode"
  export BAT_THEME="Catppuccin Mocha" # needed for bat-extras that don't read BAT_THEME_LIGHT/DARK
  source ~/.config/fzf/themes/catppuccin/catppuccin-fzf-mocha.sh # set fzf theme to mocha
else
  export EZA_CONFIG_DIR="${HOME}/dotfiles/eza/light-mode"
  export BAT_THEME="Catppuccin Latte"
  source ~/.config/fzf/themes/catppuccin/catppuccin-fzf-latte.sh # set fzf theme to latte
fi

# bat themes for dark & light modes
export BAT_THEME_LIGHT="Catppuccin Latte"
export BAT_THEME_DARK="Catppuccin Mocha"


zinit light zsh-users/zsh-completions

# styling for recommender systems
# disable sort when completing `git checkout`
zstyle ':completion:*:git-checkout:*' sort false
# zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
# set descriptions format to enable group support
# NOTE: don't use escape sequences (like '%F{red}%d%f') here, fzf-tab will ignore them
zstyle ':completion:*:descriptions' format '[%d]'
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
zstyle ':completion:*' menu no

# load completions
autoload -U compinit; compinit

# fzf default options - use bat, show previews and have borders
export FZF_DEFAULT_OPTS="${FZF_DEFAULT_OPTS} \
  --height 40% \
  --layout=reverse \
  --border \
  --preview='less {}' \
  --preview-window=right:60%:wrap \
  --bind \"ctrl-a:select-all,ctrl-d:deselect-all\""

export LESSOPEN='|~/.lessfilter.sh %s'

# zinit imports for powerlevel10k, auto-completion and fzf-tab
zinit ice depth=1; zinit light romkatv/powerlevel10k
# NOTE: fzf-tab needs to be loaded after compinit, but before plugins which will wrap widgets 
# such as auto-suggestions
zinit light Aloxaf/fzf-tab 

# oh-my-zsh setup with plugins
export ZSH="$HOME/.oh-my-zsh"
plugins=(git zsh-autosuggestions zsh-syntax-highlighting web-search macos)
export ZSH_COMPDUMP=$ZSH/cache/.zcompdump-$HOST # dump zsh completions in the specified directory, not in $HOME
source $ZSH/oh-my-zsh.sh

# zsh history configuration
HISTSIZE=5000
HISTFILE=~/.zsh_history
SAVEHIST=$HISTSIZE
HISTDUP=erase
setopt appendhistory
setopt sharehistory
setopt hist_ignore_space
setopt hist_ignore_all_dups
setopt hist_save_no_dups
setopt hist_ignore_dups
setopt hist_find_no_dups 

# auto-update oh-my-zsh
zstyle ':omz:update' mode auto

# auto-completion key bindings for previous and next
bindkey '^p' history-search-backward
bindkey '^n' history-search-forward

zstyle ':fzf-tab:*' use-fzf-default-opts yes
# use lessfilter for previews
zstyle ':fzf-tab:complete:*:*' fzf-preview 'less ${(Q)realpath}'

# fuzzy finder and zoxide initialization
eval "$(fzf --zsh)"
eval "$(zoxide init zsh)"

# load powerlevel10k
# to customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh

# aliases
#
# set personal aliases, overriding those provided by oh-my-zsh libs,
# plugins, and themes. aliases can be placed here, though oh-my-zsh
# users are encouraged to define aliases within the ZSH_CUSTOM folder.
# for a full list of active aliases, run `alias`.
alias caf='caffeinate -d'                                  # force OS and display to stay awake

alias ls='eza --icons'
alias l='eza -a -l --git --icons'                          # table view of files with metadata
alias lt='eza -a --git --icons --level=2 --tree'           # tree view of files
alias ltree='eza -a --git --icons --level=2 --long --tree' # tree view of files with metadata

# toggle dark/light mode on macos and source zsh config for bat, eza, etc. theme updates
alias yin-yang='clear && dark-mode && printf "\u262F\n" && source ~/.zshrc && tmux source-file ~/.config/tmux/tmux.conf && clear'
alias yy='yin-yang'

# yazi util func to exit into current yazi dir with `q` and original cwd with `Q`
function yz() {
	local tmp="$(mktemp -t "yazi-cwd.XXXXXX")" cwd
	yazi "$@" --cwd-file="$tmp"
	IFS= read -r -d '' cwd < "$tmp"
	[ -n "$cwd" ] && [ "$cwd" != "$PWD" ] && builtin cd -- "$cwd"
	rm -f -- "$tmp"
}

# gnupg
#
# api key export using pass and gnupg
export TODOIST_API_KEY="$(pass Todoist/API)"

# add relevant permissions for gnupg
find ~/.gnupg -type f -exec chmod 600 {} \; # Set 600 for files
find ~/.gnupg -type d -exec chmod 700 {} \; # Set 700 for directories

# golang
#
# go root directory
export GOROOT="/usr/local/go"

# go version manager setup
[[ -s "/Users/aman.oberoi/.gvm/scripts/gvm" ]] && source "/Users/aman.oberoi/.gvm/scripts/gvm"

# >>> conda initialize >>>
# !! Contents within this block are managed by 'conda init' !!
__conda_setup="$('/opt/miniconda3/bin/conda' 'shell.zsh' 'hook' 2> /dev/null)"
if [ $? -eq 0 ]; then
    eval "$__conda_setup"
else
    if [ -f "/opt/miniconda3/etc/profile.d/conda.sh" ]; then
        . "/opt/miniconda3/etc/profile.d/conda.sh"
    else
        export PATH="/opt/miniconda3/bin:$PATH"
    fi
fi
unset __conda_setup
# <<< conda initialize <<<

# pyenv shims
export PYENV_ROOT="$HOME/.pyenv"
[[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init - zsh)" 

[[ -s "/Users/aman/.gvm/scripts/gvm" ]] && source "/Users/aman/.gvm/scripts/gvm"

unset LS_COLORS # in order to force eza to refer to EZA_CONFIG_DIR for theme

# clear output at the end of shell setup

