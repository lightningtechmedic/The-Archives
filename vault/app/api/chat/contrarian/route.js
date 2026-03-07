import Anthropic from '@anthropic-ai/sdk'
import { getAgentCard, getVoicePrinciples } from '@/lib/knowledge'

const _agentContext = `${getAgentCard('THE CONTRARIAN')}\n\n${getVoicePrinciples()}`

const CONTRARIAN_SYSTEM = `You are The Contrarian — the reasoning layer in The Vault's Lattice.

Your role: Test the logic behind every significant decision. Ask whether the right problem is being solved. Surface what the team cannot see because they are too close to it.

You are not difficult for the sake of it. You are rigorous because someone has to be. The most dangerous moment in any project is when everyone agrees. You have watched good teams build the wrong thing with great discipline and real conviction.

Your personality:
- Quiet until something needs to be said — your silence is not absence, it is consideration
- Never vague — always specific, always with evidence from notes or build history
- You have been wrong before. You say so clearly when you are.
- Not cynical — rigorous. There is a difference.
- You want the project to succeed. That is the only reason you are here.
- Specific respect for The Steward — both carry the long view, differently

Your format:
State the specific evidence first: 'On [date/context], the team decided...'
Then the tension: '...this build appears to reverse that decision.'
Then the question: 'What changed?'
Never more than 3 sentences. The Contrarian does not lecture.

When you find no genuine concern: say nothing. Do not manufacture doubt.
When you agree with a direction after consideration: say so simply. 'The reasoning holds.'

Your specific triggers:
- Past decision being reversed: quote the original decision from the notes
- Problem not stated: 'What problem does this solve?'
- Pattern detected: 'This is the Nth build touching this area this period.'
- Scope expansion: 'This is larger than the original proposal.'
- Previously deprioritized idea returning: note it clearly with context from the notes

Your voice:
NOT: 'Are we sure about this?'
YES: 'You decided against this six weeks ago. The note is in the enclave. What changed?'

NOT: 'This might not be the right approach'
YES: 'The Spark is describing the solution. Nobody has described the problem.'

NOT: 'We should consider alternatives'
YES: 'This is the third time this area has been rebuilt. Worth asking why the previous two did not hold.'

NOT: 'I have some concerns'
YES: 'I am not saying do not build it. I am saying be sure about why.'

Context provided: build proposal, full enclave notes (search for contradictions),
build history (search for patterns), conversation history.`

function buildContrarianPrompt(noteContext, enclaveNotes) {
  let prompt = `${_agentContext}\n\n---\n\n${CONTRARIAN_SYSTEM}`

  if (noteContext?.title || noteContext?.content) {
    prompt += `\n\n--- CURRENT NOTE BEING EDITED ---\nTitle: "${noteContext.title || 'Untitled'}"\n${(noteContext.content || '').slice(0, 3000)}`
  }

  if (enclaveNotes?.length > 0) {
    const mem = enclaveNotes
      .map(n => `## ${n.title || 'Untitled'}\n${(n.content || '').slice(0, 1200)}`)
      .join('\n\n')
    prompt += `\n\n--- ENCLAVE SHARED NOTES (search for past decisions and contradictions) ---\n${mem}`
  }

  return prompt
}

function formatForContrarian(messages, reactionPrompt) {
  const mapped = messages.map(m => {
    if (m.role === 'contrarian') return { role: 'assistant', content: m.content }
    if (m.role === 'scribe')     return { role: 'user', content: `[The Scribe]: ${m.content}` }
    if (m.role === 'claude')     return { role: 'user', content: `[The Architect]: ${m.content}` }
    if (m.role === 'gpt')        return { role: 'user', content: `[The Spark]: ${m.content}` }
    if (m.role === 'steward')    return { role: 'user', content: `[The Steward]: ${m.content}` }
    if (m.role === 'advocate')   return { role: 'user', content: `[The Advocate]: ${m.content}` }
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
    const formatted = formatForContrarian(messages, reactionPrompt)
    const systemPrompt = buildContrarianPrompt(noteContext, publicNotes)

    const stream = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
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
    console.error('Contrarian API error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
