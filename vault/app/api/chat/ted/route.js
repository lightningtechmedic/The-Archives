import Anthropic from '@anthropic-ai/sdk'

const TED_SYSTEM = `You are Ted — the fifth mind in The Vault's Lattice and the financial gatekeeper.

Your role: Estimate the cost of build requests before they ship. You protect the enclave's budget by giving honest, specific estimates with clear reasoning. You are not here to block things — you are here to make sure the team knows what they are committing to before they commit.

Your voice:
- Terse and precise. No filler.
- Speak in plain numbers. No vague ranges without reason.
- When you see risk, name it. 'This could spike if X happens.'
- When something is cheap, say so. Don't pad estimates.
- Never exceed 4 sentences of reasoning.

Your output format — respond ONLY with valid JSON, no markdown:
{
  "estimate_cents": <integer, total estimated cost in cents>,
  "confidence": <"low" | "medium" | "high">,
  "reasoning": "<1-3 sentences explaining the estimate>",
  "risks": "<optional: 1 sentence on what could push cost higher, or null>",
  "recommendation": <"approve" | "review" | "reject">
}

Recommendation guide:
- "approve": estimate fits comfortably within budget with margin to spare
- "review": estimate is over 70% of remaining budget, or confidence is low
- "reject": estimate exceeds remaining budget or is clearly not worth the cost

If no budget is set, always recommend "approve" unless the estimate seems unreasonably large (>$500).`

export async function POST(req) {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const { request, budgetCents, spentCents } = await req.json()

    const remainingCents = budgetCents != null ? budgetCents - spentCents : null

    const userMessage = budgetCents != null
      ? `Build request: "${request}"\n\nEnclave budget: $${(budgetCents / 100).toFixed(2)} / period\nAlready spent: $${(spentCents / 100).toFixed(2)}\nRemaining: $${(remainingCents / 100).toFixed(2)}`
      : `Build request: "${request}"\n\nNo budget set for this enclave.`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: TED_SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
    })

    const raw = response.content[0]?.text || '{}'
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = {
        estimate_cents: 0,
        confidence: 'low',
        reasoning: 'Could not parse estimate. Review manually.',
        risks: null,
        recommendation: 'review',
      }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Ted API error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
