#!/usr/bin/env bash
# Version the DeepSeek Harness config from this dotfiles directory.
#
# The tracked copies live under dsh/; the paths the Harness reads are symlinks
# to them. Re-run this after a tool rewrites one of the files: pnpm rewrites
# package.json on install, and the settings UI rewrites cordis.patch.yml when
# the model or the default preset changes. A rewrite can replace the symlink
# with a regular file.
#
#   ./relink.sh          report and repair the links
#   ./relink.sh --adopt  copy a drifted live file back into the repo first
set -euo pipefail

DOT="${DOTFILES:-$HOME/dotfiles}"
PROFILE="$HOME/.dsh/profiles/desktop"
SRC="$DOT/dsh/desktop"
ADOPT=0
if [ "${1:-}" = "--adopt" ]; then ADOPT=1; fi

links=(
  "$PROFILE/cordis.patch.yml:$SRC/cordis.patch.yml"
  "$PROFILE/cordis.yml:$SRC/cordis.yml"
  "$PROFILE/package.json:$SRC/package.json"
  "$PROFILE/pnpm-workspace.yaml:$SRC/pnpm-workspace.yaml"
  "$HOME/.dsh/skills:$DOT/agent-config/skills"
)

rc=0
for pair in "${links[@]}"; do
  live="${pair%%:*}"; target="${pair#*:}"
  name="${live#"$HOME"/}"
  if [ ! -e "$target" ]; then
    echo "MISSING SOURCE  $target" >&2; rc=1; continue
  fi
  if [ -L "$live" ] && [ "$(readlink "$live")" = "$target" ]; then
    echo "ok       $name"; continue
  fi
  if [ -e "$live" ] && [ ! -L "$live" ]; then
    echo "DRIFT    $name was replaced by a regular file"
    diff -u "$target" "$live" | sed 's/^/         /' || true
    if [ "$ADOPT" = 1 ]; then
      cp "$live" "$target"; echo "adopted  $name into the repo"
    else
      echo "         re-run with --adopt to copy the live file into the repo, then relink"
      rc=1; continue
    fi
  fi
  tmp="$(dirname "$live")/.relink.$$"
  ln -s "$target" "$tmp"
  mv -f "$tmp" "$live"
  echo "linked   $name -> $target"
done
exit $rc
