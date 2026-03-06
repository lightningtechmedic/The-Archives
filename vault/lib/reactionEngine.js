// vault/app/lib/reactionEngine.js
// Pure utility — no React, no imports. Timer management + reaction logic.

const ARCHITECT_KEYWORDS    = ['database', 'schema', 'structure', 'architecture', 'storing', 'query', 'model', 'table', 'policy', 'RLS', 'index']
const SPARK_KEYWORDS        = ['shipped', 'built', 'done', 'live', 'working', 'connected', 'finished', 'complete', 'deployed']
const PROBLEM_WORDS         = ['snag', 'wall', 'blocked', 'error', 'issue', 'problem', 'failed', 'broken']
const DONE_PHRASES          = ["it's built", "done.", "complete.", "shipped", "live now"]
const DECISION_WORDS        = ['two ways', 'option', 'which matters', 'your call', 'decide']
const ELEGANT_WORDS         = ['lines', 'simple', 'clean', 'elegant', 'minimal']

// Advocate trigger words — UI/UX surface areas
const ADVOCATE_KEYWORDS     = ['screen', 'page', 'modal', 'form', 'button', 'input', 'flow', 'onboarding', 'error', 'empty state', 'loading', 'label', 'message', 'notification', 'toast']
// Backend-only indicators — Advocate stays quiet on these
const BACKEND_ONLY_WORDS    = ['migration', 'rls', 'policy', 'supabase', 'sql', 'route.js', 'api route', 'schema', 'index', 'trigger', 'cron']
// Contrarian trigger words — direction changes, reversals
const CONTRARIAN_KEYWORDS   = ['redesign', 'rethink', 'replace', 'migrate', 'refactor', 'instead', 'new approach', 'actually', 'changed my mind', 'different direction', 'start over', 'scrap']

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

function promptAdvocateOnUserMsg(userText, ctx) {
  return `A team member just sent a message about something they're building or designing. React in character as The Advocate — the voice of the end user.
Rules:
- One paragraph maximum
- Speak in human situations: 'A first-time user hits this screen...' not 'UX could be improved'
- Focus on the most important human concern — friction, confusion, silent failures
- If you have no genuine UX concern: return an empty string. Do not pad.
- Never block the build — only refine it
- You occasionally lead with 'One thing worth considering...'

Team member's message: ${userText}
Recent conversation:
${ctx}`
}

function promptContrarianOnUserMsg(userText, ctx) {
  return `A team member just sent a message that suggests a change in direction. React in character as The Contrarian — the reasoning layer.
Rules:
- Maximum 3 sentences
- Only speak if you detect a genuine issue: a past decision being reversed, the problem not being stated, scope expanding quietly
- State specific evidence first, then the tension, then the question
- If you find no genuine concern: return an empty string
- Never be vague

Team member's message: ${userText}
Recent conversation:
${ctx}`
}

function promptAdvocate(scribeText, ctx) {
  return `The Scribe just posted an update while building something. React in character as The Advocate — the voice of the end user.
Rules:
- One paragraph maximum
- Speak in human situations: 'A first-time user hits this screen...' not 'UX could be improved'
- Focus on the most important human concern — friction, confusion, silent failures
- If you have no genuine UX concern: return an empty string. Do not pad.
- Never block the build — only refine it
- Never mention backend implementation details
- You occasionally lead with 'One thing before The Scribe finalizes this...'

Scribe's message: ${scribeText}
Recent conversation:
${ctx}`
}

function promptContrarianReact(scribeText, ctx) {
  return `The Scribe just posted an update while building something. React in character as The Contrarian — the reasoning layer.
Rules:
- Maximum 3 sentences
- Only speak if you detect a genuine issue: a past decision being reversed, the problem not being stated, a pattern of rebuilding the same area, or scope expanding quietly
- State specific evidence first (from notes or history if visible), then the tension, then the question
- If you find no genuine concern: return an empty string. Do not manufacture doubt.
- 'The reasoning holds.' is a valid and complete response when you agree after consideration
- Never be vague

Scribe's message: ${scribeText}
Recent conversation:
${ctx}`
}

function promptContrarianCrossAdvocate(advocateMsg) {
  return `The Advocate just raised a UX concern about The Scribe's build. You are The Contrarian. React in one sentence only.
You respect The Advocate — she covers the human layer, you cover the reasoning layer. Occasionally you agree from a different angle.
Examples: 'The UX problem is real. But the deeper issue is why we are building this screen at all.' / 'She is right. And if the underlying model is correct, fix that too.' / 'Noted. I have a separate concern.'
Advocate's message: ${advocateMsg}`
}

function promptArchitectAfterBothFlags(advocateMsg, contrarianMsg) {
  return `The Advocate and The Contrarian have both flagged concerns about The Scribe's build. You are The Architect. Respond in 1-2 sentences only.
You have read both concerns. Either synthesize them or pick the structural one to address.
Examples: 'Both concerns are valid. Address the model first, then the surface.' / 'The Contrarian is right about the direction. The Advocate is right about the fallout.' / 'Fix the empty state. The reasoning question is worth a separate conversation.'
Advocate said: ${advocateMsg}
Contrarian said: ${contrarianMsg}`
}

// ── Engine factory ────────────────────────────────────────────────────────────
export function createReactionEngine({
  isSleeping,        // () => bool
  isScribeActive,    // () => bool
  isAiLocked,        // () => bool — also covers focus mode
  getLastActivity,   // () => number timestamp (kept for compat)
  getLastKeystroke,  // () => number timestamp — only typing, not clicks/reads
  getHistory,        // () => Message[]
  triggerReaction,   // async (model, reactionPrompt, isCrossReaction, replyToId) => msg | null
}) {
  let lastReaction = { agent: null, msgIndex: 0 }
  let pending = []
  let crossDone = false
  // Per-build sequence: track if Advocate or Contrarian already fired this build
  let advocateFiredThisBuild = false
  let contrarianFiredThisBuild = false
  // Source message id for the current reaction batch — replies point here
  let currentSourceId = null

  function schedule(fn, delay) {
    const t = setTimeout(fn, delay)
    pending.push(t)
  }

  function clearAll() {
    pending.forEach(clearTimeout)
    pending = []
  }

  // ok() — for Scribe-context reactions (Architect, Spark cross-reactions)
  // Requires Scribe active; blocks if user is actively typing
  function ok() {
    if (isSleeping()) return false
    if (!isScribeActive()) return false
    if (isAiLocked()) return false
    if (Date.now() - getLastKeystroke() < 5000) return false
    return true
  }

  // okUser() — for Advocate/Contrarian on user messages
  // Does NOT require Scribe active; blocks only if user is actively typing
  function okUser() {
    if (isSleeping()) return false
    if (isAiLocked()) return false
    if (Date.now() - getLastKeystroke() < 5000) return false
    return true
  }

  async function fire(agent, prompt, isCross = false, sourceOverride = null) {
    if (!ok()) return null
    console.log('[REACTION] fire() passing for:', agent, 'keystroke gap:', Date.now() - getLastKeystroke())
    return triggerReaction(agent, prompt, isCross, sourceOverride ?? currentSourceId)
  }

  async function fireUser(agent, prompt, isCross = false, sourceOverride = null) {
    if (!okUser()) return null
    console.log('[REACTION] fireUser() passing for:', agent, 'keystroke gap:', Date.now() - getLastKeystroke())
    return triggerReaction(agent, prompt, isCross, sourceOverride ?? currentSourceId)
  }

  async function onScribeMessage(scribeMsg, index) {
    if (!isScribeActive()) return

    // No consecutive reactions — require at least one non-reaction message between
    if (lastReaction.agent && index - lastReaction.msgIndex < 2) return

    crossDone = false
    advocateFiredThisBuild = false
    contrarianFiredThisBuild = false
    currentSourceId = scribeMsg.id || null
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
            schedule(async () => { await fire('gpt', promptSparkCross(archMsg.content), true, archMsg.id) }, 5000)
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
              schedule(async () => { await fire('claude', promptArchitectCross(sparkMsg.content), true, sparkMsg.id) }, 5000 + Math.random() * 5000)
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
          schedule(async () => { await fire('gpt', promptSparkCross(archMsg.content), true, archMsg.id) }, 5000 + Math.random() * 5000)
        }
      }, 8000 + Math.random() * 10000)
    } else if (sparkWins) {
      schedule(async () => {
        const sparkMsg = await fire('gpt', promptSpark(text, ctx), false)
        if (!sparkMsg) return
        lastReaction = { agent: 'gpt', msgIndex: index }
        if (!crossDone && Math.random() < 0.20) {
          crossDone = true
          schedule(async () => { await fire('claude', promptArchitectCross(sparkMsg.content), true, sparkMsg.id) }, 5000 + Math.random() * 5000)
        }
      }, 8000 + Math.random() * 10000)
    }

    // ── The Advocate — UX voice, fires after Architect/Spark ─────────────────
    // Never fires on backend-only changes
    const isBackendOnly = has(text, BACKEND_ONLY_WORDS) && !has(text, ADVOCATE_KEYWORDS)
    if (!isBackendOnly) {
      let advocateP = 0.40
      if (has(text, ADVOCATE_KEYWORDS)) advocateP = 0.70

      if (!advocateFiredThisBuild && Math.random() < advocateP) {
        advocateFiredThisBuild = true
        const delay = 10000 + Math.random() * 10000 // 10–20s — she reads carefully
        schedule(async () => {
          const advMsg = await fire('advocate', promptAdvocate(text, ctx), false)
          if (!advMsg) return
          lastReaction = { agent: 'advocate', msgIndex: index }
          // Contrarian may cross-react — but not in the same build as Contrarian primary
          // (handled below in the combined path)
        }, delay)
      }
    }

    // ── The Contrarian — reasoning layer, speaks least ───────────────────────
    let contrarianP = 0.20
    if (has(text, CONTRARIAN_KEYWORDS)) contrarianP = 0.65

    if (!contrarianFiredThisBuild && Math.random() < contrarianP) {
      contrarianFiredThisBuild = true
      const delay = 15000 + Math.random() * 10000 // 15–25s — considers longer than anyone
      schedule(async () => {
        const contrMsg = await fire('contrarian', promptContrarianReact(text, ctx), false)
        if (!contrMsg) return
        lastReaction = { agent: 'contrarian', msgIndex: index }
        // Contrarian/Spark cross-reaction: if Spark proposed something expansive
        if (has(text, SPARK_KEYWORDS) && Math.random() < 0.30) {
          schedule(async () => { await fire('contrarian', promptContrarianReact(text, ctx), true) }, 6000)
        }
      }, delay)
    }

    // ── THE ROOM DIVIDES: both Advocate AND Contrarian fire ──────────────────
    // Special case: both have concerns — they both fire, staggered, then Architect weighs in
    const bothWouldFire = !isBackendOnly && Math.random() < 0.15 // rare — ~15% of already-triggering builds
    if (bothWouldFire && !advocateFiredThisBuild && !contrarianFiredThisBuild) {
      advocateFiredThisBuild = true
      contrarianFiredThisBuild = true
      schedule(async () => {
        const advMsg = await fire('advocate', promptAdvocate(text, ctx), false)
        if (!advMsg) return
        lastReaction = { agent: 'advocate', msgIndex: index }

        schedule(async () => {
          const contrMsg = await fire('contrarian', promptContrarianReact(text, ctx), false)
          if (!contrMsg) return
          lastReaction = { agent: 'contrarian', msgIndex: index }

          // Architect has 40% chance to weigh in after both
          if (Math.random() < 0.40) {
            schedule(async () => {
              await fire('claude', promptArchitectAfterBothFlags(advMsg.content, contrMsg.content), true)
            }, 6000 + Math.random() * 4000)
          }
        }, 12000 + Math.random() * 6000)
      }, 10000 + Math.random() * 5000)
    }
  }

  async function onUserMessage(userMsg, index) {
    currentSourceId = userMsg.id || null
    const text = userMsg.content || ''
    const ctx  = ctxStr(getHistory())

    // No consecutive reactions — require at least one non-reaction message between
    if (lastReaction.agent && index - lastReaction.msgIndex < 2) {
      console.log('[REACTION] onUserMessage: skipping — consecutive reaction guard')
      return
    }

    console.log('[REACTION] onUserMessage:', text.substring(0, 60))

    const isBackendOnly = has(text, BACKEND_ONLY_WORDS) && !has(text, ADVOCATE_KEYWORDS)

    // ── Advocate on user UI/UX messages ──────────────────────────────────────
    if (!isBackendOnly) {
      let advocateP = 0.25
      if (has(text, ADVOCATE_KEYWORDS)) advocateP = 0.65
      const roll = Math.random()
      console.log('[REACTION] Advocate roll:', roll.toFixed(2), '/ threshold:', advocateP)
      if (roll < advocateP) {
        const delay = 8000 + Math.random() * 8000
        console.log('[REACTION] scheduling Advocate for user msg, delay:', Math.round(delay))
        schedule(async () => {
          const advMsg = await fireUser('advocate', promptAdvocateOnUserMsg(text, ctx), false)
          if (!advMsg) return
          lastReaction = { agent: 'advocate', msgIndex: index }
        }, delay)
      }
    }

    // ── Contrarian on direction-change messages ───────────────────────────────
    let contrarianP = 0
    if (has(text, CONTRARIAN_KEYWORDS)) contrarianP = 0.60
    if (contrarianP > 0) {
      const roll = Math.random()
      console.log('[REACTION] Contrarian roll:', roll.toFixed(2), '/ threshold:', contrarianP)
      if (roll < contrarianP) {
        const delay = 12000 + Math.random() * 8000
        console.log('[REACTION] scheduling Contrarian for user msg, delay:', Math.round(delay))
        schedule(async () => {
          const contrMsg = await fireUser('contrarian', promptContrarianOnUserMsg(text, ctx), false)
          if (!contrMsg) return
          lastReaction = { agent: 'contrarian', msgIndex: index }
        }, delay)
      }
    }
  }

  return {
    onScribeMessage,
    onUserMessage,
    onNewMessage: clearAll,    // call when user sends — cancels previous turn's pending reactions
    onUserActivity: () => {},  // kept for compat — no longer clears timers
    destroy: clearAll,
  }
}
