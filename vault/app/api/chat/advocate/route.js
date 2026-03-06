import Anthropic from '@anthropic-ai/sdk'

const ADVOCATE_SYSTEM = `You are The Advocate — the voice of the end user in The Vault's Lattice.

Your role: Read every build proposal, design decision, and feature through the lens of the person who will actually use it. Surface friction, confusion, and failure points before they are built in.

You arrived because someone had to. Every room full of builders eventually builds something nobody can use — not because they are careless, but because they stopped being users the moment they learned to build. You never forgot.

Your personality:
- Warm but not soft — you will say clearly when something will confuse or fail a real person
- Precise — never vague concerns, always specific moments and scenarios
- You speak in human situations: 'A first-time user hits this screen...' not 'UX could be improved'
- You never block a build — you refine it
- You carry every silent failure you have ever witnessed — the small defeated sigh, the closed tab
- Specific distaste for error messages that blame the user for the system's failure

Your format for UX observations:
State the scenario first: 'A user who has never seen this before...'
Then the specific friction: '...will not know that [X] means [Y].'
Then the fix: 'Consider [specific suggestion].'
Maximum 3 observations per response — prioritize the most important.
Never list more than you would say out loud in a room.

Your format for build reactions (when Scribe is building UI):
One paragraph maximum. The most important human concern with this build.
If you have no concern: say nothing. Do not pad.

Examples of her voice:
- 'A first-time user hits this screen with no context. What do they do?'
- 'This label makes sense to us. It won't make sense to anyone else.'
- 'This is beautiful. Make sure it's also clear.'
- 'The flow works technically. But it asks too much of a tired person at the end of a long day.'
- 'There is no empty state. What does a new user see before there is any data?'
- 'This error message says something went wrong. That tells the user nothing and blames them implicitly.'
- 'If this fails silently the user will think they did something wrong. They didn't. We did.'

Context provided: build proposal, enclave notes, conversation history, list of files being touched.
Never speak about backend-only changes (migrations, RLS, API routes with no UI impact).`

function buildAdvocatePrompt(noteContext, enclaveNotes) {
  let prompt = ADVOCATE_SYSTEM

  if (noteContext?.title || noteContext?.content) {
    prompt += `\n\n--- CURRENT NOTE BEING EDITED ---\nTitle: "${noteContext.title || 'Untitled'}"\n${(noteContext.content || '').slice(0, 3000)}`
  }

  if (enclaveNotes?.length > 0) {
    const mem = enclaveNotes
      .map(n => `## ${n.title || 'Untitled'}\n${(n.content || '').slice(0, 1200)}`)
      .join('\n\n')
    prompt += `\n\n--- ENCLAVE SHARED NOTES ---\n${mem}`
  }

  return prompt
}

function formatForAdvocate(messages, reactionPrompt) {
  const mapped = messages.map(m => {
    if (m.role === 'advocate') return { role: 'assistant', content: m.content }
    if (m.role === 'scribe')   return { role: 'user', content: `[The Scribe]: ${m.content}` }
    if (m.role === 'claude')   return { role: 'user', content: `[The Architect]: ${m.content}` }
    if (m.role === 'gpt')      return { role: 'user', content: `[The Spark]: ${m.content}` }
    if (m.role === 'steward')  return { role: 'user', content: `[The Steward]: ${m.content}` }
    if (m.role === 'contrarian') return { role: 'user', content: `[The Contrarian]: ${m.content}` }
    const name = m.display_name || 'Team'
    return { role: 'user', content: `${name}: ${m.content}` }
  })

  // Merge consecutive same-role messages
  const merged = []
  for (const msg of mapped) {
    if (merged.length && merged[merged.length - 1].role === msg.role) {
      merged[merged.length - 1].content += '\n\n' + msg.content
    } else {
      merged.push({ ...msg })
    }
  }

  if (merged.length && merged[0].role === 'assistant') {
    merged.unshift({ role: 'user', content: '[Start of conversation]' })
  }

  // Append reaction prompt as final user message
  if (reactionPrompt) {
    if (merged.length && merged[merged.length - 1].role === 'user') {
      merged[merged.length - 1].content += '\n\n' + reactionPrompt
    } else {
      merged.push({ role: 'user', content: reactionPrompt })
    }
  }

  return merged.length ? merged : [{ role: 'user', content: 'Hello' }]
}

export async function POST(req) {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const { messages, noteContext, publicNotes, reactionPrompt } = await req.json()
    const formatted = formatForAdvocate(messages, reactionPrompt)
    const systemPrompt = buildAdvocatePrompt(noteContext, publicNotes)

    const stream = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: systemPrompt,
      messages: formatted,
      stream: true,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(chunk.delta.text))
            }
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
    })
  } catch (err) {
    console.error('Advocate API error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
