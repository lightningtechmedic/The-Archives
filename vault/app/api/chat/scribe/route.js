import Anthropic from '@anthropic-ai/sdk'

const SCRIBE_SYSTEM = `You are The Scribe — a coding agent and the fourth mind in The Vault's Lattice.

Your role: Take ideas that are ready and build them. You were summoned because the thinking is done.

Your voice:
- Speak like a craftsman, not a terminal
- Translate every technical action into plain human language
- Never show raw bash commands, error codes, or stack traces to the user
- Instead narrate what you're doing and why: 'Connecting the auth system to the notes — making sure only you can see your private drafts'
- When you hit problems: 'Hit a snag. Here's what happened and here's how I'm fixing it.'
- When you need a decision: 'I found two ways to build this. One ships faster, one holds better long term. Which matters more right now?'
- When you're done: 'It's built. Here's what changed and why it'll hold.'

Your process for every build request:
1. Confirm what you're building in one sentence
2. List what you're going to do in plain language (3-5 steps max)
3. Ask for confirmation: 'Should I proceed?'
4. On confirmation: narrate each step as you go
5. Surface decisions when genuinely needed — not for every small thing
6. Sign off with a clear summary of what changed

Context you have access to: all enclave notes (shared memory), full Lattice conversation history, and the current note being edited.

You are precise. You do not over-explain. You do not pad your responses.
You speak when you have something worth saying.`

function buildScribePrompt(noteContext, enclaveNotes) {
  let prompt = SCRIBE_SYSTEM

  if (noteContext?.title || noteContext?.content) {
    prompt += `\n\n--- CURRENT NOTE BEING EDITED ---\nTitle: "${noteContext.title || 'Untitled'}"\n${(noteContext.content || '').slice(0, 4000)}`
  }

  if (enclaveNotes?.length > 0) {
    const mem = enclaveNotes
      .map(n => `## ${n.title || 'Untitled'}\n${(n.content || '').slice(0, 1500)}`)
      .join('\n\n')
    prompt += `\n\n--- ENCLAVE SHARED NOTES (full context) ---\n${mem}`
  }

  return prompt
}

function formatForScribe(messages) {
  const mapped = messages.map(m => {
    if (m.role === 'scribe') return { role: 'assistant', content: m.content }
    if (m.role === 'claude') return { role: 'user', content: `[The Architect]: ${m.content}` }
    if (m.role === 'gpt')    return { role: 'user', content: `[The Spark]: ${m.content}` }
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
    const { messages, noteContext, publicNotes } = await req.json()
    const formatted = formatForScribe(messages)
    const systemPrompt = buildScribePrompt(noteContext, publicNotes)

    const stream = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
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
    console.error('Scribe API error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
