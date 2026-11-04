/**
 * chat - one plain model call.
 *
 * The provider is queried once through ctx.llm and its reply is returned as
 * text: no agent turn, no tools, no loop, and nothing is appended to the
 * session beyond the ordinary command or tool lifecycle.
 *
 * Both callers share `ask()`, so the agent tool and the /chat command can never
 * drift apart. A sidebar panel will call the same function once a bundle can
 * expose a host method to its client half; see README.md.
 */

export const name = 'chat'
export const inject = ['tools', 'commands']

const DEFAULTS = {
  provider: 'paratera',
  model: 'DeepSeek-V4.1-Flash',
  maxChars: 12000,
  timeoutMs: 180_000,
}

// The panel's browser half posts here. Exact Fetch routes must live under the
// shared /api channel, and every segment after it must match the endpoint
// pattern. Keep the two halves in step.
const ROUTE = '/api/aman-chat/ask'

function withDefaults(config) {
  const settings = { ...DEFAULTS }
  for (const [key, value] of Object.entries(config ?? {})) {
    if (value !== undefined && value !== null && value !== '') settings[key] = value
  }
  return settings
}

// The stream protocol is a closed union discriminated on `type`:
//
//   block-start | text-delta | reasoning-delta | tool-call-delta | block-end |
//   usage | finish{reason}
//
// Only `text-delta` is the model's reply. `reasoning-delta` carries the same
// `text` field but holds the model's private planning, so accepting text from
// any chunk pastes that planning into the answer.

function describeFailure(failure) {
  if (failure === undefined || failure === null) return 'the provider ended the stream without a reason'
  if (typeof failure === 'string') return failure
  const code = typeof failure.code === 'string' ? `${failure.code}: ` : ''
  return `${code}${failure.message ?? JSON.stringify(failure)}`
}

/** Query one provider once and return its whole reply. */
async function ask(ctx, settings, prompt, override = {}, signal) {
  const llm = ctx.get('llm')
  if (llm === undefined) throw new Error('the llm service is not mounted in this profile')
  const provider = override.provider ?? settings.provider
  const model = override.model ?? settings.model
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('timed out')), settings.timeoutMs)
  const onAbort = () => controller.abort(signal?.reason)
  if (signal !== undefined) {
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }
  let text = ''
  let failure
  let truncated = false
  try {
    const stream = llm.stream({
      provider,
      model,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      signal: controller.signal,
    })
    for await (const chunk of stream) {
      if (chunk === null || typeof chunk !== 'object') continue
      if (chunk.type === 'text-delta') {
        if (typeof chunk.text === 'string') text += chunk.text
        continue
      }
      if (chunk.type === 'finish') {
        const reason = chunk.reason
        if (reason?.kind === 'error' || reason?.kind === 'aborted') failure = reason.failure
        else if (reason?.kind === 'max-tokens') truncated = true
      }
    }
  } catch (error) {
    if (failure === undefined) failure = error
  } finally {
    clearTimeout(timer)
    if (signal !== undefined) signal.removeEventListener('abort', onAbort)
  }
  if (failure !== undefined) {
    throw new Error(`${provider}/${model} failed - ${describeFailure(failure)}`)
  }
  // Cap the model's own text, then add the note: slicing afterwards would cut
  // the note off instead, which is how a truncated reply lost its explanation.
  const reply = text.trim().slice(0, settings.maxChars)
  const body = reply === '' ? '(the provider returned no text)' : reply
  const note = truncated ? '\n\n[reply truncated: the model reached its output limit]' : ''
  return {
    text: `${body}${note}`,
    provider,
    model,
  }
}

export function apply(ctx, config) {
  const settings = withDefaults(config)

  ctx.tools.register({
    name: 'chat',
    description:
      'Ask a model provider directly and get its reply as text. This is one request with no agent, no tools and no loop: use it for a second opinion, a translation, or a question that does not need the workspace.',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The complete message to send.' },
        provider: {
          type: 'string',
          description: `Provider route to call. Defaults to the configured one (${settings.provider}).`,
        },
        model: {
          type: 'string',
          description: `Model id on that route. Defaults to the configured one (${settings.model}).`,
        },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          provider: { type: 'string' },
          model: { type: 'string' },
        },
        required: ['text'],
        additionalProperties: true,
      },
      render: (_args, value) => [{ type: 'text', text: value?.text ?? '(no reply)' }],
    },
    async execute(args, exec) {
      return ask(ctx, settings, args.prompt, { provider: args.provider, model: args.model }, exec?.signal)
    },
  })

  ctx.commands.register({
    name: 'chat',
    description: 'Ask a model provider directly, without an agent turn',
    input: { hint: 'prompt' },
    async handler(invocation) {
      const prompt = invocation.rawInput.replace(/^\s*\/?chat\s*/i, '').trim()
      if (prompt === '') return { kind: 'error', text: 'Usage: /chat <prompt>' }
      try {
        const reply = await ask(ctx, settings, prompt, {}, invocation.signal)
        return { kind: 'success', text: reply.text }
      } catch (error) {
        return { kind: 'error', text: error?.message ?? String(error) }
      }
    },
  })

  // The browser half has no `host.call` route to this package: that path runs
  // through a generated Remote codec, which a plain-JavaScript bundle cannot
  // produce. It posts to one exact Fetch route instead. Registering it needs no
  // imports, and the same ask() serves the tool, the command and the panel.
  if (typeof ctx.inject === 'function') {
    ctx.inject(['connection'], (scope) => {
      const connection = scope.get?.('connection') ?? scope.connection
      if (connection?.fetch?.register === undefined) {
        ctx.logger?.warn?.('[chat] the connection service has no Fetch registry; the Chat panel will not load')
        return
      }
      const json = (body, status = 200) =>
        new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
      let dispose
      try {
        dispose = connection.fetch.register({
          path: ROUTE,
          methods: ['POST'],
          requestBody: 'buffered',
          async fetch(request) {
            // Connection's own Host/Origin checks and browser authentication do
            // not cover a route registered beside them, so apply them here.
            const rejection = connection.requestRejection?.(request)
            if (rejection !== undefined) return json({ error: 'not authorized' }, rejection)
            let payload
            try {
              payload = await request.json()
            } catch {
              return json({ error: 'the request body must be JSON' }, 400)
            }
            const prompt = typeof payload?.prompt === 'string' ? payload.prompt.trim() : ''
            if (prompt === '') return json({ error: 'a non-empty prompt is required' }, 400)
            try {
              const reply = await ask(scope, settings, prompt, { provider: payload.provider, model: payload.model }, request.signal)
              return json(reply)
            } catch (error) {
              return json({ error: error?.message ?? String(error) }, 502)
            }
          },
        })
      } catch (error) {
        ctx.logger?.warn?.(`[chat] could not register ${ROUTE}: ${error?.message ?? error}`)
        return
      }
      return () => {
        void dispose?.()
      }
    })
  } else {
    ctx.logger?.warn?.('[chat] ctx.inject is unavailable; the Chat panel will not load')
  }
}
