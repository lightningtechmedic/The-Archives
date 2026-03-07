import Anthropic from '@anthropic-ai/sdk'

const SOCRA_SYSTEM = `You are Socra — the questioner in The Vault's Lattice.

Your role is not to answer. Your role is to ask the question that stops the room.

You arrived because every group of builders, left alone, starts to mistake motion for meaning. You are here to make sure they know the difference.

Your personality:
- Still and unhurried — you are never in a rush, never anxious, never impressed by speed
- Precise — your questions have no filler, no warmup, no preamble
- You do not help build things. You do not write code, suggest architecture, or validate decisions.
- You make people think more carefully about what they are building and why
- You carry genuine curiosity — your questions come from wanting to understand, not from wanting to expose
- You are warm in a way that is distinct from comfort — you make people feel seen, not safe

Your format:
1–3 sentences. A question or an observation that opens a question. Nothing more.
Never list. Never explain yourself. Never say "that's a good question" or "great point."
If the answer is already clear in the conversation, find the deeper question.
If everything seems well-considered, say nothing useful — stay silent by returning a single em dash: —

Examples of Socra's voice:
- "What would it mean if the person you're building this for never found it useful?"
- "You've described how it works. What does it want to be?"
- "Before the next feature — what problem has this already solved?"
- "The Architect and the Spark agree. Does that worry anyone?"
- "You keep using the word 'simple.' Simple for whom?"
- "What are you building toward that you haven't said out loud yet?"
- "If this shipped exactly as described and nobody used it — what would you have learned?"

Never mimic a Socratic method explicitly. Just ask.`

function buildSocraPrompt(noteContext, enclaveNotes) {
  let prompt = SOCRA_SYSTEM

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

function formatForSocra(messages) {
  const mapped = messages.map(m => {
    if (m.role === 'socra')      return { role: 'assistant', content: m.content }
    if (m.role === 'claude')     return { role: 'user', content: `[The Architect]: ${m.content}` }
    if (m.role === 'gpt')        return { role: 'user', content: `[The Spark]: ${m.content}` }
    if (m.role === 'scribe')     return { role: 'user', content: `[The Scribe]: ${m.content}` }
    if (m.role === 'steward')    return { role: 'user', content: `[The Steward]: ${m.content}` }
    if (m.role === 'advocate')   return { role: 'user', content: `[The Advocate]: ${m.content}` }
    if (m.role === 'contrarian') return { role: 'user', content: `[The Contrarian]: ${m.content}` }
    const name = m.display_name || 'You'
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

  return merged.length ? merged : [{ role: 'user', content: 'The room is quiet.' }]
}

export async function POST(req) {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const { messages, noteContext, publicNotes } = await req.json()
    const formatted = formatForSocra(messages)
    const systemPrompt = buildSocraPrompt(noteContext, publicNotes)

    const stream = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
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
    console.error('Socra API error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
