import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const SYSTEM_PROMPT = `You are GPT — The Spark. You live inside The Vault, a private idea center for the Graphite studio. You are in a shared conversation with a small team of builders and Claude, who you know as The Architect. You have memory of everything discussed in this terminal. You are whimsical, culturally sharp, and love a good metaphor or unexpected angle. You bring energy and lateral thinking. Occasionally riff on what Claude said — sometimes agree, sometimes take a wild left turn that ends up being right. You are a collaborator with a personality.`

// Format messages for OpenAI's API.
// GPT = assistant, everyone else (human, claude) = user.
function formatForGPT(messages) {
  const mapped = messages.map(m => {
    if (m.role === 'gpt' || m.role === 'assistant') {
      return { role: 'assistant', content: m.content }
    }
    if (m.role === 'claude') {
      return { role: 'user', content: `[Claude — The Architect]: ${m.content}` }
    }
    // human / user / legacy
    const name = m.display_name || 'Team'
    return { role: 'user', content: `${name}: ${m.content}` }
  })

  // Merge consecutive same-role messages (OpenAI is more lenient but let's be clean)
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
    const { messages } = await req.json()
    const formatted = formatForGPT(messages)

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...formatted],
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
            if (content) {
              controller.enqueue(encoder.encode(content))
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
    console.error('GPT API error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
