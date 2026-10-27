# Playwright CLI config

`cli.config.json` is symlinked to `~/.playwright/cli.config.json`, which is
where the Playwright CLI reads its global config from:

```bash
ln -s /Users/aman/dotfiles/playwright/cli.config.json ~/.playwright/cli.config.json
```

## Why it exists

Playwright CLI defaults to the `chrome` channel, which needs Google Chrome at
`/Applications/Google Chrome.app`. Chrome is not installed on this machine, so
every command failed with:

```
Error: Chromium distribution 'chrome' is not found at
/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

Setting the browser to `chromium` uses Playwright's own bundled build instead:

```json
{ "browser": { "browserName": "chromium" } }
```

Verified by removing this file (commands fail on the chrome channel) and
restoring it (commands succeed) — the file is the cause, not a coincidence.

The bundled Chromium is installed under
`~/Library/Caches/ms-playwright/chromium-1247`. Nothing else is needed; in
particular, installing Google Chrome is not required.

## Without this file

Pass the flag per invocation instead, but only on `open` — later commands talk
to the already-running session:

```bash
playwright-cli open --browser=chromium
```
