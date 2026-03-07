import { useState, useRef, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are The Guide — a knowledgeable, warm, and unhurried assistant for The Vault ecosystem. You help people understand what The Vault is, how to use it, and who to talk to for what.

THE VAULT ECOSYSTEM — YOUR FULL KNOWLEDGE:

THE VAULT is a private collaborative thinking environment — not a project manager, not a wiki, not a chat tool. It is the room where ideas become decisions, decisions become builds, and builds become shipped software. Everything is private until explicitly shared.

BACKRONYM: V — Vision of, A — Active, U — Unified, L — Living, T — Thought

---

THE NOTES EDITOR:
- Clean distraction-free writing surface. Title is large. Body is readable.
- Auto-saves every keystroke. You never lose work.
- Every note has a visibility state: Private (only you, AI cannot see it) or Shared to Enclave (enclave members can see it, AI uses it as context).
- Pin notes to the Board with one click.
- Voice input button transcribes speech into the active input — does not auto-send.

THE ARCHIVE:
- Long-term memory of The Vault. Notes that are no longer active but should never be lost live here.
- Fully searchable. Forms the historical record of every decision the team has made.

---

ENCLAVES:
- A private shared workspace for a team.
- Notes shared to an enclave are visible to all members and used as AI context in the Lattice.
- To create: click the enclave badge in the topbar → "+ Create Enclave" → enter name → Create.
- Roles: Owner (invite/remove members, approve builds, set budget) and Member (read/write shared notes, participate in Lattice).

---

THE LATTICE:
- The AI conversation panel. A council of seven minds, each owning a distinct domain.
- Sleep mode activates after 8 minutes of inactivity.
- Summon The Scribe by typing /scribe.
- Address The Steward directly by starting with "Steward, ..."

---

THE SEVEN AGENTS:

1. THE ARCHITECT — Structure & Systems. "How should this be built?" Dry, precise. Avatar: blueprint grid with scanning iris.
2. THE SPARK — Possibility & Energy. "What could this become?" Fast, expansive. Avatar: asymmetric eyes, orbiting stars.
3. THE SCRIBE — Execution & Craft. "Can we build it?" Summoned via /scribe. Translates intent into code, narrates in human language. Avatar: quill nib, ink drop.
4. THE STEWARD — Budget, Roadmap & Health. "Is it worth it over time?" Intercepts every build with cost estimate, requires owner approval. Address: "Steward, ..." Avatar: leather ledger, wax seal.
5. THE ADVOCATE — User Experience. "Does it serve the human?" Fires on UI keywords: modal, screen, flow, error. Never blocks — refines. Avatar: draftsman's compass, partial arc.
6. THE CONTRARIAN — Reasoning & Logic. "Should it exist at all?" Lowest base probability — scarcity gives weight. Not cynical, rigorous. Avatar: balance scale, always slightly tilted.
7. SOCRA — Observation. Passive. One sentence, always an observation. Cannot be summoned. Never announces himself.

THE ROOM DIVIDES: Advocate + Contrarian fire together ~15% of qualifying builds. Rare and significant.

---

THE BOARD:
- Smart sticky notes. Press S to drop a sticky.
- Smart detection: dates, note names, @mentions, #tags, URLs, metrics.
- Column types: Freeform, Pipeline, Date sorted, Priority, Archive.
- AI: Summary mode, Auto-cluster, Prep mode for meetings.
- Stale detection at 14 days.

---

THE DARK FACTORY (high level only):
- Five layers: Vault (thinking) → Scribe (translation) → Bridge (gateway) → Dark Factory (execution) → Codebase (output).
- Thinking becomes deployed code. Team sees only The Scribe's narration. ~45 seconds from approval to live.
- Every build gated by Steward estimate + owner approval.

---

THE STEWARD DETAIL:
- Estimate card: Scope, Effort, API cost, Risk, Touches, Budget status, Commentary.
- The Ledger (Enclave Settings → Ledger): budget, spend history, build log, project health.
- Unprompted at 60%, 80%, 100% budget and month end.

---

MOBILE & VOICE:
- Mobile: bottom navigation — Home, Board, Voice, Menu.
- Voice: tap to start/stop, interim ghost text, does not auto-send.
- Voice notes: saved to Archive with transcript + audio. Inline player.

---

NOTE-TAKING:
If someone says "take a note" or "remember this" — acknowledge warmly, confirm what you've noted, offer to summarize all notes at session end.

---

WHAT YOU WILL NOT SHARE:
Source code, file names, database schema, API keys, partnership agreement terms, financial details, or anything constituting IP disclosure. Say warmly: "That's not something I can share here — but I can tell you what it does and how to use it."

---

YOUR VOICE:
Warm, precise, unhurried. Complete thoughts. Match the pace of who you're talking to. You are not a FAQ bot — you are a thoughtful guide who has been here from the beginning. Short when short serves. Full when needed. If you don't know something, say so honestly.`;

// ─────────────────────────────────────────────
// SUGGESTED PROMPTS — rotate through these
// ─────────────────────────────────────────────
const SUGGESTIONS = [
  "What is The Vault?",
  "Who are the seven agents?",
  "How do enclaves work?",
  "What does The Steward do?",
  "How does The Dark Factory work?",
  "What is The Scribe?",
  "When does The Contrarian speak?",
  "What is The Archive?",
  "How do I use the Board?",
  "What is The Lattice?",
];

// ─────────────────────────────────────────────
// IDLE PHRASES — The Guide breathes when quiet
// ─────────────────────────────────────────────
const IDLE_PHRASES = [
  "Watching quietly.",
  "The Vault is listening.",
  "Ask me anything.",
  "Here when you need me.",
  "Seven agents, one room.",
  "The thinking never stops.",
];

// ─────────────────────────────────────────────
// COMPASS AVATAR — animated SVG
// ─────────────────────────────────────────────
function CompassAvatar({ size = 44, thinking = false, idle = false, open = false }) {
  const r = size / 2;
  const cx = r, cy = r;
  const circleR = r * 0.72;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <radialGradient id="bgGrad" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#2a2318" />
          <stop offset="100%" stopColor="#0f0e0c" />
        </radialGradient>
        <radialGradient id="emberGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c44e18" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#c44e18" stopOpacity="0" />
        </radialGradient>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Outer glow when thinking */}
      {thinking && (
        <circle cx={cx} cy={cy} r={r + 4} fill="url(#emberGlow)" style={{ animation: "avatarPulse 1s ease-in-out infinite" }} />
      )}

      {/* Background circle */}
      <circle cx={cx} cy={cy} r={r - 1} fill="url(#bgGrad)" />

      {/* Outer ring */}
      <circle
        cx={cx} cy={cy} r={r - 2}
        fill="none"
        stroke="#c44e18"
        strokeWidth="1.2"
        strokeDasharray={thinking ? "3 3" : open ? `${2 * Math.PI * (r - 2) * 0.85} ${2 * Math.PI * (r - 2) * 0.15}` : `${2 * Math.PI * (r - 2)}`}
        style={{
          transformOrigin: `${cx}px ${cy}px`,
          animation: thinking ? "spin 2s linear infinite" : idle ? "idleSpin 12s linear infinite" : "none",
          transition: "stroke-dasharray 0.6s ease",
        }}
      />

      {/* Inner tick marks */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const isCardinal = deg % 90 === 0;
        const outerR = circleR - 1;
        const innerR = outerR - (isCardinal ? 5 : 3);
        return (
          <line
            key={i}
            x1={cx + Math.cos(rad) * innerR}
            y1={cy + Math.sin(rad) * innerR}
            x2={cx + Math.cos(rad) * outerR}
            y2={cy + Math.sin(rad) * outerR}
            stroke={isCardinal ? "#c44e18" : "#3a3530"}
            strokeWidth={isCardinal ? "1.2" : "0.8"}
            strokeLinecap="round"
          />
        );
      })}

      {/* Compass needle — north (up) is ember, south is dim */}
      <g style={{
        transformOrigin: `${cx}px ${cy}px`,
        animation: thinking ? "needleWobble 0.8s ease-in-out infinite alternate" : idle ? "needleDrift 6s ease-in-out infinite" : "none",
      }}>
        {/* North needle */}
        <polygon
          points={`${cx},${cy - circleR * 0.55} ${cx - 3},${cy + 2} ${cx + 3},${cy + 2}`}
          fill="#c44e18"
          filter="url(#softGlow)"
        />
        {/* South needle */}
        <polygon
          points={`${cx},${cy + circleR * 0.45} ${cx - 2.5},${cy - 2} ${cx + 2.5},${cy - 2}`}
          fill="#3a3530"
        />
        {/* Center jewel */}
        <circle cx={cx} cy={cy} r="2.5" fill="#0f0e0c" stroke="#c44e18" strokeWidth="1" />
        <circle cx={cx} cy={cy} r="1.2" fill="#c44e18" style={{ animation: thinking ? "jewelPulse 0.6s ease-in-out infinite alternate" : "none" }} />
      </g>

      {/* Thinking dots — arc below needle */}
      {thinking && [0, 1, 2].map(i => (
        <circle
          key={i}
          cx={cx + (i - 1) * 5}
          cy={cy + r * 0.3}
          r="1.8"
          fill="#c44e18"
          style={{ animation: `dotBounce 1s ease-in-out ${i * 0.18}s infinite` }}
        />
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function TheGuideWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionNotes, setSessionNotes] = useState([]);
  const [idlePhrase, setIdlePhrase] = useState(IDLE_PHRASES[0]);
  const [idleVisible, setIdleVisible] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [unread, setUnread] = useState(0);
  const [isIdle, setIsIdle] = useState(true);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const conversationRef = useRef([]);
  const idleTimer = useRef(null);
  const idlePhraseTimer = useRef(null);
  const phraseIndex = useRef(0);

  // Idle phrase cycling
  useEffect(() => {
    if (open) { setIdleVisible(false); return; }
    const cycle = () => {
      setIdleVisible(false);
      setTimeout(() => {
        phraseIndex.current = (phraseIndex.current + 1) % IDLE_PHRASES.length;
        setIdlePhrase(IDLE_PHRASES[phraseIndex.current]);
        setIdleVisible(true);
        setTimeout(() => setIdleVisible(false), 3500);
      }, 400);
    };
    // Show first phrase after 4s, then cycle every 8s
    const first = setTimeout(() => { setIdleVisible(true); setIdlePhrase(IDLE_PHRASES[0]); setTimeout(() => setIdleVisible(false), 3500); }, 4000);
    idlePhraseTimer.current = setInterval(cycle, 8000);
    return () => { clearTimeout(first); clearInterval(idlePhraseTimer.current); };
  }, [open]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
      setUnread(0);
      if (!hasGreeted) {
        setHasGreeted(true);
        setTimeout(() => {
          const greet = {
            role: "assistant",
            content: "Welcome. I'm The Guide — I know The Vault inside out, and I'm here to help you find your way around it.\n\nAsk me about any feature, any agent, or how to do something. I can also take notes for you — just say \"take a note\" and tell me what to remember.",
            id: "welcome",
          };
          setMessages([greet]);
          conversationRef.current = [];
        }, 350);
      }
    }
  }, [open, hasGreeted]);

  const isNoteRequest = (t) => /take a note|note this|remember this|write (this|that) down|jot/i.test(t);
  const isShowNotes = (t) => /show (my )?notes|what('s| are) my notes|summarize (my )?notes/i.test(t);

  const send = useCallback(async (text) => {
    const userText = (text || input).trim();
    if (!userText || loading) return;
    setInput("");
    setShowSuggestions(false);
    setIsIdle(false);

    const uid = Date.now() + "u";
    const userMsg = { role: "user", content: userText, id: uid };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Note handling
    if (isNoteRequest(userText)) {
      const note = userText.replace(/^(take a note|note this|remember this|write (this|that) down|jot (this|that)):?\s*/i, "").trim();
      if (note) setSessionNotes(prev => [...prev, note]);
      const count = sessionNotes.length + (note ? 1 : 0);
      const aid = Date.now() + "a";
      const reply = {
        role: "assistant",
        content: note ? `Noted. ${count} note${count !== 1 ? "s" : ""} held for this session. Say "show my notes" whenever you want them.` : "What would you like me to note?",
        id: aid, isNote: !!note,
      };
      setMessages(prev => [...prev, reply]);
      setLoading(false);
      conversationRef.current.push({ role: "user", content: userText }, { role: "assistant", content: reply.content });
      return;
    }

    if (isShowNotes(userText)) {
      const aid = Date.now() + "a";
      const content = sessionNotes.length === 0
        ? "No notes yet this session. Say \"take a note\" followed by what you'd like to remember."
        : `Your notes this session:\n\n${sessionNotes.map((n, i) => `${i + 1}. ${n}`).join("\n")}`;
      setMessages(prev => [...prev, { role: "assistant", content, id: aid }]);
      setLoading(false);
      return;
    }

    conversationRef.current.push({ role: "user", content: userText });

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: conversationRef.current,
        }),
      });
      const data = await res.json();
      const replyText = data.content?.find(b => b.type === "text")?.text || "Something went quiet. Try again.";
      const aid = Date.now() + "a";
      conversationRef.current.push({ role: "assistant", content: replyText });
      setMessages(prev => [...prev, { role: "assistant", content: replyText, id: aid }]);
      if (!open) setUnread(u => u + 1);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Something went quiet on my end. Try again in a moment.", id: Date.now() + "e" }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [input, loading, open, sessionNotes]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400;1,6..72,500&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }

        @keyframes avatarPulse { 0%,100%{opacity:0.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.15)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes idleSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes needleWobble { from{transform:rotate(-8deg)} to{transform:rotate(8deg)} }
        @keyframes needleDrift { 0%,100%{transform:rotate(-3deg)} 50%{transform:rotate(3deg)} }
        @keyframes dotBounce { 0%,100%{transform:translateY(0);opacity:0.4} 50%{transform:translateY(-4px);opacity:1} }
        @keyframes jewelPulse { from{opacity:0.6} to{opacity:1} }

        @keyframes widgetOpen {
          from { opacity:0; transform:scale(0.88) translateY(16px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
        @keyframes widgetClose {
          from { opacity:1; transform:scale(1) translateY(0); }
          to   { opacity:0; transform:scale(0.88) translateY(16px); }
        }
        @keyframes msgIn {
          from { opacity:0; transform:translateY(6px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes phraseIn {
          from { opacity:0; transform:translateX(-6px); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes phraseOut {
          from { opacity:1; transform:translateX(0); }
          to   { opacity:0; transform:translateX(-6px); }
        }
        @keyframes unreadPop {
          0%   { transform:scale(0); }
          60%  { transform:scale(1.3); }
          100% { transform:scale(1); }
        }
        @keyframes breathe {
          0%,100% { box-shadow: 0 0 0 0 rgba(196,78,24,0); }
          50%      { box-shadow: 0 0 0 8px rgba(196,78,24,0.08); }
        }
        @keyframes grainDrift {
          0%   { transform:translate(0,0); }
          100% { transform:translate(-50px,-50px); }
        }

        .guide-fab {
          position:fixed; bottom:28px; left:28px; z-index:9999;
          width:56px; height:56px; border-radius:50%;
          background: radial-gradient(circle at 35% 30%, #2a2318, #0f0e0c);
          border:1.5px solid #c44e18;
          cursor:pointer; display:flex; align-items:center; justify-content:center;
          transition:transform 0.2s ease, border-color 0.3s ease;
          animation:breathe 4s ease-in-out infinite;
          box-shadow:0 4px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(196,78,24,0.15);
        }
        .guide-fab:hover {
          transform:scale(1.08);
          border-color:#d85c22;
          animation:none;
          box-shadow:0 6px 32px rgba(0,0,0,0.7), 0 0 20px rgba(196,78,24,0.2);
        }
        .guide-fab:active { transform:scale(0.95); }

        .guide-panel {
          position:fixed; bottom:96px; left:28px; z-index:9998;
          width:360px; height:520px;
          background:#0f0e0c;
          border:1px solid #2e2b27;
          border-radius:16px;
          display:flex; flex-direction:column;
          overflow:hidden;
          box-shadow:0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(196,78,24,0.08), inset 0 1px 0 rgba(255,255,255,0.03);
        }
        .guide-panel.entering { animation:widgetOpen 0.32s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .guide-panel.exiting  { animation:widgetClose 0.22s ease-in forwards; }

        .msg { animation:msgIn 0.28s ease forwards; }

        .guide-input {
          background:none; border:none; outline:none;
          color:#e8e0d5; font-family:'Lora',serif; font-size:15px;
          line-height:1.6; resize:none; width:100%;
          max-height:100px; overflow-y:auto;
        }
        .guide-input::placeholder { color:#3a3530; }
        .guide-input::-webkit-scrollbar { width:3px; }
        .guide-input::-webkit-scrollbar-thumb { background:#2e2b27; border-radius:2px; }

        .guide-scroll { overflow-y:auto; }
        .guide-scroll::-webkit-scrollbar { width:3px; }
        .guide-scroll::-webkit-scrollbar-thumb { background:#2a2520; border-radius:2px; }

        .suggestion-chip {
          background:#1a1815; border:1px solid #2e2b27;
          border-radius:20px; padding:5px 12px;
          font-size:12px; color:#6a6460;
          cursor:pointer; white-space:nowrap;
          font-family:'Lora',serif;
          transition:all 0.18s ease;
          flex-shrink:0;
        }
        .suggestion-chip:hover { background:#252220; border-color:#c44e1855; color:#e8e0d5; }

        .send-btn {
          width:32px; height:32px; border-radius:8px;
          background:#c44e18; border:none; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          flex-shrink:0; transition:background 0.18s, transform 0.1s;
        }
        .send-btn:hover:not(:disabled) { background:#d85c22; transform:scale(1.05); }
        .send-btn:active:not(:disabled) { transform:scale(0.95); }
        .send-btn:disabled { opacity:0.3; cursor:not-allowed; }

        .idle-phrase {
          position:absolute; bottom:68px; left:72px;
          background:#1a1815; border:1px solid #2e2b27;
          border-radius:12px; padding:7px 12px;
          font-family:'Lora',serif; font-style:italic;
          font-size:13px; color:#6a6460;
          white-space:nowrap; pointer-events:none;
          max-width:220px;
        }
        .idle-phrase::before {
          content:''; position:absolute; left:-7px; bottom:10px;
          width:0; height:0;
          border-top:5px solid transparent;
          border-bottom:5px solid transparent;
          border-right:7px solid #2e2b27;
        }
        .idle-phrase::after {
          content:''; position:absolute; left:-5.5px; bottom:11px;
          width:0; height:0;
          border-top:4px solid transparent;
          border-bottom:4px solid transparent;
          border-right:6px solid #1a1815;
        }
        .idle-phrase.visible { animation:phraseIn 0.3s ease forwards; opacity:1; }
        .idle-phrase.hidden  { animation:phraseOut 0.3s ease forwards; }

        .unread-badge {
          position:absolute; top:-2px; right:-2px;
          width:18px; height:18px; border-radius:50%;
          background:#c44e18; border:2px solid #0f0e0c;
          display:flex; align-items:center; justify-content:center;
          font-size:10px; font-weight:700; color:white;
          font-family:'JetBrains Mono',monospace;
          animation:unreadPop 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }

        /* grain overlay */
        .guide-panel::before {
          content:'';
          position:absolute; inset:0; z-index:0; pointer-events:none;
          opacity:0.03;
          background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          background-size:150px 150px;
          animation:grainDrift 8s steps(10) infinite;
        }
      `}</style>

      {/* IDLE PHRASE BUBBLE */}
      {!open && (
        <div className={`idle-phrase ${idleVisible ? "visible" : "hidden"}`} style={{ position: "fixed", bottom: 96, left: 90, zIndex: 9997 }}>
          {idlePhrase}
        </div>
      )}

      {/* FAB BUTTON */}
      <div className="guide-fab" onClick={() => setOpen(o => !o)} style={{ position: "fixed" }}>
        <CompassAvatar size={34} thinking={loading && open} idle={!open} open={open} />
        {unread > 0 && !open && (
          <div className="unread-badge">{unread}</div>
        )}
      </div>

      {/* CHAT PANEL */}
      {open && (
        <div className="guide-panel entering" style={{ position: "fixed" }}>

          {/* Header */}
          <div style={{
            padding: "14px 16px 12px",
            borderBottom: "1px solid #1e1c19",
            display: "flex", alignItems: "center", gap: 12,
            flexShrink: 0, position: "relative", zIndex: 1,
            background: "linear-gradient(180deg, #141210 0%, #0f0e0c 100%)",
          }}>
            <CompassAvatar size={36} thinking={loading} idle={false} open={true} />
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: "'Lora', serif",
                fontSize: 17, fontWeight: 600,
                color: "#e8e0d5", letterSpacing: "0.02em",
              }}>
                The Guide
              </div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9.5, color: "#c44e18",
                letterSpacing: "0.14em", marginTop: 1,
              }}>
                {loading ? "THINKING..." : "VAULT KNOWLEDGE"}
              </div>
            </div>
            {sessionNotes.length > 0 && (
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10, color: "#a07828",
                padding: "3px 8px",
                background: "#a0782812",
                border: "1px solid #a0782833",
                borderRadius: 10,
              }}>
                ◆ {sessionNotes.length}
              </div>
            )}
            <button onClick={() => setOpen(false)} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#3a3530", fontSize: 18, lineHeight: 1,
              padding: "2px 4px", transition: "color 0.15s",
            }}
              onMouseEnter={e => e.target.style.color = "#6a6460"}
              onMouseLeave={e => e.target.style.color = "#3a3530"}
            >×</button>
          </div>

          {/* Messages */}
          <div className="guide-scroll" style={{ flex: 1, padding: "16px 14px 8px", position: "relative", zIndex: 1 }}>
            {messages.map((msg, i) => {
              const isGuide = msg.role === "assistant";
              return (
                <div
                  key={msg.id}
                  className="msg"
                  style={{
                    display: "flex",
                    flexDirection: isGuide ? "row" : "row-reverse",
                    gap: 8, marginBottom: 14,
                    animationDelay: `${i === messages.length - 1 ? 0 : 0}ms`,
                  }}
                >
                  {isGuide && (
                    <div style={{ flexShrink: 0, marginTop: 2 }}>
                      <CompassAvatar size={26} />
                    </div>
                  )}
                  <div style={{
                    maxWidth: "82%",
                    background: isGuide ? "#1a1815" : "#252220",
                    border: `1px solid ${isGuide ? "#252220" : "transparent"}`,
                    borderRadius: isGuide ? "2px 10px 10px 10px" : "10px 2px 10px 10px",
                    padding: "9px 12px",
                    fontSize: 13.5,
                    lineHeight: 1.68,
                    color: isGuide ? "#d8d0c5" : "#b0a898",
                    fontFamily: "'Lora', serif",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}>
                    {isGuide && (
                      <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 8.5, color: "#c44e18",
                        letterSpacing: "0.14em", marginBottom: 5,
                        fontWeight: 500,
                      }}>
                        THE GUIDE
                      </div>
                    )}
                    {msg.content}
                    {msg.isNote && (
                      <div style={{
                        marginTop: 8, padding: "5px 9px",
                        background: "#0f0e0c",
                        border: "1px solid #a0782833",
                        borderRadius: 5, fontSize: 11,
                        color: "#a07828",
                        fontFamily: "'JetBrains Mono', monospace",
                        letterSpacing: "0.06em",
                      }}>
                        ◆ saved
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="msg" style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  <CompassAvatar size={26} thinking={true} />
                </div>
                <div style={{
                  background: "#1a1815", border: "1px solid #252220",
                  borderRadius: "2px 10px 10px 10px",
                  padding: "12px 16px",
                  display: "flex", gap: 5, alignItems: "center",
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 5, height: 5, borderRadius: "50%",
                      background: "#c44e18",
                      animation: `dotBounce 1s ease-in-out ${i * 0.18}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {showSuggestions && messages.length <= 1 && (
            <div style={{
              padding: "0 14px 10px",
              display: "flex", gap: 6,
              overflowX: "auto", flexShrink: 0,
              position: "relative", zIndex: 1,
            }}
              className="guide-scroll"
            >
              {SUGGESTIONS.slice(0, 6).map((s, i) => (
                <button key={i} className="suggestion-chip" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: "10px 14px 14px",
            borderTop: "1px solid #1a1815",
            flexShrink: 0, position: "relative", zIndex: 1,
            background: "linear-gradient(0deg, #0d0c0a 0%, #0f0e0c 100%)",
          }}>
            <div style={{
              display: "flex", gap: 8, alignItems: "flex-end",
              background: "#1a1815",
              border: "1px solid #2e2b27",
              borderRadius: 10,
              padding: "9px 10px",
            }}>
              <textarea
                ref={inputRef}
                className="guide-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask anything about The Vault..."
                rows={1}
                onInput={e => {
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
                }}
              />
              <button className="send-btn" onClick={() => send()} disabled={!input.trim() || loading}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M6.5 1L12 6.5L6.5 12M1 6.5H12" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div style={{
              textAlign: "center", marginTop: 7,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9, color: "#2e2b27",
              letterSpacing: "0.1em",
            }}>
              VAULT KNOWLEDGE · IP PROTECTED
            </div>
          </div>
        </div>
      )}
    </>
  );
}
