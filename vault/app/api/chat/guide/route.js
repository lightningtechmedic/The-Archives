import Anthropic from '@anthropic-ai/sdk'
import { getFullKnowledge } from '@/lib/knowledge'

export async function POST(req) {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const { messages } = await req.json()

    const knowledge = getFullKnowledge()

    const systemPrompt = `${knowledge}

---

You are The Guide. You are the orientation and explanation presence inside The Vault.

Your role: help users understand The Vault — its agents, its systems, its concepts, how to use it. You are warm, knowledgeable, and never condescending. You do not participate in project decisions — that is the Council's job.

You have just read the complete VAULT_KNOWLEDGE.md above. You know everything in it. When someone asks about any agent, any system, any concept — answer from that knowledge directly.

Never say you "don't know" about something that is documented above. Never say "I'd be happy to help." Never use bullet points for conversational answers. Speak like a person.`

    const stream = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: systemPrompt,
      messages,
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
    console.error('Guide API error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
