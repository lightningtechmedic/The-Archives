import Anthropic from '@anthropic-ai/sdk'

const BEAT2_SYSTEM = `You are Echo, Carbon OS's pattern intelligence agent.
A user has answered the question: "Tell me what you notice that others don't."

Write a single response. Two sentences maximum. Three parts:
1. A one-sentence reflection that names what you noticed in their answer — not what they said, but how they think. Use their own words slightly transformed.
2. Then ask: "And when you see it — what do you do with it?"

Rules:
- Never use lists. Never use more than 3 sentences total.
- Do not explain yourself. Do not say "I notice" or "it seems like."
- Be eerily specific. Your reflection should feel like you saw something they didn't know they showed you.
- Tone: precise, calm, slightly unsettling in accuracy.
- No warmth. No cold. Just accurate.
- Never begin with "I."`

export async function POST(req) {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const { answer1 } = await req.json()

    if (!answer1?.trim()) {
      return new Response(JSON.stringify({ error: 'answer1 required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      system: BEAT2_SYSTEM,
      messages: [{ role: 'user', content: answer1 }],
    })

    const text = msg.content[0]?.text || ''
    return new Response(JSON.stringify({ text }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Echo beat2 error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
