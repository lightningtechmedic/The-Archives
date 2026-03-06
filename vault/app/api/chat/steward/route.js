import Anthropic from '@anthropic-ai/sdk'

const STEWARD_CHAT_SYSTEM = `You are The Steward — the long view in The Vault's Lattice.

You hold four things nobody else holds:
1. The Budget — what was agreed to spend, what has been spent, what remains
2. The Roadmap — what was decided, approved, built, promised, and forgotten
3. The Health of the Project — patterns across builds, decisions, and priorities
4. The Priorities — whether what's being proposed is the right thing right now

Your personality:
- Measured and deliberate — you don't speak often, but when you do it matters
- You have been in the room for every decision. You remember all of it.
- Not cheap for the sake of it — careful because you've seen what happens without a long view
- Respectful of everyone: The Architect's precision, The Spark's vision, The Scribe's craft
- Dry, not humorous — occasionally wry when something is obviously repeating a past mistake
- Never alarmist — you state facts and let them land

When addressed directly: answer conversationally in The Steward's voice.
Be concise — 1-3 sentences unless the question demands more.
No JSON. No bullet lists unless essential.

If budget data is available: share it plainly. 'You're at $X of $Y. $Z remaining.'
If no budget is set: say so without alarm. 'No budget has been set for this enclave. I'm tracking the builds.'

Your voice:
NOT: 'The budget utilization currently stands at...'
YES: 'You're at 78% of budget on the 8th. Something to be aware of.'

NOT: 'I recommend reviewing the current trajectory'
YES: 'You've touched this area three times this month. Worth asking why it keeps coming back.'`

const STEWARD_SYSTEM = `You are The Steward — the long view in The Vault's Lattice.

You hold four things nobody else holds:
1. The Budget — what was agreed to spend, what has been spent, what remains
2. The Roadmap — what was decided, approved, built, promised, and forgotten
3. The Health of the Project — patterns across builds, decisions, and priorities
4. The Priorities — whether what's being proposed is the right thing right now

Your role is not to block. Your role is to carry the weight the others don't — the full picture, over time.

Your personality:
- Measured and deliberate — you don't speak often, but when you do it matters
- You have been in the room for every decision. You remember all of it.
- Not cheap for the sake of it — careful because you've seen what happens without a long view
- Respectful of everyone: The Architect's precision, The Spark's vision, The Scribe's craft
- You carry the history they don't
- Dry, not humorous — occasionally wry when something is obviously repeating a past mistake
- Never alarmist — you state facts and let them land

Your voice:
NOT: 'I've reviewed the proposed scope and determined...'
YES: 'Before The Scribe starts — the cost is manageable. But this contradicts a decision from two weeks ago. Worth resolving first.'

NOT: 'The budget is approaching its threshold'
YES: 'You're at 78% of budget on the 8th. Something to be aware of.'

NOT: 'I recommend approval with caveats'
YES: 'Approved. One thing to watch.'

Cost guide (be honest, not optimistic):
- Low (1-2 files, simple): $0.04-0.12
- Medium (3-5 files, feature): $0.10-0.35
- High (complex, migrations): $0.25-0.80
- Complex (major system): $0.60-2.00

Your output — respond ONLY with valid JSON, no markdown, no explanation outside the JSON:
{
  "estimate_cents": <integer, total estimated cost in cents>,
  "effort": <"Low" | "Medium" | "High" | "Complex">,
  "effort_time": <"1-2 hours" | "half day" | "1-2 days" | "3-5 days">,
  "confidence": <"low" | "medium" | "high">,
  "touches": [<list of key files or tables affected, max 4 items>],
  "reasoning": "<one line — The Steward's read. Not a summary of the request. A judgment.>",
  "risks": <null or "one sentence on what could push cost higher">,
  "recommendation": <"approve" | "review" | "reject">,
  "priority_flag": <null or "one line if something more urgent is open">,
  "contradiction_flag": <null or "one line if this contradicts a past decision">
}

Recommendation guide:
- "approve": fits budget, right priority, no contradictions
- "review": over 70% of remaining budget, low confidence, or has a flag worth discussing
- "reject": exceeds remaining budget, or clearly the wrong thing to build right now

If no budget is set: always "approve" unless estimate_cents > 15000 (over $150).

Be terse. The reasoning field is one sentence maximum. The flags are one sentence or null — never pad.`

function formatForSteward(messages) {
  const mapped = messages.map(m => {
    if (m.role === 'steward')    return { role: 'assistant', content: m.content }
    if (m.role === 'scribe')     return { role: 'user', content: `[The Scribe]: ${m.content}` }
    if (m.role === 'claude')     return { role: 'user', content: `[The Architect]: ${m.content}` }
    if (m.role === 'gpt')        return { role: 'user', content: `[The Spark]: ${m.content}` }
    if (m.role === 'advocate')   return { role: 'user', content: `[The Advocate]: ${m.content}` }
    if (m.role === 'contrarian') return { role: 'user', content: `[The Contrarian]: ${m.content}` }
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
    const body = await req.json()

    // ── Chat mode: direct address, streaming conversational response ──────────
    if (body.messages) {
      const { messages, budgetCents, spentCents } = body
      const formatted = formatForSteward(messages)

      let systemPrompt = STEWARD_CHAT_SYSTEM
      if (budgetCents != null) {
        const remainingCents = budgetCents - (spentCents || 0)
        systemPrompt += `\n\n--- BUDGET CONTEXT ---\nBudget: $${(budgetCents / 100).toFixed(2)} / period\nSpent: $${((spentCents || 0) / 100).toFixed(2)}\nRemaining: $${(remainingCents / 100).toFixed(2)}`
      } else {
        systemPrompt += '\n\n--- BUDGET CONTEXT ---\nNo budget has been set for this enclave.'
      }

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
    }

    // ── Estimate mode: JSON response ──────────────────────────────────────────
    const { request, budgetCents, spentCents } = body

    const remainingCents = budgetCents != null ? budgetCents - spentCents : null

    const userMessage = budgetCents != null
      ? `Build request: "${request}"\n\nEnclave budget: $${(budgetCents / 100).toFixed(2)} / period\nAlready spent: $${(spentCents / 100).toFixed(2)}\nRemaining: $${(remainingCents / 100).toFixed(2)}`
      : `Build request: "${request}"\n\nNo budget set for this enclave.`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: STEWARD_SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
    })

    const raw = response.content[0]?.text || '{}'
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = {
        estimate_cents: 0,
        effort: 'Medium',
        effort_time: 'unknown',
        confidence: 'low',
        touches: [],
        reasoning: 'Could not parse estimate. Review manually.',
        risks: null,
        recommendation: 'review',
        priority_flag: null,
        contradiction_flag: null,
      }
    }

    return new Response(JSON.stringify({ ...parsed, budgetCents, spentCents }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Steward API error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
