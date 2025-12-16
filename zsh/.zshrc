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

# zinit
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

# load eza theme
export EZA_CONFIG_DIR="${HOME}/dotfiles/eza/dark-mode"

# zinit imports for powerlevel10k, auto-completion and fuzzy finder
zinit ice depth=1; zinit light romkatv/powerlevel10k
zinit light zsh-users/zsh-completions
zinit light Aloxaf/fzf-tab 

# load completions
autoload -U compinit && compinit

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

# styling for recommender systems
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
zstyle ':completion:*' menu no
zstyle ':fzf-tab:complete:cd:*' fzf-preview 'ls --color $realpath'

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
alias ls='colorls'
alias l='eza -a -l --git --icons'                          # table view of files with metadata
alias lt='eza -a --git --icons --level=2 --tree'           # tree view of files
alias ltree='eza -a --git --icons --level=2 --long --tree' # tree view of files with metadata

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
clear
