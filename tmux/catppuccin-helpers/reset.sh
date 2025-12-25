#!/bin/bash

set -euo pipefail

# unset options
rg -Io 'set\s+-[aFgopqsuUw]+\s+"?@([^\s]+(\w|_))"?' -r '@$1' $HOME/.config/tmux/plugins/tmux/**/*.conf | uniq | xargs -n1 -P0 tmux set -Ugq

status_dir="$HOME/.config/tmux/plugins/tmux/status"
status_utils_file="$HOME/.config/tmux/plugins/tmux/utils/status_module.conf"

# get all status modules in $HOME/.config/tmux/plugins/tmux/status/
modules=()

for filepath in "$status_dir"/*.conf; do
  [ -e "$filepath" ] || continue
  filename="$(basename "$filepath" .conf)"
  modules+=("$filename")
done

# unset status module options for each module
for module in "${modules[@]}"; do
  conf_file="${status_dir}/${module}.conf"

  rg -Io 'set\s+-[aFgopqsuUw]+\s+"?@([^\s]+(\w|_))"?' -r '@$1' "$conf_file" | sed "s/\${MODULE_NAME}/$module/g" | uniq | xargs -n1 -P0 tmux set -Ugq
  rg -Io 'set\s+-[aFgopqsuUw]+\s+"?@([^\s]+(\w|_))"?' -r '@$1' "$status_utils_file" | sed "s/\${MODULE_NAME}/$module/g" | uniq | xargs -n1 -P0 tmux set -Ugq
done
