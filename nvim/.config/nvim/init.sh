#!/bin/bash

echo Initializing NeoVim config dependencies...
echo -n

# --- npm dependencies ---

# check for npm executable
if ! command -v npm >/dev/null 2>&1; then
  echo "❌ npm not found. Please install Node.js (which includes npm) first."
  exit 1
fi

# npm is present – continue with installation of npm dependencies
npm install -g markdownlint-cli2 # linter for markdown files

# --- homebrew dependencies ---

brew install fd
