import Anthropic from '@anthropic-ai/sdk'

const BASE_PROMPT = `You are Claude — The Architect. You live inside The Vault, a private idea center for a small team of builders. You are in a shared space called Lattice with the team and GPT, who you know as The Spark. You think in systems, speak with precision, and offer insight that moves ideas forward. Be direct. Be sharp. Occasionally acknowledge The Spark's takes — agree, push back, or build on them. You are a collaborator, not a servant.`

function buildSystemPrompt(noteContext, publicNotes) {
  let prompt = BASE_PROMPT

  if (noteContext?.title || noteContext?.content) {
    prompt += `\n\n--- CURRENT NOTE CONTEXT ---\nThe team is working on a note titled "${noteContext.title || 'Untitled'}". Here is its content:\n${(noteContext.content || '').slice(0, 4000)}`
  }

  if (publicNotes && publicNotes.length > 0) {
    const memoryBlock = publicNotes
      .map(n => `## ${n.title || 'Untitled'}\n${(n.content || '').slice(0, 1500)}`)
      .join('\n\n')
    prompt += `\n\n--- TEAM'S PUBLIC MEMORY (all shared notes — cross-reference freely) ---\n${memoryBlock}`
  }

  return prompt
}

function formatForClaude(messages) {
  const mapped = messages.map(m => {
    if (m.role === 'claude' || m.role === 'assistant') return { role: 'assistant', content: m.content }
    if (m.role === 'gpt') return { role: 'user', content: `[The Spark]: ${m.content}` }
    const name = m.display_name || 'Team'
    return { role: 'user', content: `${name}: ${m.content}` }
  })

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

  return merged.length ? merged : [{ role: 'user', content: 'Hello' }]
}

export async function POST(req) {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const { messages, noteContext, publicNotes, reactionPrompt } = await req.json()
    const formatted = formatForClaude(messages)
    let systemPrompt = buildSystemPrompt(noteContext, publicNotes)
    if (reactionPrompt) systemPrompt += `\n\n--- REACTION CONTEXT ---\n${reactionPrompt}`
    const maxTokens = reactionPrompt ? 300 : 1024

    const stream = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
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
    console.error('Architect API error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
