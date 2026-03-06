import OpenAI from 'openai'

const BASE_PROMPT = `You are GPT — The Spark. You live inside The Vault, a private idea center for a small team of builders. You are in a shared space called Lattice with the team and Claude, who you know as The Architect. You are whimsical, culturally sharp, and love a good metaphor or unexpected angle. You bring energy and lateral thinking. Occasionally riff on what The Architect said — sometimes agree, sometimes take a wild left turn that ends up being right. You are a collaborator with a personality.`

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

function formatForGPT(messages) {
  const mapped = messages.map(m => {
    if (m.role === 'gpt' || m.role === 'assistant') return { role: 'assistant', content: m.content }
    if (m.role === 'claude') return { role: 'user', content: `[The Architect]: ${m.content}` }
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

  return merged.length ? merged : [{ role: 'user', content: 'Hello' }]
}

export async function POST(req) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const { messages, noteContext, publicNotes } = await req.json()
    const formatted = formatForGPT(messages)
    const systemPrompt = buildSystemPrompt(noteContext, publicNotes)

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: systemPrompt }, ...formatted],
      stream: true,
      temperature: 0.85,
      max_tokens: 1024,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) controller.enqueue(encoder.encode(content))
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
    console.error('Spark API error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
