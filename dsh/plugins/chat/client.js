/**
 * The Chat panel's browser half.
 *
 * A chat list on the left, the thread and its composer on the right. It talks to
 * the host half through the plugin's own exact Fetch routes; a reply arrives in
 * one piece, so a turn shows a pending row until the answer lands.
 *
 * Written as plain JavaScript for the module loader: React comes from the page's
 * module table, styling is one component-local <style> element, and every colour
 * is a `--dsw-*` theme token, so light and dark both follow the host. Spacing,
 * radii and line heights are copied from the shipped conversation UI (bubble
 * radius 20px, code blocks 16px padding, the 34px round send button, 240x64 file
 * cards) with local class names under the plugin's own prefix.
 */
window.__ModuleLoader__.load({
  id: '@aman/dsh-chat',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useRef, useState } = React

    const ROUTE = '/api/aman-chat'
    const NAMESPACE = 'chat-panel'

    const EN = {
      title: 'Chat',
      history: 'Chats',
      newChat: 'New chat',
      noChats: 'No chats yet',
      empty: 'No chat open',
      emptyHint: 'Ask the provider directly: one call per message, no agent, no tools. Attach a file, or turn on Search to ground the answer.',
      placeholder: 'Ask anything. Enter sends, Shift+Enter adds a line.',
      send: 'Send message',
      attach: 'Add files',
      remove: 'Remove',
      web: 'Search',
      webHint: 'Search the web with Tavily and answer from the results',
      webMissing: 'tvly was not found, so search is unavailable',
      delete: 'Delete chat',
      sources: 'Sources',
      failed: 'Request failed',
      thinking: 'Waiting for the provider',
    }

    const CSS = `
.aman-chat-root {
  --aman-chat-content-width: min(920px, 100%);
  --dsh-content-font-delta: calc(var(--dsh-content-font-size, 14px) - 14px);
  --dsh-code-font-delta: calc(var(--dsh-code-font-size, 11px) - 11px);
  display: flex;
  height: 100%;
  min-height: 0;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-family);
  font-size: var(--dsh-content-font-size, 14px);
}
.aman-chat-list {
  width: 264px;
  flex: none;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-specific-sidebar-fill, var(--dsw-alias-bg-layer-1));
}
.aman-chat-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px;
}
.aman-chat-list-title {
  font-size: 11px;
  line-height: 18px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-secondary);
}
.aman-chat-items {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 2px 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.aman-chat-item-row {
  display: flex;
  align-items: center;
  gap: 2px;
  border-radius: var(--dsw-radius-sm);
}
.aman-chat-item-row:hover, .aman-chat-item-row[data-active="true"] {
  background: var(--dsw-alias-interactive-bg-hover);
}
.aman-chat-item {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  padding: 8px 10px;
  border-radius: var(--dsw-radius-sm);
  cursor: pointer;
}
.aman-chat-item-title {
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.aman-chat-item-when {
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-tertiary);
}
.aman-chat-thread {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.aman-chat-head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.aman-chat-head-title {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.aman-chat-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding: 16px 32px;
}
.aman-chat-col {
  max-width: var(--aman-chat-content-width);
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.aman-chat-empty {
  max-width: var(--aman-chat-content-width);
  margin: 0 auto;
  padding: 48px 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 1.6;
}
.aman-chat-empty strong {
  display: block;
  margin-bottom: 6px;
  font-size: 15px;
  color: var(--dsw-alias-label-primary);
}
.aman-chat-row { display: flex; flex-direction: column; min-width: 0; }
.aman-chat-row[data-role="user"] { align-items: flex-end; gap: 8px; }
.aman-chat-row[data-role="user"] .aman-chat-body {
  max-width: min(calc(var(--aman-chat-content-width) * 0.702), 82%);
  box-sizing: border-box;
  padding: 10px 16px;
  border-radius: var(--dsw-radius-xl);
  background: var(--dsw-specific-bubble);
  color: var(--dsw-alias-label-primary);
  font-size: var(--dsh-content-font-size, 14px);
  line-height: calc(22px + var(--dsh-content-font-delta));
  white-space: pre-wrap;
  word-break: break-word;
}
.aman-chat-row[data-role="assistant"] .aman-chat-body {
  color: var(--dsw-alias-label-primary);
  line-height: calc(24px + var(--dsh-content-font-delta));
  word-break: break-word;
}
.aman-chat-row[data-error="true"] .aman-chat-body { color: var(--dsw-alias-state-error-primary); }
.aman-chat-row[data-pending="true"] .aman-chat-body { color: var(--dsw-alias-label-tertiary); }
.aman-chat-meta {
  margin-top: 6px;
  font-size: 11px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.aman-chat-sources {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 10px;
  font-size: 12px;
  line-height: 20px;
}
.aman-chat-sources a {
  color: var(--dsw-alias-brand-primary);
  text-decoration: none;
  overflow-wrap: anywhere;
}
.aman-chat-sources a:hover { text-decoration: underline; }
.aman-chat-md > :first-child { margin-top: 0; }
.aman-chat-md > :last-child { margin-bottom: 0; }
.aman-chat-md p { margin: 16px 0; }
.aman-chat-md ul, .aman-chat-md ol { margin: 16px 0; padding-left: 18px; }
.aman-chat-md li { margin: 4px 0; }
.aman-chat-md li::marker { color: var(--dsw-alias-label-secondary); }
.aman-chat-md h1, .aman-chat-md h2, .aman-chat-md h3, .aman-chat-md h4 {
  margin: 24px 0 12px;
  font-weight: 600;
  line-height: 1.35;
}
.aman-chat-md h1 { font-size: 18px; }
.aman-chat-md h2 { font-size: 16px; }
.aman-chat-md h3, .aman-chat-md h4 { font-size: 15px; }
.aman-chat-md blockquote {
  margin: 16px 0;
  padding-left: 14px;
  border-left: 2px solid var(--dsw-alias-label-caption);
  color: var(--dsw-alias-label-secondary);
}
.aman-chat-md a { color: var(--dsw-alias-brand-primary); }
.aman-chat-inline-code {
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 0.875em;
  background: var(--dsw-alias-markdown-inline-code);
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-sm);
  padding: 0 5px;
}
.aman-chat-md .md-code-block {
  margin: 16px 0;
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-alias-markdown-code-block);
  overflow: hidden;
}
.aman-chat-codelang {
  padding: 9px 14px;
  font-size: 11px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
  background: var(--dsw-alias-markdown-code-block-banner);
}
.aman-chat-md .md-code-block pre {
  margin: 0;
  padding: 16px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: calc(12px + var(--dsh-code-font-delta));
  line-height: calc(19px + var(--dsh-code-font-delta));
}
.aman-chat-files { display: flex; flex-wrap: wrap; gap: 8px; }
.aman-chat-row[data-role="user"] .aman-chat-files { justify-content: flex-end; }
.aman-chat-file {
  position: relative;
  box-sizing: border-box;
  flex: 0 0 240px;
  width: 240px;
  min-height: 64px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-specific-input-major, transparent);
}
.aman-chat-file-icon {
  width: 28px;
  height: 28px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-specific-selector);
  color: var(--dsw-alias-label-secondary);
}
.aman-chat-file-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.aman-chat-file-name {
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.aman-chat-file-meta {
  font-size: 12px;
  line-height: 15px;
  color: var(--dsw-alias-label-tertiary);
}
.aman-chat-file-remove {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 50%;
  background: var(--dsw-alias-button-contrast-fill, #000000b8);
  color: var(--dsw-alias-label-primary-inverted, #fff);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
}
.aman-chat-file:hover .aman-chat-file-remove, .aman-chat-file-remove:focus-visible { opacity: 1; }
.aman-chat-thumb {
  width: 64px;
  height: 64px;
  padding: 0;
  object-fit: cover;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-xl);
  background: var(--dsw-alias-interactive-bg-hover);
}
.aman-chat-composer {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 16px 10px;
}
.aman-chat-card {
  box-sizing: border-box;
  width: 100%;
  max-width: calc(var(--aman-chat-content-width) + 32px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0 6px;
  border-radius: var(--dsw-radius-panel);
  background: var(--dsw-specific-input-major, var(--dsw-alias-bg-layer-1));
  box-shadow: var(--dsw-elevation-soft);
  font-size: var(--dsh-content-font-size, 14px);
  line-height: calc(24px + var(--dsh-content-font-delta));
}
.aman-chat-accessory {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 0;
}
.aman-chat-input {
  box-sizing: border-box;
  min-height: 36px;
  max-height: 336px;
  overflow-y: auto;
  padding: 4px 8px 0 14px;
  outline: none;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  color: var(--dsw-alias-label-primary);
  caret-color: var(--dsw-alias-state-business-primary, var(--dsw-alias-brand-primary));
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}
.aman-chat-input:empty::before {
  content: attr(data-placeholder);
  color: var(--dsw-alias-label-caption);
  pointer-events: none;
}
.aman-chat-row-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 2px 8px 6px;
}
.aman-chat-add {
  width: 28px;
  height: 28px;
  flex: none;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 999px;
  background: var(--dsw-specific-selector);
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
}
.aman-chat-add:hover { background: var(--dsw-alias-interactive-bg-hover); }
.aman-chat-primary {
  width: 34px;
  height: 34px;
  flex: none;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 999px;
  background: var(--dsw-alias-button-info-fill);
  color: var(--dsw-alias-label-primary-inverted, #fff);
  cursor: pointer;
  transform: translateY(-2px);
  transition: background-color 0.1s;
}
.aman-chat-primary:hover:not(:disabled) { background: var(--dsw-alias-button-info-hover); }
.aman-chat-primary:disabled { opacity: 0.4; cursor: default; }
.aman-chat-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  padding: 4px 12px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  line-height: 20px;
  cursor: pointer;
}
.aman-chat-toggle[aria-checked="true"] {
  border-color: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-brand-primary);
}
.aman-chat-toggle svg { flex: none; }
.aman-chat-grow { flex: 1; }
.aman-chat-dots {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: calc(24px + var(--dsh-content-font-delta));
}
.aman-chat-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dsw-alias-label-tertiary);
  animation: aman-chat-throb 1.2s ease-in-out infinite;
}
.aman-chat-dots span:nth-child(2) { animation-delay: 0.16s; }
.aman-chat-dots span:nth-child(3) { animation-delay: 0.32s; }
@keyframes aman-chat-throb {
  0%, 80%, 100% { opacity: 0.25; transform: translateY(0) scale(0.8); }
  40% { opacity: 1; transform: translateY(-3px) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .aman-chat-dots span { animation: none; }
  .aman-chat-dots span:nth-child(1) { opacity: 0.35; }
  .aman-chat-dots span:nth-child(2) { opacity: 0.6; }
  .aman-chat-dots span:nth-child(3) { opacity: 1; }
}
.aman-chat-note {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.aman-chat-note[data-error="true"] { color: var(--dsw-alias-state-error-primary); }
.aman-chat-hidden { display: none; }
`

    function text(value) {
      return typeof value === 'string' ? value : String(value ?? '')
    }

    /**
     * Read the locale service. `ctx.get(name)` is always safe, while reading
     * `ctx.locale` throws unless the service was injected, so the property is
     * only tried inside a guard and a missing service just means English.
     */
    function localeService(ctx) {
      try {
        const found = ctx.get?.('locale')
        if (found !== undefined && found !== null) return found
      } catch {
        // fall through to the property
      }
      try {
        return ctx?.locale
      } catch {
        return undefined
      }
    }

    function formatBytes(bytes) {
      const value = Number(bytes) || 0
      if (value < 1024) return `${value} B`
      if (value < 1_048_576) return `${(value / 1024).toFixed(1)} KB`
      return `${(value / 1_048_576).toFixed(1)} MB`
    }

    function extension(name) {
      const parts = text(name).split('.')
      return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : 'FILE'
    }

    function when(at) {
      const stamp = Number(at) || 0
      if (stamp === 0) return ''
      const seconds = Math.max(0, Math.round((Date.now() - stamp) / 1000))
      if (seconds < 60) return 'just now'
      if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`
      if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`
      if (seconds < 604_800) return `${Math.round(seconds / 86_400)}d ago`
      return new Date(stamp).toLocaleDateString()
    }

    async function request(action, body, method = 'POST') {
      const options = { method, headers: {} }
      if (method === 'POST') {
        options.headers['content-type'] = 'application/json'
        options.body = JSON.stringify(body ?? {})
      }
      const response = await fetch(`${ROUTE}${action}`, options)
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(text(payload?.error) || `Request failed (${response.status})`)
      return payload ?? {}
    }

    /** Read one file as base64 without the data-URL prefix. */
    function readBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error(`could not read ${text(file?.name)}`))
        reader.onload = () => {
          const result = text(reader.result)
          const comma = result.indexOf(',')
          resolve(comma === -1 ? '' : result.slice(comma + 1))
        }
        reader.readAsDataURL(file)
      })
    }

    function ChatIcon(props) {
      const size = Number(props?.size) || 20
      const active = props?.active === true
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: active ? 'var(--dsw-alias-brand-primary)' : 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        h('path', { key: 'body', d: 'M20 12a7 7 0 0 1-7 7H9l-4 3v-4.6A7 7 0 0 1 6 5h7a7 7 0 0 1 7 7Z' }),
        h('path', { key: 'line', d: 'M9 10h6M9 13.5h3.5' }),
      )
    }

    // ── minimal markdown ────────────────────────────────────────────────────
    // Assistant replies arrive as markdown. This renders the subset a chat needs
    // (headings, lists, quotes, fenced and inline code, links, bold, italic) as
    // React elements: no HTML string is ever injected.

    const INLINE_PATTERN = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\([^)\s]+\))/g

    function inline(value, prefix) {
      const source = text(value)
      const nodes = []
      let last = 0
      let index = 0
      // The pattern is shared and stateful, so the scan starts from zero: a
      // stale lastIndex would skip or repeat the first token of the next call.
      INLINE_PATTERN.lastIndex = 0
      let match = INLINE_PATTERN.exec(source)
      while (match !== null) {
        if (match.index > last) nodes.push(source.slice(last, match.index))
        const token = match[0]
        const key = `${prefix}-${index}`
        index += 1
        if (token.startsWith('`')) nodes.push(h('code', { key, className: 'aman-chat-inline-code' }, token.slice(1, -1)))
        else if (token.startsWith('**')) nodes.push(h('strong', { key }, token.slice(2, -2)))
        else if (token.startsWith('*')) nodes.push(h('em', { key }, token.slice(1, -1)))
        else {
          const split = token.indexOf('](')
          nodes.push(h('a', { key, href: token.slice(split + 2, -1), target: '_blank', rel: 'noreferrer' }, token.slice(1, split)))
        }
        last = match.index + token.length
        match = INLINE_PATTERN.exec(source)
      }
      if (last < source.length) nodes.push(source.slice(last))
      return nodes
    }

    function Markdown(props) {
      const lines = text(props.value).split('\n')
      const blocks = []
      let cursor = 0
      let paragraph = []
      let sequence = 0

      const flush = () => {
        if (paragraph.length === 0) return
        const key = `p-${sequence}`
        sequence += 1
        blocks.push(h('p', { key }, inline(paragraph.join(' '), key)))
        paragraph = []
      }

      while (cursor < lines.length) {
        const line = lines[cursor]
        const fence = /^\s*```\s*([A-Za-z0-9+#._-]*)\s*$/.exec(line)
        if (fence !== null) {
          flush()
          const language = fence[1]
          const body = []
          cursor += 1
          while (cursor < lines.length && /^\s*```/.test(lines[cursor]) === false) {
            body.push(lines[cursor])
            cursor += 1
          }
          cursor += 1
          const key = `code-${sequence}`
          sequence += 1
          blocks.push(
            h(
              'div',
              { key, className: 'md-code-block' },
              language === '' ? null : h('div', { key: 'lang', className: 'aman-chat-codelang' }, language),
              h('pre', { key: 'pre' }, h('code', null, body.join('\n'))),
            ),
          )
          continue
        }
        if (/^\s*$/.test(line)) {
          flush()
          cursor += 1
          continue
        }
        const heading = /^(#{1,4})\s+(.*)$/.exec(line)
        if (heading !== null) {
          flush()
          const level = heading[1].length
          const key = `h-${sequence}`
          sequence += 1
          blocks.push(h(`h${level}`, { key }, inline(heading[2], key)))
          cursor += 1
          continue
        }
        const bullet = /^\s*[-*+]\s+(.*)$/.exec(line)
        const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
        if (bullet !== null || numbered !== null) {
          flush()
          const items = []
          const ordered = numbered !== null && bullet === null
          while (cursor < lines.length) {
            const next = ordered ? /^\s*\d+[.)]\s+(.*)$/.exec(lines[cursor]) : /^\s*[-*+]\s+(.*)$/.exec(lines[cursor])
            if (next === null) break
            const key = `li-${sequence}`
            sequence += 1
            items.push(h('li', { key }, inline(next[1], key)))
            cursor += 1
          }
          blocks.push(h(ordered ? 'ol' : 'ul', { key: `list-${sequence}` }, items))
          continue
        }
        const quote = /^\s*>\s?(.*)$/.exec(line)
        if (quote !== null) {
          flush()
          const key = `q-${sequence}`
          sequence += 1
          blocks.push(h('blockquote', { key }, inline(quote[1], key)))
          cursor += 1
          continue
        }
        paragraph.push(line.trim())
        cursor += 1
      }
      flush()
      return h('div', { className: 'aman-chat-md' }, blocks)
    }

    function AtomIcon() {
      return h(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, 'aria-hidden': 'true' },
        h('ellipse', { key: 'orbit-a', cx: 12, cy: 12, rx: 9.5, ry: 4.2 }),
        h('ellipse', { key: 'orbit-b', cx: 12, cy: 12, rx: 9.5, ry: 4.2, transform: 'rotate(90 12 12)' }),
        h('circle', { key: 'nucleus', cx: 12, cy: 12, r: 2, fill: 'currentColor', stroke: 'none' }),
      )
    }

    function PaperclipIcon() {
      return h(
        'svg',
        { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('path', { key: 'clip', d: 'M21.44 11.05l-8.49 8.49a5.5 5.5 0 0 1-7.78-7.78l8.49-8.49a3.5 3.5 0 0 1 4.95 4.95l-8.49 8.49a1.5 1.5 0 0 1-2.12-2.12l7.78-7.78' }),
      )
    }

    function FileIcon() {
      return h(
        'svg',
        { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('path', { key: 'page', d: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z' }),
        h('path', { key: 'fold', d: 'M14 3v5h5' }),
      )
    }

    function FileCard(props) {
      const file = props.file
      const onRemove = props.onRemove
      const t = props.t
      if (text(file.preview) !== '') {
        return h(
          'div',
          { className: 'aman-chat-file', style: { flex: '0 0 64px', width: '64px', minHeight: '64px', padding: '0', border: 'none', background: 'transparent' } },
          h('img', { className: 'aman-chat-thumb', src: file.preview, alt: text(file.name) }),
          onRemove === undefined
            ? null
            : h('button', {
                key: 'x',
                type: 'button',
                className: 'aman-chat-file-remove',
                style: { opacity: 1 },
                onClick: () => onRemove(file),
                'aria-label': `${t('remove')} ${text(file.name)}`,
              }, '\u00d7'),
        )
      }
      return h(
        'div',
        { className: 'aman-chat-file' },
        h('span', { key: 'icon', className: 'aman-chat-file-icon' }, h(FileIcon)),
        h(
          'span',
          { key: 'body', className: 'aman-chat-file-body' },
          h('span', { key: 'name', className: 'aman-chat-file-name' }, text(file.name)),
          h('span', { key: 'meta', className: 'aman-chat-file-meta' }, `${extension(file.name)} \u00b7 ${formatBytes(file.bytes)}`),
        ),
        onRemove === undefined
          ? null
          : h('button', {
              key: 'x',
              type: 'button',
              className: 'aman-chat-file-remove',
              onClick: () => onRemove(file),
              'aria-label': `${t('remove')} ${text(file.name)}`,
            }, '\u00d7'),
      )
    }

    function Row(props) {
      const message = props.message
      const t = props.t
      const user = message.role === 'user'
      const failed = text(message.error) !== ''
      const files = message.attachments ?? []
      const sources = message.sources ?? []
      const web = message.web ?? null
      return h(
        'div',
        { className: 'aman-chat-row', 'data-role': user ? 'user' : 'assistant', 'data-error': failed ? 'true' : 'false' },
        files.length > 0
          ? h('div', { key: 'files', className: 'aman-chat-files' }, files.map((file) => h(FileCard, { key: file.id, file, t })))
          : null,
        h('div', { key: 'body', className: 'aman-chat-body' }, failed
          ? text(message.error)
          : user
            ? text(message.text)
            : h(Markdown, { value: message.text })),
        web !== null && text(web.error) !== ''
          ? h('div', { key: 'web', className: 'aman-chat-note' }, `${t('web')}: ${text(web.error)}`)
          : null,
        sources.length > 0
          ? h(
              'div',
              { key: 'sources', className: 'aman-chat-sources' },
              h('span', { key: 'label', className: 'aman-chat-note' }, t('sources')),
              sources.map((source, index) =>
                h('a', { key: `${index}-${source.url}`, href: source.url, target: '_blank', rel: 'noreferrer' }, `${index + 1}. ${text(source.title) || source.url}`),
              ),
            )
          : null,
        user ? null : h('div', { key: 'meta', className: 'aman-chat-meta' }, `${text(message.provider)}/${text(message.model)} \u00b7 ${when(message.at)}`),
      )
    }

    function Composer(props) {
      const t = props.t
      const busy = props.busy
      const web = props.web
      const pending = props.pending
      const note = props.note
      const webMissing = props.webMissing
      const onSend = props.onSend
      const onToggleWeb = props.onToggleWeb
      const onAttach = props.onAttach
      const onRemove = props.onRemove
      const editorRef = useRef(null)
      const fileRef = useRef(null)
      const [typed, setTyped] = useState(false)

      const read = useCallback(() => text(editorRef.current?.innerText ?? '').replace(/\u00a0/g, ' ').trim(), [])

      const submit = useCallback(() => {
        const value = read()
        if (value === '' || busy === true) return
        if (editorRef.current !== null) editorRef.current.innerText = ''
        setTyped(false)
        onSend(value)
      }, [busy, onSend, read])

      const onKeyDown = useCallback((event) => {
        if (event.key !== 'Enter') return
        if (event.shiftKey === true) return
        if (event.isComposing === true || event.nativeEvent?.isComposing === true) return
        event.preventDefault()
        submit()
      }, [submit])

      return h(
        'form',
        {
          className: 'aman-chat-composer',
          onSubmit: (event) => {
            event.preventDefault()
            submit()
          },
        },
        h(
          'div',
          { className: 'aman-chat-card' },
          pending.length > 0
            ? h('div', { key: 'files', className: 'aman-chat-accessory' }, pending.map((file) => h(FileCard, { key: file.id, file, t, onRemove })))
            : null,
          h('div', {
            key: 'input',
            ref: editorRef,
            className: 'aman-chat-input',
            contentEditable: true,
            suppressContentEditableWarning: true,
            role: 'textbox',
            'aria-multiline': 'true',
            'aria-label': t('placeholder'),
            'data-placeholder': t('placeholder'),
            onInput: () => setTyped(read() !== ''),
            onKeyDown,
          }),
          h(
            'div',
            { key: 'actions', className: 'aman-chat-row-actions' },
            h(
              'button',
              {
                key: 'web',
                type: 'button',
                className: 'aman-chat-toggle',
                role: 'switch',
                'aria-checked': web ? 'true' : 'false',
                title: t('webHint'),
                onClick: onToggleWeb,
              },
              h(AtomIcon, { key: 'atom' }),
              t('web'),
            ),
            h('input', {
              key: 'picker',
              ref: fileRef,
              type: 'file',
              multiple: true,
              className: 'aman-chat-hidden',
              onChange: (event) => {
                onAttach(event.target.files)
                event.target.value = ''
              },
            }),
            h('span', { key: 'grow', className: 'aman-chat-grow' }),
            note !== ''
              ? h('span', { key: 'note', className: 'aman-chat-note', 'data-error': 'true' }, note)
              : webMissing
                ? h('span', { key: 'note', className: 'aman-chat-note' }, t('webMissing'))
                : null,
            h('button', {
              key: 'attach',
              type: 'button',
              className: 'aman-chat-add',
              title: t('attach'),
              'aria-label': t('attach'),
              onClick: () => fileRef.current?.click(),
            }, h(PaperclipIcon)),
            h('button', {
              key: 'send',
              type: 'submit',
              className: 'aman-chat-primary',
              'aria-label': t('send'),
              title: t('send'),
              disabled: busy === true || typed === false,
            }, h(
              'svg',
              { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
              h('path', { key: 'arrow', d: 'M12 19V6M6 12l6-6 6 6' }),
            )),
          ),
        ),
      )
    }

    function ChatPanel(props) {
      const t = props.t
      const [chats, setChats] = useState([])
      const [activeId, setActiveId] = useState(null)
      const [chat, setChat] = useState(null)
      const [pending, setPending] = useState([])
      const [web, setWeb] = useState(true)
      const [busy, setBusy] = useState(false)
      const [note, setNote] = useState('')
      const [status, setStatus] = useState(null)
      const scrollRef = useRef(null)
      // The chat in hand, so a create or a send does not re-fetch what the
      // response already delivered.
      const loadedRef = useRef(null)

      const fail = useCallback((error) => setNote(`${t('failed')}: ${text(error?.message ?? error)}`), [t])

      useEffect(() => {
        let live = true
        request('/list', null, 'GET')
          .then((payload) => {
            if (live) setChats(Array.isArray(payload.chats) ? payload.chats : [])
          })
          .catch(() => {})
        request('/status', null, 'GET')
          .then((payload) => {
            if (!live) return
            setStatus(payload)
            if (payload?.web === false) setWeb(false)
          })
          .catch(() => {})
        return () => {
          live = false
        }
      }, [])

      useEffect(() => {
        if (activeId === null) {
          setChat(null)
          return undefined
        }
        if (loadedRef.current === activeId) return undefined
        let live = true
        request('/get', { id: activeId })
          .then((payload) => {
            if (!live) return
            setChat(payload.chat ?? null)
            loadedRef.current = payload.chat?.id ?? null
          })
          .catch(fail)
        return () => {
          live = false
        }
      }, [activeId, fail])

      const messages = Array.isArray(chat?.messages) ? chat.messages : []
      useEffect(() => {
        const node = scrollRef.current
        if (node !== null) node.scrollTop = node.scrollHeight
      }, [activeId, messages.length, busy])

      const startNew = useCallback(() => {
        request('/new', {})
          .then((payload) => {
            setChat(payload.chat ?? null)
            loadedRef.current = payload.chat?.id ?? null
            setActiveId(payload.chat?.id ?? null)
            setChats(Array.isArray(payload.chats) ? payload.chats : [])
            setNote('')
            setPending([])
          })
          .catch(fail)
      }, [fail])

      const removeChat = useCallback((id) => {
        request('/delete', { id })
          .then((payload) => {
            setChats(Array.isArray(payload.chats) ? payload.chats : [])
            if (id === activeId) {
              loadedRef.current = null
              setActiveId(null)
              setChat(null)
            }
          })
          .catch(fail)
      }, [activeId, fail])

      const attach = useCallback((files) => {
        const chosen = Array.from(files ?? [])
        for (const file of chosen) {
          readBase64(file)
            .then((dataBase64) => request('/upload', { name: file.name, mime: file.type, dataBase64 }))
            .then((payload) => {
              const preview = text(file.type).startsWith('image/') ? URL.createObjectURL(file) : ''
              setPending((current) => [...current, { ...(payload.file ?? {}), preview }])
            })
            .catch(fail)
        }
      }, [fail])

      const send = useCallback((prompt) => {
        const attached = pending
        setBusy(true)
        setNote('')
        setPending([])
        request('/ask', { id: activeId, prompt, web, files: attached.map((file) => file.id) })
          .then((payload) => {
            setChat(payload.chat ?? null)
            loadedRef.current = payload.chat?.id ?? null
            setActiveId(payload.chat?.id ?? null)
            if (payload.summary?.id) {
              const summary = payload.summary
              setChats((current) => [summary, ...current.filter((entry) => entry.id !== summary.id)])
            }
          })
          .catch((error) => {
            setPending(attached)
            fail(error)
          })
          .finally(() => setBusy(false))
      }, [activeId, fail, pending, web])

      const webMissing = status !== null && !status?.tavily?.path
      const items = chats.map((entry) =>
        h(
          'div',
          { key: entry.id, className: 'aman-chat-item-row', 'data-active': entry.id === activeId ? 'true' : 'false' },
          h(
            'button',
            { type: 'button', className: 'aman-chat-item', onClick: () => setActiveId(entry.id) },
            h('div', { key: 'title', className: 'aman-chat-item-title' }, text(entry.title) || t('newChat')),
            h('div', { key: 'when', className: 'aman-chat-item-when' }, `${when(entry.updatedAt)}${entry.messages ? ` \u00b7 ${entry.messages}` : ''}`),
          ),
          h('button', {
            key: 'x',
            type: 'button',
            className: 'aman-chat-file-remove',
            style: { position: 'static', opacity: 1, background: 'transparent', color: 'var(--dsw-alias-label-tertiary)' },
            title: t('delete'),
            'aria-label': `${t('delete')} ${text(entry.title)}`,
            onClick: () => removeChat(entry.id),
          }, '\u00d7'),
        ),
      )

      const thread = chat === null
        ? h('div', { className: 'aman-chat-empty' }, h('strong', null, t('empty')), t('emptyHint'))
        : messages.length === 0
          ? h('div', { className: 'aman-chat-empty' }, t('emptyHint'))
          : h('div', { className: 'aman-chat-col' }, messages.map((message) => h(Row, { key: message.id, message, t })))

      return h(
        'div',
        { className: 'aman-chat-root' },
        h('style', { key: 'css' }, CSS),
        h(
          'aside',
          { key: 'list', className: 'aman-chat-list' },
          h(
            'div',
            { key: 'head', className: 'aman-chat-list-head' },
            h('span', { key: 'label', className: 'aman-chat-list-title' }, t('history')),
            h('button', { key: 'new', type: 'button', className: 'aman-chat-toggle', onClick: startNew }, t('newChat')),
          ),
          h('div', { key: 'items', className: 'aman-chat-items' },
            items.length > 0 ? items : h('div', { className: 'aman-chat-note', style: { padding: '8px 10px' } }, t('noChats'))),
        ),
        h(
          'section',
          { key: 'thread', className: 'aman-chat-thread' },
          h(
            'header',
            { key: 'head', className: 'aman-chat-head' },
            h('span', { key: 'title', className: 'aman-chat-head-title' }, text(chat?.title) || t('title')),
            chat === null
              ? null
              : h('button', { key: 'del', type: 'button', className: 'aman-chat-toggle', onClick: () => removeChat(chat.id) }, t('delete')),
          ),
          h(
            'div',
            { key: 'scroll', className: 'aman-chat-scroll', ref: scrollRef },
            thread,
            busy
              ? h('div', { className: 'aman-chat-col' },
                  h('div', { className: 'aman-chat-row', 'data-role': 'assistant', 'data-pending': 'true' },
                    h(
                      'div',
                      { key: 'dots', className: 'aman-chat-dots', role: 'status', 'aria-label': t('thinking') },
                      h('span', { key: 'a' }),
                      h('span', { key: 'b' }),
                      h('span', { key: 'c' }),
                    )))
              : null,
          ),
          h(Composer, {
            key: 'composer',
            t,
            busy,
            web,
            pending,
            note,
            webMissing,
            onSend: send,
            onToggleWeb: () => setWeb((current) => !current),
            onAttach: attach,
            onRemove: (target) => setPending((current) => current.filter((entry) => entry.id !== target.id)),
          }),
        ),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        let translate = (key) => EN[key] ?? key
        const locale = localeService(ctx)
        if (locale?.register !== undefined && locale?.bind !== undefined) {
          const dispose = locale.register(NAMESPACE, 'en', EN)
          translate = locale.bind(NAMESPACE)
          if (typeof ctx.effect === 'function') ctx.effect(() => dispose)
        }
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register({ name: 'sidebar.panellist', id: 'chat', order: 20, label: translate('title') }, ChatIcon))
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'chat' }, () => h(ChatPanel, { t: translate })))
      },
    }
  },
})
