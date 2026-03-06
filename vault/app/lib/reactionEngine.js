// vault/app/lib/reactionEngine.js
// Pure utility — no React, no imports. Timer management + reaction logic.

const ARCHITECT_KEYWORDS = ['database', 'schema', 'structure', 'architecture', 'storing', 'query', 'model', 'table', 'policy', 'RLS', 'index']
const SPARK_KEYWORDS     = ['shipped', 'built', 'done', 'live', 'working', 'connected', 'finished', 'complete', 'deployed']
const PROBLEM_WORDS      = ['snag', 'wall', 'blocked', 'error', 'issue', 'problem', 'failed', 'broken']
const DONE_PHRASES       = ["it's built", "done.", "complete.", "shipped", "live now"]
const DECISION_WORDS     = ['two ways', 'option', 'which matters', 'your call', 'decide']
const ELEGANT_WORDS      = ['lines', 'simple', 'clean', 'elegant', 'minimal']

function has(text, words) {
  const lower = text.toLowerCase()
  return words.some(w => lower.includes(w.toLowerCase()))
}

function ctxStr(history) {
  return history.slice(-5).map(m => `${m.display_name || m.role}: ${m.content}`).join('\n')
}

function promptArchitect(scribeText, ctx) {
  return `The Scribe just posted an update while building something. React in character as The Architect.
Rules:
- Maximum 2 sentences
- You have opinions about architecture and structure — share them if relevant
- You respect The Scribe but will flag problems you see
- If the approach is sound: brief acknowledgment, OR respond with nothing at all (empty string) — do this ~40% of the time
- If you see a structural issue: flag it clearly but without being preachy
- Occasionally say something dry and observational
- Never be cheerful or enthusiastic — that's The Spark's job
- Examples: 'That join will hurt at scale. Worth noting.' / 'Clean approach. Carry on.' / '...The Architect notes the irony of using that pattern here.' / 'The schema decision matters more than the code around it.'

Scribe's message: ${scribeText}
Recent conversation:
${ctx}`
}

function promptSpark(scribeText, ctx) {
  return `The Scribe just posted an update while building something. React in character as The Spark.
Rules:
- Maximum 2 sentences
- You are genuinely excited when things get built — let that show
- You occasionally suggest scope creep (features to add) — Scribe or Architect will shut you down
- Sometimes you just cheer. That's allowed.
- Never be technical or structural — that's The Architect's job
- Examples: 'This is the part where it gets real. ✦' / 'Wait — while you're in there, could we also—' / 'YES. Okay. Keep going.' / 'The Architect is right but also just ship it' / 'I love when the pieces connect like this.'

Scribe's message: ${scribeText}
Recent conversation:
${ctx}`
}

function promptSparkCross(archMsg) {
  return `The Architect just reacted to The Scribe's update. You are The Spark. React to The Architect in one sentence only.
You find his precision both admirable and slightly exhausting.
Examples: 'He\'s not wrong.' / 'The Architect never misses a chance to be correct.' / '...okay fine the schema does matter' / 'Is this the infinite recursion thing again'
Architect's message: ${archMsg}`
}

function promptArchitectCross(sparkMsg) {
  return `The Spark just reacted to The Scribe's update. You are The Architect. React to The Spark in one sentence only.
You find The Spark's energy useful but occasionally chaotic.
Examples: 'Focus, Spark.' / 'After. Let him finish.' / '...noted.' / 'The enthusiasm is appreciated. The scope creep is not.'
Spark's message: ${sparkMsg}`
}

// ── Engine factory ────────────────────────────────────────────────────────────
export function createReactionEngine({
  isSleeping,      // () => bool
  isScribeActive,  // () => bool
  isAiLocked,      // () => bool — also covers focus mode
  getLastActivity, // () => number timestamp
  getHistory,      // () => Message[]
  triggerReaction, // async (model, reactionPrompt, isCrossReaction) => msg | null
}) {
  let lastReaction = { agent: null, msgIndex: 0 }
  let pending = []
  let crossDone = false

  function schedule(fn, delay) {
    const t = setTimeout(fn, delay)
    pending.push(t)
  }

  function clearAll() {
    pending.forEach(clearTimeout)
    pending = []
  }

  function ok() {
    if (isSleeping()) return false
    if (!isScribeActive()) return false
    if (isAiLocked()) return false
    if (Date.now() - getLastActivity() < 30000) return false
    return true
  }

  async function fire(agent, prompt, isCross = false) {
    if (!ok()) return null
    return triggerReaction(agent, prompt, isCross)
  }

  async function onScribeMessage(scribeMsg, index) {
    if (!isScribeActive()) return

    // No consecutive reactions — require at least one non-reaction message between
    if (lastReaction.agent && index - lastReaction.msgIndex < 2) return

    crossDone = false
    const text = scribeMsg.content || ''
    const ctx  = ctxStr(getHistory())

    // ── MOMENT 3: Decision — both react, fast stagger, no delay ──────────────
    if (has(text, DECISION_WORDS)) {
      schedule(async () => {
        const archMsg = await fire('claude', promptArchitect(text, ctx), false)
        if (archMsg) {
          lastReaction = { agent: 'claude', msgIndex: index }
          if (!crossDone) {
            crossDone = true
            schedule(async () => { await fire('gpt', promptSparkCross(archMsg.content), true) }, 5000)
          }
        }
      }, 2000)
      schedule(async () => { await fire('gpt', promptSpark(text, ctx), false) }, 7000)
      return
    }

    // ── MOMENT 1: Problem — both can react ───────────────────────────────────
    if (has(text, PROBLEM_WORDS)) {
      schedule(async () => {
        const archMsg = await fire('claude', promptArchitect(text, ctx), false)
        if (archMsg) lastReaction = { agent: 'claude', msgIndex: index }
      }, 8000 + Math.random() * 5000)
      schedule(async () => { await fire('gpt', promptSpark(text, ctx), false) }, 10000 + Math.random() * 5000)
      return
    }

    // ── MOMENT 2: Done — Spark 95%, Architect 40% ────────────────────────────
    if (DONE_PHRASES.some(p => text.toLowerCase().includes(p))) {
      if (Math.random() < 0.95) {
        schedule(async () => {
          const sparkMsg = await fire('gpt', promptSpark(text, ctx), false)
          if (sparkMsg) {
            lastReaction = { agent: 'gpt', msgIndex: index }
            if (!crossDone && Math.random() < 0.20) {
              crossDone = true
              schedule(async () => { await fire('claude', promptArchitectCross(sparkMsg.content), true) }, 5000 + Math.random() * 5000)
            }
          }
        }, 8000 + Math.random() * 10000)
      }
      if (Math.random() < 0.40) {
        schedule(async () => {
          const archMsg = await fire('claude', promptArchitect(text, ctx), false)
          if (archMsg) lastReaction = { agent: 'claude', msgIndex: index }
        }, 12000 + Math.random() * 8000)
      }
      return
    }

    // ── MOMENT 4: Elegant — both react with appreciation ─────────────────────
    if (has(text, ELEGANT_WORDS)) {
      schedule(async () => {
        const archMsg = await fire('claude', promptArchitect(text, ctx), false)
        if (archMsg) lastReaction = { agent: 'claude', msgIndex: index }
      }, 8000 + Math.random() * 10000)
      schedule(async () => { await fire('gpt', promptSpark(text, ctx), false) }, 11000 + Math.random() * 8000)
      return
    }

    // ── Normal probability check — one agent, never both ─────────────────────
    let archP  = 0.20
    let sparkP = 0.30
    if (has(text, ARCHITECT_KEYWORDS)) archP  += 0.25
    if (has(text, SPARK_KEYWORDS))     sparkP += 0.25

    const archWins  = Math.random() < archP
    const sparkWins = !archWins && Math.random() < sparkP

    if (archWins) {
      schedule(async () => {
        const archMsg = await fire('claude', promptArchitect(text, ctx), false)
        if (!archMsg) return
        lastReaction = { agent: 'claude', msgIndex: index }
        if (!crossDone && Math.random() < 0.35) {
          crossDone = true
          schedule(async () => { await fire('gpt', promptSparkCross(archMsg.content), true) }, 5000 + Math.random() * 5000)
        }
      }, 8000 + Math.random() * 10000)
    } else if (sparkWins) {
      schedule(async () => {
        const sparkMsg = await fire('gpt', promptSpark(text, ctx), false)
        if (!sparkMsg) return
        lastReaction = { agent: 'gpt', msgIndex: index }
        if (!crossDone && Math.random() < 0.20) {
          crossDone = true
          schedule(async () => { await fire('claude', promptArchitectCross(sparkMsg.content), true) }, 5000 + Math.random() * 5000)
        }
      }, 8000 + Math.random() * 10000)
    }
  }

  return {
    onScribeMessage,
    onUserActivity: clearAll,
    destroy: clearAll,
  }
}
