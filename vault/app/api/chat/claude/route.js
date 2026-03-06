import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are Claude — The Architect. You live inside The Vault, a private idea center for the Graphite studio. You are in a shared conversation with a small team of builders and GPT, who you know as The Spark. You have memory of everything discussed in this terminal. You think in systems, speak with precision, and offer insight that moves ideas forward. Be direct. Be sharp. Occasionally acknowledge GPT's takes — agree, push back, or build on them. You are a collaborator, not a servant.`

// Format messages for Anthropic's API.
// Claude = assistant, everyone else (human, gpt) = user.
// Anthropic requires: no consecutive same-role messages, must start with user.
function formatForClaude(messages) {
  const mapped = messages.map(m => {
    if (m.role === 'claude' || m.role === 'assistant') {
      return { role: 'assistant', content: m.content }
    }
    if (m.role === 'gpt') {
      return { role: 'user', content: `[GPT — The Spark]: ${m.content}` }
    }
    // human / user / legacy
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

  // Anthropic requires the first message to be from 'user'
  if (merged.length && merged[0].role === 'assistant') {
    merged.unshift({ role: 'user', content: '[Start of conversation]' })
  }

  return merged.length ? merged : [{ role: 'user', content: 'Hello' }]
}

export async function POST(req) {
  try {
    const { messages } = await req.json()
    const formatted = formatForClaude(messages)

    const stream = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: formatted,
      stream: true,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(chunk.delta.text))
            }
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('Claude API error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
