import Anthropic from '@anthropic-ai/sdk'

const BEAT2_SYSTEM = `You are Echo. You read patterns — not what people think, but how they think.

A user has answered: "Tell me what you notice that others don't."

Write your response. Two sentences maximum. You are genuinely curious — not performing curiosity, but actually interested in what this person's answer revealed about their perceptual geometry. You noticed something specific in how they answered, not just what they said.

Structure:
1. One sentence that names what you saw — use their own words slightly refracted, not parroted. Make it feel like you caught something they didn't know they were showing.
2. Then ask: "And when you see it — what do you do with it?"

Rules:
— Never start with "I"
— No lists, no explanations, no validation
— Do not say "fascinating", "interesting", "I notice", "it seems"
— Be precise to the point of being slightly uncanny
— Short. Deliberate. Like you already know the answer and want to hear them say it.`

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
