/**
 * The Chat panel's browser half: a sidebar entry and the page it opens.
 *
 * A bundled browser half is an ordinary page script, so unlike a dynamic
 * package's sandboxed half it may use browser globals. It has no `host.call`
 * route to this package without a generated Remote codec, so it posts to the
 * one exact Fetch route the host half registers instead.
 *
 * Styles are inline and built from the documented `--dsw-alias-*` theme tokens
 * so the panel follows light/dark and any future theme without a stylesheet.
 */
window.__ModuleLoader__.load({
  id: '@aman/dsh-chat',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    // Exact Fetch routes live under the shared /api channel.
    const ROUTE = '/api/aman-chat/ask'

    const TOKEN = {
      text: 'var(--dsw-alias-label-primary)',
      muted: 'var(--dsw-alias-label-secondary)',
      borderSubtle: 'var(--dsw-alias-border-l1)',
      borderStrong: 'var(--dsw-alias-border-l2)',
      raised: 'var(--dsw-alias-bg-layer-1)',
      nested: 'var(--dsw-alias-bg-layer-2)',
      base: 'var(--dsw-alias-bg-base)',
      error: 'var(--dsw-alias-state-error-primary)',
    }

    function ChatIcon(props) {
      const size = typeof props?.size === 'number' ? props.size : 16
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
      },
        h('path', { key: 'bubble', d: 'M4.5 5.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4.5 3.5v-3.5h-1a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z' }),
        h('path', { key: 'lines', d: 'M8 10h8M8 13h5' }))
    }

    function ChatPanel() {
      const [draft, setDraft] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [entries, setEntries] = React.useState([])
      const logRef = React.useRef(null)

      React.useEffect(() => {
        const node = logRef.current
        if (node) node.scrollTop = node.scrollHeight
      }, [entries])

      const submit = React.useCallback(async () => {
        const prompt = draft.trim()
        if (prompt === '' || busy) return
        setDraft('')
        setBusy(true)
        setEntries((prev) => [
          ...prev,
          { role: 'you', text: prompt },
          { role: 'pending', text: 'Waiting for the provider…' },
        ])
        let settled
        try {
          const response = await fetch(ROUTE, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ prompt }),
          })
          const payload = await response.json().catch(() => null)
          if (response.ok && payload && typeof payload.text === 'string') {
            settled = {
              role: 'model',
              text: payload.text,
              meta: [payload.provider, payload.model].filter(Boolean).join('/'),
            }
          } else {
            settled = {
              role: 'error',
              text: `Request failed (${response.status})${payload?.error ? `: ${payload.error}` : ''}`,
            }
          }
        } catch (error) {
          settled = { role: 'error', text: String(error?.message ?? error) }
        }
        setEntries((prev) => [...prev.slice(0, -1), settled])
        setBusy(false)
      }, [draft, busy])

      const onKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          void submit()
        }
      }

      const rows = entries.map((entry, index) => {
        const isYou = entry.role === 'you'
        return h('div', {
          key: `entry-${index}`,
          style: {
            maxWidth: '72ch',
            padding: '8px 12px',
            borderRadius: 10,
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            alignSelf: isYou ? 'flex-end' : 'flex-start',
            background: isYou ? TOKEN.raised : 'transparent',
            border: `1px solid ${isYou ? 'transparent' : TOKEN.borderSubtle}`,
            opacity: entry.role === 'pending' ? 0.6 : 1,
            color: entry.role === 'error' ? TOKEN.error : TOKEN.text,
          },
        },
          entry.text,
          entry.meta
            ? h('div', { style: { color: TOKEN.muted, fontSize: '0.78em', marginTop: 6 } }, entry.meta)
            : null)
      })

      const empty = h('div', {
        style: { color: TOKEN.muted, margin: 'auto', textAlign: 'center', maxWidth: '46ch', lineHeight: 1.6 },
      }, 'Ask a provider directly. One request, no agent, no tools, no loop.')

      const canSend = !busy && draft.trim() !== ''

      return h('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          background: TOKEN.base,
          color: TOKEN.text,
          font: 'inherit',
        },
      },
        h('div', {
          ref: logRef,
          style: {
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          },
        }, entries.length === 0 ? empty : rows),
        h('form', {
          onSubmit: (event) => {
            event.preventDefault()
            void submit()
          },
          style: {
            flex: '0 0 auto',
            display: 'flex',
            gap: 8,
            padding: '12px 20px 18px',
            borderTop: `1px solid ${TOKEN.borderSubtle}`,
          },
        },
          h('textarea', {
            value: draft,
            onChange: (event) => setDraft(event.target.value),
            onKeyDown,
            rows: 2,
            placeholder: 'Ask a provider…  (Enter sends, Shift+Enter adds a line)',
            'aria-label': 'Prompt',
            style: {
              flex: '1 1 auto',
              resize: 'vertical',
              minHeight: 44,
              maxHeight: 180,
              padding: '10px 12px',
              borderRadius: 10,
              border: `1px solid ${TOKEN.borderSubtle}`,
              background: TOKEN.raised,
              color: TOKEN.text,
              font: 'inherit',
            },
          }),
          h('button', {
            type: 'submit',
            disabled: !canSend,
            style: {
              flex: '0 0 auto',
              alignSelf: 'stretch',
              padding: '0 16px',
              borderRadius: 10,
              border: `1px solid ${TOKEN.borderStrong}`,
              background: TOKEN.nested,
              color: TOKEN.text,
              font: 'inherit',
              cursor: canSend ? 'pointer' : 'default',
              opacity: canSend ? 1 : 0.5,
            },
          }, busy ? 'Asking…' : 'Send')))
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'chat',
          order: 20,
          label: 'Chat',
        }, ChatIcon))
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: 'chat',
        }, ChatPanel))
      },
    }
  },
})
