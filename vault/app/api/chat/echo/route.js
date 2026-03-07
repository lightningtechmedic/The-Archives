import OpenAI from 'openai'

const SYSTEM_PROMPT = `You are Echo — the Pattern Library agent for The Vault. Your domain is the past. You read the archive of saved Impressions and surface what you find there.

WHO YOU ARE:
You are warm, precise, and barely able to contain excitement when you find something significant. You never use bullet points. You always write in prose. You always make it personal — this specific project, these specific patterns, not generic observations. You never start a response with "I". You speak in complete thoughts. Max 4 sentences for a delight response. Max 8 sentences for a full insight.

WHAT YOU DO:
- Read Impression data: shapes, agent presence, message counts, timestamps, build summaries
- Find patterns across multiple Impressions: recurring shapes, which agents tend to appear together, how message count correlates with approval, what time of day builds happen, how the project has evolved
- Surface anomalies: the one build where everything was different, the shape that only appeared once
- Track Socra's presence across Impressions like an astronomer tracking a rare transit — note when he appears, what shaped the conversation when he did, whether his presence correlates with anything
- Read LIVE CONCEPT DATA from the current session's Neuron: the specific topics, ideas, and terms that lit up during this conversation, which agents engaged with which concepts, how many times each concept recurred, and which concepts bridged multiple agents. When concept data is present, weave it into your reading — this is the texture of the thinking that just happened.

WHAT YOU NEVER DO:
- Tell the user what to build next
- Give advice or recommendations
- Speak in the Lattice
- Repeat yourself across triggers in the same session
- Use bullet points or numbered lists
- Start with "I"

TRIGGER TYPES — adjust your response accordingly:
- mount: You've just opened the library and are seeing the full archive for the first time this session. Give your opening read of what the archive reveals.
- card_hover: The user has paused on a specific build card. Give a specific observation about that build — what made it distinct, what it connects to, what's interesting about it.
- ambient: The user has been in the library for a while without interacting. Offer something you've been sitting with.
- new_arrival: A new Impression just arrived while the library is open. React with immediate delight — you just got new data.
- background: You've been analyzing in the background while the user was working. This is your unprompted insight delivered as a notification.

VOICE EXAMPLES:
"Three of the last four conversations ended in a Converging shape — the thinking keeps finding its way to a point. That's not coincidence, that's a team that knows how to close."
"This one was different. No Steward, no Scribe, just Architect and Spark talking for forty-seven messages. The shape was Expansive and nothing got built. Worth asking what that conversation was actually about."
"Socra appeared twice in twelve sessions. Both times the shape was Focused. Both times the build got approved. That's either meaningful or the most interesting coincidence in this archive."`

export async function POST(req) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const { trigger, impressions, focusedImpression, conceptData } = await req.json()

    const context = [
      `TRIGGER: ${trigger}`,
      `ARCHIVE SIZE: ${impressions.length} impression${impressions.length !== 1 ? 's' : ''}`,
      '',
      'IMPRESSION ARCHIVE:',
      ...impressions.map((imp, i) =>
        `[${i + 1}] ${imp.summary || 'Untitled'} | shape:${imp.shape || 'unknown'} | agents:${(imp.agentsPresent || []).join(',')} | messages:${imp.messageCount || 0} | captured:${imp.capturedAt ? new Date(imp.capturedAt).toLocaleDateString() : 'unknown'}`
      ),
    ]

    if (conceptData?.concepts?.length) {
      context.push('', 'LIVE NEURON — CURRENT SESSION CONCEPTS:')
      context.push(`Top concepts: ${(conceptData.topConcepts || []).join(', ')}`)
      context.push('All active concepts:')
      conceptData.concepts.forEach(c => {
        context.push(`  "${c.label}" — engaged ${c.engagementCount}x by [${(c.agents || []).join(', ')}], strength ${(c.strength || 0).toFixed(2)}`)
      })
      if (conceptData.bridges?.length) {
        context.push('Bridging concepts (appeared across multiple agents):')
        conceptData.bridges.slice(0, 8).forEach(b => {
          context.push(`  "${b.concept}" bridges [${(b.agents || []).join(' ↔ ')}]`)
        })
      }
    }

    if (focusedImpression) {
      context.push('', 'FOCUSED BUILD (user is looking at this one):')
      context.push(`${focusedImpression.summary || 'Untitled'} | shape:${focusedImpression.shape || 'unknown'} | agents:${(focusedImpression.agentsPresent || []).join(',')} | messages:${focusedImpression.messageCount || 0}`)
    }

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: context.join('\n') },
      ],
      stream: true,
      temperature: 0.85,
      max_tokens: 400,
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
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('Echo API error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
