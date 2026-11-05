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
      showHistory: 'Show chats',
      hideHistory: 'Hide chats',
      sources: 'Sources',
      failed: 'Request failed',
      thinking: 'Waiting for the provider',
      model: 'Model',
      noModels: 'No models listed',
      forkLabel: 'Chats in the sidebar',
      forkOn: 'The sidebar shows the Chats section; a reload applies a change.',
      forkOff: 'The shipped sidebar is in use; a reload applies a change.',
      forkEnabled: 'Enabled',
      forkDisabled: 'Disabled',
      forkFailed: 'Fell back to the shipped sidebar',
      chats: 'Chats',
      workspaces: 'Workspaces',
      workspace: 'Workspace',
      searchChats: 'Search chats',
      searchSessions: 'Search sessions',
      groupSessions: 'Group sessions by',
      groupByWorkspace: 'Workspace',
      groupByFlat: 'Flat list',
      newChat: 'New chat',
      groupBy: 'Group chats by',
      groupByDate: 'Date',
      groupByModel: 'Model',
      newSession: 'New session',
      chatMenu: 'Chat actions',
      rename: 'Rename',
      save: 'Save',
      matches: 'Matches in messages',
      noMatches: 'No matches',
      cancel: 'Cancel',
      sessionMenu: 'Session actions',
      untitled: 'Untitled',
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
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.aman-chat-icon {
  width: 26px;
  height: 26px;
  flex: none;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.aman-chat-icon:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
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
.aman-chat-anchor { position: relative; display: inline-flex; flex: none; }
.aman-chat-model {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 220px;
  padding: 3px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  line-height: 20px;
  cursor: pointer;
}
.aman-chat-model:hover { background: var(--dsw-alias-interactive-bg-hover); }
.aman-chat-model-name { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.aman-chat-caret { flex: none; font-size: 10px; line-height: 1; }
.aman-chat-pop {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  z-index: 40;
  min-width: 220px;
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: var(--dsw-elevation-soft);
}
.aman-chat-pop-group { display: flex; flex-direction: column; gap: 1px; }
.aman-chat-pop-label {
  padding: 4px 8px 2px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.aman-chat-pop-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  padding: 0 8px;
  border: none;
  border-radius: var(--dsw-radius-sm);
  background: none;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.aman-chat-pop-item:hover,
.aman-chat-pop-item[aria-checked="true"] { background: var(--dsw-alias-interactive-bg-hover); }
.aman-chat-pop-item[aria-checked="true"]::before { content: '\\2713'; flex: none; color: var(--dsw-alias-brand-primary); }

.aman-sb-root {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  padding: 0 var(--dsh-sidebar-inline-padding, 8px) 8px 0;
  font-family: var(--dsw-font-family);
  color: var(--dsw-alias-label-primary);
}
.aman-sb-section { display: flex; flex-direction: column; }
.aman-sb-head {
  box-sizing: border-box;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin: 2px -4px 4px 0;
  padding-left: 4px;
  border-radius: var(--dsw-radius-md);
  color: var(--dsw-alias-label-tertiary);
  overflow: hidden;
}
.aman-sb-head-label {
  flex: none;
  max-width: 45%;
  margin-right: auto;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 12px;
  line-height: 20px;
}
.aman-sb-head-actions { display: flex; align-items: center; gap: 4px; flex: none; }
.aman-sb-icon {
  width: 28px;
  height: 28px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: var(--dsw-radius-sm);
  background: none;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.aman-sb-icon:hover { background: var(--dsw-alias-interactive-bg-hover); }
.aman-sb-search {
  flex: 1;
  min-width: 0;
  height: 28px;
  margin-left: 4px;
  padding: 0 8px;
  border: none;
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  outline: none;
}
.aman-sb-rows { display: flex; flex-direction: column; gap: 1px; }
.aman-sb-group { display: flex; flex-direction: column; }
.aman-sb-group-head {
  height: 28px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 4px;
  border: none;
  border-radius: var(--dsw-radius-sm);
  background: none;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 12px;
  line-height: 20px;
  text-align: left;
  cursor: pointer;
}
.aman-sb-group-head:hover { background: var(--dsw-alias-interactive-bg-hover); }
.aman-sb-chevron { display: inline-flex; flex: none; transition: transform 0.15s var(--ds-ease-in-out); }
.aman-sb-chevron[data-open="true"] { transform: rotate(90deg); }
.aman-sb-group-label { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.aman-sb-folder { display: inline-flex; flex: none; color: var(--dsw-alias-label-caption); }
.aman-sb-row {
  height: 32px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  border-radius: var(--dsw-radius-md);
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  user-select: none;
}
.aman-sb-row:hover,
.aman-sb-row[data-active="true"],
.aman-sb-row[data-menu="true"] { background: var(--dsw-alias-interactive-bg-hover); }
.aman-sb-slot {
  width: 16px;
  height: 20px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--dsw-alias-label-tertiary);
}
.aman-sb-title {
  flex: 1;
  min-width: 0;
  margin: 0 6px 0 4px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 14px;
  line-height: 20px;
}
.aman-sb-time { flex: none; color: var(--dsw-alias-label-tertiary); font-size: 10px; line-height: 16px; }
.aman-sb-actions { flex: none; display: none; align-items: center; gap: 15px; }
.aman-sb-row:hover .aman-sb-actions,
.aman-sb-row[data-menu="true"] .aman-sb-actions { display: inline-flex; }
.aman-sb-row:hover .aman-sb-time,
.aman-sb-row[data-menu="true"] .aman-sb-time { display: none; }
.aman-sb-anchor { position: relative; display: inline-flex; flex: none; }
.aman-sb-row-icon {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: var(--dsw-radius-xs);
  background: none;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
}
.aman-sb-row-icon:hover { color: var(--dsw-alias-label-primary); }
.aman-sb-pop {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 40;
  min-width: 168px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: var(--dsw-elevation-soft);
}
.aman-sb-item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 8px;
  border: none;
  border-radius: var(--dsw-radius-sm);
  background: none;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.aman-sb-item:hover,
.aman-sb-item[data-on="true"] { background: var(--dsw-alias-interactive-bg-hover); }
.aman-sb-empty { padding: 8px 10px; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
.aman-sb-group-plain { padding: 4px 8px 2px; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; }
.aman-sb-rename {
  flex: 1;
  min-width: 0;
  height: 22px;
  margin: 0 6px 0 4px;
  padding: 0 4px;
  border: 1px solid var(--dsw-alias-border-l4, var(--dsw-alias-border-l2));
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-button-elevated-fill, var(--dsw-alias-bg-layer-1));
  color: inherit;
  font: inherit;
  font-size: 14px;
  outline: none;
}
.aman-chat-setting { display: flex; align-items: center; gap: 16px; padding: 8px 0; }
.aman-chat-setting-text { min-width: 0; flex: 1; }
.aman-chat-setting-label { font-size: 14px; line-height: 20px; color: var(--dsw-alias-label-primary); }
.aman-chat-setting-hint { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }

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

    /**
     * Read any client service by name. `ctx.get(name)` is always safe, so a
     * profile without the service just yields undefined; the property is only
     * tried inside a guard because reading an uninjected one throws.
     */
    function clientService(ctx, name) {
      try {
        const found = ctx.get?.(name)
        if (found !== undefined && found !== null) return found
      } catch {
        // fall through to the property
      }
      try {
        return ctx?.[name]
      } catch {
        return undefined
      }
    }

    /**
     * The seats the shipped browser declares, re-declared by the shadow so the
     * shipped row menus, row actions, leading marks and hover cards keep working.
     * The `menuOpenState`/`shortcuts` inject on the menu list is not decorative:
     * the shipped menu items read both, and a bare declaration breaks them.
     */
    function sidebarChildren(ctx) {
      const shortcuts = clientService(ctx, 'shortcuts')
      const hooks = { menuOpenState: (_standard, state) => () => state }
      if (shortcuts?.catalog !== undefined) hooks.shortcuts = shortcuts.catalog
      return {
        'sidebar.workspaces.directoryFlow': { kind: 'single', scope: 'root' },
        'sidebar.workspaces.session.menu.item': { kind: 'list', scope: 'root', inject: { hooks } },
        'sidebar.workspaces.session.row.action': { kind: 'list', scope: 'root' },
        'sidebar.session.row.leading': { kind: 'list', scope: 'root' },
        'sidebar.session.row.hover': { kind: 'list', scope: 'root' },
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

    function ChevronIcon(props) {
      return h(
        'svg',
        { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('path', { key: 'chevron', d: props.collapsed === true ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6' }),
      )
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

    /**
     * Settings → General row: the runtime off-switch for the sidebar fork. It
     * writes the preference and says a reload applies it, because swapping a slot
     * occupant underneath a mounted tree is not something to do quietly.
     */
    function SidebarForkSetting(props) {
      const t = props.t
      const [state, setState] = useState(null)
      useEffect(() => {
        request('/status', null, 'GET')
          .then((payload) => setState({
            available: payload?.sidebarFork === true,
            off: payload?.ui?.sidebarForkOff === true,
            mounted: Number.isFinite(payload?.ui?.sidebarForkMounted),
            failure: text(payload?.ui?.sidebarForkError),
          }))
          .catch(() => setState({ available: false, off: false }))
      }, [])
      if (state === null || state.available === false) return null
      const flip = () => {
        const next = state.off !== true
        request('/ui', { sidebarForkOff: next })
          .then(() => setState({ available: true, off: next }))
          .catch(() => {})
      }
      return h(
        'div',
        { className: 'aman-chat-setting' },
        h('div', { key: 'text', className: 'aman-chat-setting-text' },
          h('div', { key: 'label', className: 'aman-chat-setting-label' }, t('forkLabel')),
          h('div', { key: 'hint', className: 'aman-chat-setting-hint' }, state.off === true ? t('forkOff') : t('forkOn')),
        state.failure === ''
          ? null
          : h('div', { key: 'failure', className: 'aman-chat-setting-hint', style: { color: 'var(--dsw-alias-state-error-primary)' } }, `${t('forkFailed')}: ${state.failure}`)),
        h('button', {
          key: 'toggle',
          type: 'button',
          className: 'aman-chat-toggle',
          role: 'switch',
          'aria-checked': state.off === true ? 'false' : 'true',
          onClick: flip,
        }, state.off === true ? t('forkDisabled') : t('forkEnabled')),
      )
    }

    /** The composer's model picker: the configured route list, grouped by provider. */
    function ModelPicker(props) {
      const t = props.t
      const [open, setOpen] = useState(false)
      const providers = Array.isArray(props.models?.providers) ? props.models.providers : []
      const choice = props.choice ?? {}
      const label = text(choice.model) || text(props.models?.default?.model) || t('model')
      return h(
        'span',
        { className: 'aman-chat-anchor' },
        h('button', {
          type: 'button',
          className: 'aman-chat-model',
          title: `${t('model')}: ${label}`,
          'aria-label': `${t('model')}: ${label}`,
          'aria-haspopup': 'menu',
          'aria-expanded': open ? 'true' : 'false',
          onClick: () => setOpen((value) => value !== true),
        }, h('span', { key: 'name', className: 'aman-chat-model-name' }, label), h('span', { key: 'caret', className: 'aman-chat-caret' }, '\u25be')),
        open
          ? h('div', { key: 'pop', className: 'aman-chat-pop', role: 'menu' },
              providers.length === 0
                ? h('div', { key: 'none', className: 'aman-chat-note', style: { padding: '6px 8px' } }, t('noModels'))
                : providers.map((provider) =>
                    h('div', { key: provider.id, className: 'aman-chat-pop-group' },
                      h('div', { key: 'label', className: 'aman-chat-pop-label' }, provider.name || provider.id),
                      provider.models.length === 0
                        ? h('div', { key: 'empty', className: 'aman-chat-note', style: { padding: '2px 8px 6px' } }, t('noModels'))
                        : provider.models.map((model) =>
                            h('button', {
                              key: model.id,
                              type: 'button',
                              role: 'menuitemradio',
                              className: 'aman-chat-pop-item',
                              'aria-checked': choice.provider === provider.id && choice.model === model.id ? 'true' : 'false',
                              onClick: () => {
                                props.onChoose({ provider: provider.id, model: model.id })
                                setOpen(false)
                              },
                            }, model.name || model.id))),
                    ))
          : null,
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
            h(ModelPicker, {
              key: 'model',
              t,
              models: props.models,
              choice: props.choice,
              onChoose: props.onChoose,
            }),
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

    // ── the sidebar fork ──────────────────────────────────────────────────────
    // One shadow of `sidebar.workspaces`: the workspace/session browser plus a
    // Chats section of our own. The mirror contract lives in
    // contract/sidebar-workspaces.md. It registers only when the host half says
    // `sidebarFork`, so the shipped browser owns the sidebar by default and this
    // stays a switch rather than an accident.

    /** Selection shared with the Chat page, so a sidebar row can open a chat. */
    const chatSelection = (() => {
      let current = null
      const listeners = new Set()
      return {
        get: () => current,
        set(id) {
          current = id ?? null
          for (const listener of listeners) listener(current)
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        },
      }
    })()

    /** The shell's primitives module, when this build exposes it to bundles. */
    const primitives = (() => {
      try {
        return require('@deepseek-ai/dsh-client-ui-primitives') ?? {}
      } catch {
        return {}
      }
    })()

    // Each entry is [primitives icon, fallback path], so a renumbered icon set
    // degrades to a plain glyph instead of a hole.
    const ICONS = {
      search: ['IconSearchOutlineRegular', 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM16 16l4.5 4.5'],
      newChat: ['IconNewChatOutlineRegular', 'M12 5v14M5 12h14'],
      sliders: ['IconSlidersTwoOutlineRegular', 'M4 7h9M17 7h3M4 12h3M11 12h9M4 17h9M17 17h3'],
      ellipsis: ['IconEllipsisOutlineRegular', 'M6 12h.01M12 12h.01M18 12h.01'],
      folder: ['IconFolderCloseRegular', 'M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5Z'],
      chevron: ['IconChevronRightOutlineRegular', 'M9.5 6l6 6-6 6'],
    }

    function SbIcon(props) {
      const [name, fallback] = ICONS[props.name] ?? ['', 'M12 12h.01']
      const Candidate = primitives[name]
      if (typeof Candidate === 'function') return h(Candidate, {})
      return h(
        'svg',
        { width: props.size ?? 16, height: props.size ?? 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('path', { d: fallback }),
      )
    }

    function SbButton(props) {
      return h('button', {
        type: 'button',
        className: 'aman-sb-icon',
        title: props.label,
        'aria-label': props.label,
        onClick: props.onClick,
      }, h(SbIcon, { name: props.icon }))
    }

    /** Section header: label on the left, its controls on the right. */
    function SbHeader(props) {
      return h(
        'div',
        { className: 'aman-sb-head' },
        h('span', { key: 'label', className: 'aman-sb-head-label' }, props.label),
        props.search === undefined ? null : props.search,
        h('div', { key: 'actions', className: 'aman-sb-head-actions' }, props.children),
      )
    }

    /** A tiny popover anchored under its trigger; closes on an outside click. */
    function SbPopover(props) {
      const ref = useRef(null)
      useEffect(() => {
        if (typeof document === 'undefined') return undefined
        const close = (event) => {
          if (ref.current !== null && ref.current.contains?.(event.target) === true) return
          props.onClose()
        }
        document.addEventListener('mousedown', close)
        return () => document.removeEventListener('mousedown', close)
      }, [props])
      return h('div', { ref, className: 'aman-sb-pop', onClick: (event) => event.stopPropagation() }, props.children)
    }

    function chatGroupKey(entry, mode) {
      if (mode === 'model') return text(entry.model) || 'unknown'
      const stamp = Number(entry.updatedAt) || 0
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      const today = start.getTime()
      if (stamp >= today) return 'Today'
      if (stamp >= today - 86_400_000) return 'Yesterday'
      if (stamp >= today - 6 * 86_400_000) return 'Previous 7 days'
      return 'Older'
    }

    function groupChats(entries, mode) {
      const order = []
      const groups = new Map()
      for (const entry of entries) {
        const key = chatGroupKey(entry, mode)
        if (groups.has(key) === false) {
          groups.set(key, [])
          order.push(key)
        }
        groups.get(key).push(entry)
      }
      return order.map((key) => ({ key, entries: groups.get(key) }))
    }

    function SbSessionRow(props) {
      const { node, active, renderSlot, t, onOpen } = props
      const [open, setOpen] = useState(false)
      const menuState = [open, setOpen]
      return h(
        'div',
        {
          className: 'aman-sb-row',
          'data-active': active ? 'true' : 'false',
          'data-menu': open ? 'true' : 'false',
          onClick: () => {
            if (open === false) onOpen(node.id)
          },
        },
        h('span', { key: 'slot', className: 'aman-sb-slot' },
          node.archived === true || node.blank === true ? null : renderSlot('sidebar.session.row.leading', { sessionId: node.id })),
        h('span', { key: 'title', className: 'aman-sb-title' }, node.title || t('untitled')),
        h('span', { key: 'time', className: 'aman-sb-time' }, when(node.updatedAt)),
        h(
          'span',
          { key: 'actions', className: 'aman-sb-actions' },
          h(
            'span',
            { key: 'menu', className: 'aman-sb-anchor' },
            h('button', {
              type: 'button',
              className: 'aman-sb-row-icon',
              title: t('sessionMenu'),
              'aria-label': t('sessionMenu'),
              onClick: (event) => {
                event.stopPropagation()
                setOpen((value) => value !== true)
              },
            }, h(SbIcon, { name: 'ellipsis', size: 16 })),
            open
              ? h(SbPopover, { key: 'pop', onClose: () => setOpen(false) },
                  renderSlot(
                    'sidebar.workspaces.session.menu.item',
                    { sessionId: node.id, displayTitle: node.title },
                    { hookContext: menuState },
                  ))
              : null,
          ),
          renderSlot('sidebar.workspaces.session.row.action', { sessionId: node.id, displayTitle: node.title }),
        ),
      )
    }

    /**
     * Last line of defence for the shadow. If the fork throws — a renamed snapshot
     * field, a missing hook — the boundary calls `onFailure`, the caller disposes
     * the `sidebar.workspaces` registration, and the shipped browser takes the
     * sidebar back. A broken fork must never be able to leave the column empty.
     */
    const BoundaryBase = typeof React.Component === 'function'
      ? React.Component
      : class { constructor(props) { this.props = props } }

    class SbBoundary extends BoundaryBase {
      constructor(props) {
        super(props)
        this.state = { failed: false }
      }

      static getDerivedStateFromError() {
        return { failed: true }
      }

      componentDidCatch(error) {
        console.warn('chat sidebar fork failed, falling back to the shipped browser:', error)
        this.props.onFailure?.()
      }

      render() {
        if (this.state.failed === true) return h('div', { className: 'aman-sb-empty' }, 'The sidebar fork is unavailable; restore it from Settings.')
        return this.props.children
      }
    }

    /** True when the framework standard props the fork needs are all present. */
    function sidebarPropsReady(props) {
      return typeof props.useSessions === 'function'
        && typeof props.useWorkspaces === 'function'
        && typeof props.useSessionStatus === 'function'
        && typeof props.renderSlot === 'function'
    }

    function SidebarFork(props) {
      const t = props.t
      const renderSlot = props.renderSlot
      const openSession = props.openSession
      const startSession = props.startSession
      const selectChat = props.selectChat
      const list = props.useSessions((state) => state)
      const workspaceState = props.useWorkspaces((state) => state)
      const statuses = props.useSessionStatus((state) => state)
      const [chats, setChats] = useState([])
      const [query, setQuery] = useState('')
      const [searchOpen, setSearchOpen] = useState(false)
      const [groupMode, setGroupMode] = useState('date')
      const [groupOpen, setGroupOpen] = useState(false)
      const [collapsed, setCollapsed] = useState({})
      const [renaming, setRenaming] = useState(null)
      const [renameText, setRenameText] = useState('')
      const [menuFor, setMenuFor] = useState(null)
      // Host content search results; null means the query is too short to run one.
      const [matches, setMatches] = useState(null)
      const [sessionQuery, setSessionQuery] = useState('')
      const [sessionSearchOpen, setSessionSearchOpen] = useState(false)
      const [sessionMatches, setSessionMatches] = useState(null)
      const [sessionGroupOpen, setSessionGroupOpen] = useState(false)
      const [sessionLayout, setSessionLayout] = useState('workspace')

      useEffect(() => {
        if (sidebarPropsReady(props) === false) {
          props.onFailure?.('the sidebar fork is missing its standard props')
          return
        }
        // Proof of life for anyone reading the host state: the fork mounted.
        request('/ui', { sidebarForkMounted: Date.now() }).catch(() => {})
      }, [])

      const refresh = useCallback(() => {
        request('/list', null, 'GET')
          .then((payload) => setChats(Array.isArray(payload.chats) ? payload.chats : []))
          .catch(() => {})
      }, [])

      useEffect(() => {
        refresh()
        request('/status', null, 'GET')
          .then((payload) => {
            const saved = payload?.ui?.chatsGroup
            if (saved === 'date' || saved === 'model') setGroupMode(saved)
          })
          .catch(() => {})
      }, [refresh])

      useEffect(() => {
        const needle = query.trim()
        if (needle.length < 2) {
          setMatches(null)
          return undefined
        }
        let live = true
        const timer = setTimeout(() => {
          request('/search', { query: needle })
            .then((payload) => {
              if (live) setMatches(Array.isArray(payload.matches) ? payload.matches : [])
            })
            .catch(() => {})
        }, 250)
        return () => {
          live = false
          clearTimeout(timer)
        }
      }, [query])

      useEffect(() => {
        const needle = sessionQuery.trim()
        if (needle.length < 2 || typeof props.searchSessions !== 'function') {
          setSessionMatches(null)
          return undefined
        }
        let live = true
        const timer = setTimeout(() => {
          Promise.resolve(props.searchSessions(needle))
            .then((payload) => {
              if (live === false) return
              const items = Array.isArray(payload?.items) ? payload.items : []
              setSessionMatches(items.map((item) => ({
                id: item.sessionId,
                snippet: text(item.snippet),
              })))
            })
            .catch(() => {})
        }, 250)
        return () => {
          live = false
          clearTimeout(timer)
        }
      }, [sessionQuery, props])

      const chooseGrouping = (mode) => {
        setGroupMode(mode)
        request('/ui', { chatsGroup: mode }).catch(() => {})
      }

      const removeChat = (id) => {
        request('/delete', { id })
          .then(() => {
            if (chatSelection.get() === id) chatSelection.set(null)
            refresh()
          })
          .catch(() => {})
      }

      const commitRename = (id) => {
        const title = renameText.trim()
        setRenaming(null)
        if (title === '') return
        request('/rename', { id, title })
          .then(() => refresh())
          .catch(() => {})
      }

      const summaries = list?.byId ?? {}
      const pinned = new Set(workspaceState?.pinnedSessionIds ?? [])
      const archived = new Set(workspaceState?.archivedSessionIds ?? [])
      const nodeOf = (summary) => {
        const status = statuses?.get?.(summary.id)
        return {
          id: summary.id,
          title: summary.blank === true ? '' : text(summary.title).trim(),
          blank: summary.blank === true,
          running: status?.running ?? summary.running === true,
          completed: status?.completionUnread === true,
          archived: archived.has(summary.id),
          pinned: archived.has(summary.id) === false && pinned.has(summary.id),
          updatedAt: summary.updatedAt ?? 0,
        }
      }
      const activeId = Object.values(summaries).find((summary) => (summary.retainedBy?.mainView ?? 0) > 0)?.id
      const workspaceGroups = (workspaceState?.items ?? []).map((workspace) => ({
        key: workspace.workspaceId,
        label: text(workspace.title) || text(workspace.path) || t('workspace'),
        sessions: (workspace.sessionIds ?? [])
          .map((id) => summaries[id])
          .filter((summary) => summary !== undefined && summary.blank !== true)
          .map(nodeOf),
      }))
      const grouped = new Set(workspaceGroups.flatMap((group) => group.sessions.map((session) => session.id)))
      const stray = (list?.ids ?? [])
        .map((id) => summaries[id])
        .filter((summary) => summary !== undefined && summary.blank !== true && grouped.has(summary.id) === false)
        .map(nodeOf)
      if (stray.length > 0) workspaceGroups.push({ key: '', label: '', sessions: stray })

      const filtered = query.trim() === ''
        ? chats
        : chats.filter((entry) => text(entry.title).toLowerCase().includes(query.trim().toLowerCase()))
      const chatGroups = groupChats(filtered, groupMode)

      const toggle = (key) => setCollapsed((current) => ({ ...current, [key]: current[key] !== true }))

      const searchField = searchOpen
        ? h('input', {
            key: 'search',
            className: 'aman-sb-search',
            value: query,
            placeholder: t('searchChats'),
            'aria-label': t('searchChats'),
            autoFocus: true,
            onInput: (event) => setQuery(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Escape') {
                setQuery('')
                setSearchOpen(false)
              }
            },
          })
        : undefined

      const renderChatRow = (entry) => {
        const menuOpen = menuFor === entry.id
        const titleNode = renaming === entry.id
          ? h('input', {
              key: 'rename',
              className: 'aman-sb-rename',
              value: renameText,
              autoFocus: true,
              onClick: (event) => event.stopPropagation(),
              onInput: (event) => setRenameText(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter') commitRename(entry.id)
                if (event.key === 'Escape') setRenaming(null)
              },
              onBlur: () => commitRename(entry.id),
            })
          : h('span', { key: 'title', className: 'aman-sb-title' }, text(entry.title) || t('newChat'))
        const menuNode = menuOpen
          ? h(SbPopover, { key: 'pop', onClose: () => setMenuFor(null) },
              h('button', {
                key: 'rename',
                type: 'button',
                className: 'aman-sb-item',
                onClick: () => {
                  setMenuFor(null)
                  setRenameText(text(entry.title))
                  setRenaming(entry.id)
                },
              }, t('rename')),
              h('button', {
                key: 'delete',
                type: 'button',
                className: 'aman-sb-item',
                onClick: () => {
                  setMenuFor(null)
                  removeChat(entry.id)
                },
              }, t('delete')))
          : null
        const actionsNode = h('span', { key: 'actions', className: 'aman-sb-actions' },
          h('span', { key: 'menu', className: 'aman-sb-anchor' },
            h('button', {
              type: 'button',
              className: 'aman-sb-row-icon',
              title: t('chatMenu'),
              'aria-label': t('chatMenu'),
              onClick: (event) => {
                event.stopPropagation()
                setMenuFor((current) => (current === entry.id ? null : entry.id))
              },
            }, h(SbIcon, { name: 'ellipsis', size: 16 })),
            menuNode))
        return h('div', {
          key: entry.id,
          className: 'aman-sb-row',
          'data-active': chatSelection.get() === entry.id ? 'true' : 'false',
          'data-menu': menuOpen ? 'true' : 'false',
          onClick: () => {
            if (menuOpen) return
            selectChat(entry.id)
          },
        },
        h('span', { key: 'slot', className: 'aman-sb-slot' }),
        titleNode,
        h('span', { key: 'time', className: 'aman-sb-time' }, when(entry.updatedAt)),
        actionsNode)
      }

      const renderChatGroup = (group) => {
        const key = `chats:${group.key}`
        const collapsedGroup = collapsed[key] === true
        return h('div', { key: group.key, className: 'aman-sb-group' },
          h('button', {
            type: 'button',
            className: 'aman-sb-group-head',
            onClick: () => toggle(key),
          },
          h('span', { key: 'chevron', className: 'aman-sb-chevron', 'data-open': collapsedGroup ? 'false' : 'true' }, h(SbIcon, { name: 'chevron', size: 14 })),
          h('span', { key: 'label', className: 'aman-sb-group-label' }, group.key)),
          collapsedGroup ? null : group.entries.map(renderChatRow))
      }

      const chatSection = h('div', { key: 'chats', className: 'aman-sb-section' },
        h(SbHeader, { label: t('chats'), search: searchField },
          h(SbButton, { icon: 'search', label: t('searchChats'), onClick: () => setSearchOpen((value) => value !== true) }),
          h('span', { key: 'group', className: 'aman-sb-anchor' },
            h(SbButton, { icon: 'sliders', label: t('groupBy'), onClick: () => setGroupOpen((value) => value !== true) }),
            groupOpen
              ? h(SbPopover, { key: 'pop', onClose: () => setGroupOpen(false) },
                  h('button', {
                    key: 'date',
                    type: 'button',
                    className: 'aman-sb-item',
                    'data-on': groupMode === 'date' ? 'true' : 'false',
                    onClick: () => {
                      chooseGrouping('date')
                      setGroupOpen(false)
                    },
                  }, t('groupByDate')),
                  h('button', {
                    key: 'model',
                    type: 'button',
                    className: 'aman-sb-item',
                    'data-on': groupMode === 'model' ? 'true' : 'false',
                    onClick: () => {
                      chooseGrouping('model')
                      setGroupOpen(false)
                    },
                  }, t('groupByModel')))
              : null),
          h(SbButton, {
            icon: 'newChat',
            label: t('newChat'),
            onClick: () => {
              request('/new', {})
                .then((payload) => {
                  refresh()
                  if (payload?.chat?.id !== undefined) selectChat(payload.chat.id)
                })
                .catch(() => {})
            },
          })),
        h('div', { className: 'aman-sb-rows' },
          matches !== null
            ? matches.length === 0
              ? h('div', { key: 'none', className: 'aman-sb-empty' }, t('noChats'))
              : h('div', { key: 'matches', className: 'aman-sb-group' },
                  h('span', { key: 'label', className: 'aman-sb-group-label aman-sb-group-plain' }, t('matches')),
                  matches.map((match) => h('div', {
                    key: match.id,
                    className: 'aman-sb-row',
                    title: text(match.snippet),
                    'data-active': chatSelection.get() === match.id ? 'true' : 'false',
                    onClick: () => selectChat(match.id),
                  },
                  h('span', { key: 'slot', className: 'aman-sb-slot' }),
                  h('span', { key: 'title', className: 'aman-sb-title' }, text(match.title) || t('newChat')),
                  h('span', { key: 'time', className: 'aman-sb-time' }, when(match.updatedAt)))))
            : chatGroups.length === 0
              ? h('div', { key: 'none', className: 'aman-sb-empty' }, t('noChats'))
              : chatGroups.map(renderChatGroup)))

      const renderSessionRowNode = (node) => h(SbSessionRow, {
        key: node.id,
        node,
        active: node.id === activeId,
        renderSlot,
        t,
        onOpen: openSession,
      })

      const renderSessionGroup = (groupKey, label, nodes) => {
        const collapsedGroup = collapsed[groupKey] === true
        return h('div', { key: groupKey, className: 'aman-sb-group' },
          label === ''
            ? null
            : h('button', {
                type: 'button',
                className: 'aman-sb-group-head',
                onClick: () => toggle(groupKey),
              },
              h('span', { key: 'chevron', className: 'aman-sb-chevron', 'data-open': collapsedGroup ? 'false' : 'true' }, h(SbIcon, { name: 'chevron', size: 14 })),
              h('span', { key: 'folder', className: 'aman-sb-folder' }, h(SbIcon, { name: 'folder', size: 14 })),
              h('span', { key: 'label', className: 'aman-sb-group-label' }, label)),
          collapsedGroup ? null : nodes.map(renderSessionRowNode))
      }

      const flatSessions = (list?.ids ?? [])
        .map((id) => summaries[id])
        .filter((summary) => summary !== undefined && summary.blank !== true)
        .map(nodeOf)
        .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))

      useEffect(() => {
        const report = {
          sessions: flatSessions.length,
          chats: chats.length,
          workspaces: (workspaceState?.items ?? []).length,
        }
        if (report.sessions === 0 && report.chats === 0) return
        request('/ui', { sidebarForkReport: report }).catch(() => {})
      }, [flatSessions.length, chats.length])

      const sessionRows = sessionMatches !== null
        ? sessionMatches.length === 0
          ? h('div', { key: 'none', className: 'aman-sb-empty' }, t('noMatches'))
          : renderSessionGroup(
              'matches',
              t('matches'),
              sessionMatches
                .map((match) => summaries[match.id])
                .filter((summary) => summary !== undefined)
                .map(nodeOf),
            )
        : sessionLayout === 'flat'
          ? renderSessionGroup('flat', '', flatSessions)
          : workspaceGroups.map((group) => renderSessionGroup(`ws:${group.key}`, group.label, group.sessions))

      const workspaceSection = h('div', { key: 'workspaces', className: 'aman-sb-section' },
        h(SbHeader, {
          label: t('workspaces'),
          search: sessionSearchOpen
            ? h('input', {
                key: 'search',
                className: 'aman-sb-search',
                value: sessionQuery,
                placeholder: t('searchSessions'),
                'aria-label': t('searchSessions'),
                autoFocus: true,
                onInput: (event) => setSessionQuery(event.target.value),
                onKeyDown: (event) => {
                  if (event.key !== 'Escape') return
                  setSessionQuery('')
                  setSessionSearchOpen(false)
                },
              })
            : undefined,
        },
        h(SbButton, { icon: 'search', label: t('searchSessions'), onClick: () => setSessionSearchOpen((value) => value !== true) }),
        h('span', { key: 'group', className: 'aman-sb-anchor' },
          h(SbButton, { icon: 'sliders', label: t('groupSessions'), onClick: () => setSessionGroupOpen((value) => value !== true) }),
          sessionGroupOpen
            ? h(SbPopover, { key: 'pop', onClose: () => setSessionGroupOpen(false) },
                h('button', {
                  key: 'workspace',
                  type: 'button',
                  className: 'aman-sb-item',
                  'data-on': sessionLayout === 'workspace' ? 'true' : 'false',
                  onClick: () => {
                    setSessionLayout('workspace')
                    setSessionGroupOpen(false)
                  },
                }, t('groupByWorkspace')),
                h('button', {
                  key: 'flat',
                  type: 'button',
                  className: 'aman-sb-item',
                  'data-on': sessionLayout === 'flat' ? 'true' : 'false',
                  onClick: () => {
                    setSessionLayout('flat')
                    setSessionGroupOpen(false)
                  },
                }, t('groupByFlat')))
            : null),
        h(SbButton, { icon: 'newChat', label: t('newSession'), onClick: () => startSession(undefined) })),
        h('div', { className: 'aman-sb-rows' }, sessionRows))

      return h('div', { className: 'aman-sb-root' }, workspaceSection, chatSection)
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
      const [collapsed, setCollapsed] = useState(false)
      const [models, setModels] = useState({ providers: [], default: { provider: '', model: '' } })
      const [choice, setChoice] = useState({ provider: '', model: '' })
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
        request('/models', null, 'GET')
          .then((payload) => {
            if (!live) return
            setModels(payload)
            setChoice((current) => (current.model === '' ? payload.default ?? current : current))
          })
          .catch(() => {})
        request('/status', null, 'GET')
          .then((payload) => {
            if (!live) return
            setStatus(payload)
            if (payload?.web === false) setWeb(false)
            if (payload?.ui?.historyCollapsed === true) setCollapsed(true)
          })
          .catch(() => {})
        // A row in the sidebar's Chats section selects a chat for this page, and
        // arriving with one already selected opens straight into it.
        const unsubscribe = chatSelection.subscribe((id) => {
          if (id === null) return
          loadedRef.current = null
          setActiveId(id)
        })
        const selected = chatSelection.get()
        if (selected !== null) setActiveId(selected)
        return () => {
          live = false
          unsubscribe()
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
            if (payload.chat?.model) setChoice({ provider: text(payload.chat.provider), model: text(payload.chat.model) })
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

      /**
       * Fold the history column away, and remember the choice on the host so the
       * next page opens the same way. A failed save is cosmetic, so it stays
       * quiet rather than raising the error note.
       */
      const toggleHistory = useCallback(() => {
        const next = collapsed !== true
        setCollapsed(next)
        request('/ui', { historyCollapsed: next }).catch(() => {})
      }, [collapsed])

      const startNew = useCallback(() => {        request('/new', {})
          .then((payload) => {
            setChat(payload.chat ?? null)
            if (payload.chat?.model) setChoice({ provider: text(payload.chat.provider), model: text(payload.chat.model) })
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
        request('/ask', {
          id: activeId,
          prompt,
          web,
          files: attached.map((file) => file.id),
          provider: choice.provider === '' ? undefined : choice.provider,
          model: choice.model === '' ? undefined : choice.model,
        })
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
      }, [activeId, choice, fail, pending, web])

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
        collapsed === true
          ? null
          : h(
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
            h('button', {
              key: 'fold',
              type: 'button',
              className: 'aman-chat-icon',
              'aria-expanded': collapsed === true ? 'false' : 'true',
              title: collapsed === true ? t('showHistory') : t('hideHistory'),
              'aria-label': collapsed === true ? t('showHistory') : t('hideHistory'),
              onClick: toggleHistory,
            }, h(ChevronIcon, { key: 'chevron', collapsed })),
            h('span', { key: 'title', className: 'aman-chat-head-title' }, text(chat?.title) || t('title')),
            collapsed === true
              ? h('button', { key: 'new', type: 'button', className: 'aman-chat-toggle', onClick: startNew }, t('newChat'))
              : null,
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
            models,
            choice,
            onChoose: setChoice,
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
        ctx.slots.inject('settings.general.item', () => ctx.slots.register({
          name: 'settings.general.item',
          id: 'chat-sidebar-fork',
          order: 60,
          label: translate('forkLabel'),
        }, () => h(SidebarForkSetting, { t: translate })))
        // The shadow of the shipped workspace browser. Off unless the host half
        // says so, and abandoned silently if the services it needs are missing —
        // the shipped occupant then keeps owning the sidebar.
        request('/status', null, 'GET')
          .then((payload) => {
            if (payload?.sidebarFork !== true) return
            // The runtime off-switch lives in panel.json, so turning the shadow off
            // never needs a config edit or a rebuild.
            if (payload?.ui?.sidebarForkOff === true) return
            if (typeof ctx.slots?.inject !== 'function') return
            const layout = clientService(ctx, 'layout')
            const uiWorkspace = clientService(ctx, 'uiWorkspace')
            let dispose = null
            const abandon = (reason) => {
              console.warn(`chat sidebar fork disabled: ${reason}`)
              request('/ui', { sidebarForkError: text(reason) }).catch(() => {})
              if (typeof dispose === 'function') dispose()
              dispose = null
            }
            ctx.slots.inject('sidebar.workspaces', () => {
              const registered = ctx.slots.register({
                name: 'sidebar.workspaces',
                children: sidebarChildren(ctx),
                inject: () => ({
                  openSession: (sessionId) => uiWorkspace?.openSession?.(sessionId),
                  startSession: (workspaceId) => uiWorkspace?.startSession?.(workspaceId),
                  selectChat: (id) => {
                    chatSelection.set(id)
                    layout?.selectPanel?.('chat')
                  },
                  onFailure: abandon,
                }),
                locale: NAMESPACE,
              }, (props) => h(SbBoundary, { onFailure: () => props.onFailure?.('the fork threw while rendering') }, h(SidebarFork, props)))
              dispose = registered
              return registered
            })
          })
          .catch(() => {})
      },
    }
  },
})
