# Zotero — Cyberdream theme

`userChrome.css` themes Zotero's main interface and `userContent.css` themes the
PDF **reader** (a `type="content"` document, so it needs the content stylesheet)
with the cyberdream palette. Both files contain **dark** and **light** variants
and pick automatically from Zotero's appearance
(*Settings → General → Appearance: Light / Dark / Auto*).

- `userChrome.css` switches via `@media (prefers-color-scheme: …)` (the main
  window's vars are defined that way).
- `userContent.css` switches via `:root[data-color-scheme="…"]`, because the
  reader sets a `data-color-scheme` attribute on its `<html>`.

## How Zotero loads it

Zotero is Firefox-based and loads `userChrome.css` from the profile's `chrome/`
directory, but only when the pref
`toolkit.legacyUserProfileCustomizations.stylesheets` is `true` (default `false`).
`user.js` sets that pref on every startup.

## Install (files are symlinked into the profile)

Profile: `~/Library/Application Support/Zotero/Profiles/<id>.default`

```sh
PROFILE="$HOME/Library/Application Support/Zotero/Profiles/pb04htiz.default"
mkdir -p "$PROFILE/chrome"
ln -sfn ~/dotfiles/zotero/userChrome.css  "$PROFILE/chrome/userChrome.css"
ln -sfn ~/dotfiles/zotero/userContent.css  "$PROFILE/chrome/userContent.css"
ln -sfn ~/dotfiles/zotero/user.js          "$PROFILE/user.js"
```

Then **restart Zotero**.

Alternative to `user.js`: set the pref manually in
*Settings → Advanced → General → Config Editor* →
`toolkit.legacyUserProfileCustomizations.stylesheets` → `true`, then restart.

## Editing

- Variables live in `:root` blocks inside the two `@media (prefers-color-scheme)`
  sections. `!important` is required: `userChrome.css` is a *user* stylesheet and
  otherwise loses to Zotero's author-origin `:root` rules.
- Change a surface/accent colour in both blocks (dark and light) to keep them
  consistent.
- Reload without restarting Zotero: **Tools → Developer → Reload `chrome`**
  (if available), otherwise restart.
