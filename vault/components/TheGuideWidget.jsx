'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/vault'

const PALETTE = {
  bg:      '#0f0e0c',
  surface: '#1a1815',
  border:  '#2e2b27',
  ember:   '#c44e18',
  gold:    '#a07828',
  text:    '#e8e0d5',
  muted:   '#6a6460',
  dim:     '#3a3530',
  note_bg: '#1e1c19',
}

const SUGGESTED = [
  'What is The Vault?',
  'Who are the seven agents?',
  'How do I create an enclave?',
  'What is The Scribe?',
  'How does The Dark Factory work?',
  'What does The Steward do?',
  'How do I use the Board?',
  'When does The Contrarian speak?',
]

function GuideAvatar({ thinking, size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 35%, #2a2520, #0f0e0c)',
      border: `1.5px solid ${PALETTE.ember}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, position: 'relative',
      boxShadow: thinking ? `0 0 12px ${PALETTE.ember}55` : 'none',
      transition: 'box-shadow 0.4s ease',
    }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="7" stroke={PALETTE.ember} strokeWidth="1.2"
          strokeDasharray={thinking ? '2 2' : '44'}
          style={{ transition: 'stroke-dasharray 0.5s' }} />
        <line x1="9" y1="3" x2="9" y2="7" stroke={PALETTE.ember} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="9" y1="11" x2="9" y2="14" stroke={PALETTE.muted} strokeWidth="1" strokeLinecap="round" />
        <line x1="3" y1="9" x2="6" y2="9" stroke={PALETTE.muted} strokeWidth="1" strokeLinecap="round" />
        <line x1="12" y1="9" x2="15" y2="9" stroke={PALETTE.muted} strokeWidth="1" strokeLinecap="round" />
        <circle cx="9" cy="9" r="1.5" fill={PALETTE.ember} />
      </svg>
      {thinking && (
        <div style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 8, height: 8, borderRadius: '50%',
          background: PALETTE.ember,
          animation: 'guideWidgetPulse 1s ease-in-out infinite',
        }} />
      )}
    </div>
  )
}

function GuideMessage({ msg, isNew }) {
  const isGuide = msg.role === 'assistant'
  return (
    <div style={{
      display: 'flex', gap: 10, marginBottom: 18,
      flexDirection: isGuide ? 'row' : 'row-reverse',
      animation: isNew ? 'guideWidgetFadeUp 0.25s ease forwards' : 'none',
      opacity: isNew ? 0 : 1,
    }}>
      {isGuide && <GuideAvatar thinking={false} size={28} />}
      <div style={{
        maxWidth: '82%',
        background: isGuide ? PALETTE.surface : PALETTE.dim,
        border: `1px solid ${isGuide ? PALETTE.border : 'transparent'}`,
        borderRadius: isGuide ? '2px 10px 10px 10px' : '10px 2px 10px 10px',
        padding: '10px 14px',
        fontSize: 13.5,
        lineHeight: 1.65,
        color: isGuide ? PALETTE.text : '#c8c0b5',
        fontFamily: "'Georgia', serif",
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {isGuide && (
          <div style={{ fontSize: 9.5, color: PALETTE.ember, fontFamily: 'monospace', letterSpacing: '0.14em', marginBottom: 5, fontWeight: 700 }}>
            THE GUIDE
          </div>
        )}
        {msg.streaming ? msg.content + '▍' : msg.content}
        {msg.isNote && (
          <div style={{
            marginTop: 8, padding: '6px 10px',
            background: PALETTE.note_bg,
            border: `1px solid ${PALETTE.gold}44`,
            borderRadius: 4, fontSize: 11.5,
            color: PALETTE.gold, fontFamily: 'monospace',
          }}>
            ◆ Note saved
          </div>
        )}
      </div>
    </div>
  )
}

function ThinkingDots() {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
      <GuideAvatar thinking size={28} />
      <div style={{
        background: PALETTE.surface, border: `1px solid ${PALETTE.border}`,
        borderRadius: '2px 10px 10px 10px',
        padding: '12px 16px', display: 'flex', gap: 5, alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 5, height: 5, borderRadius: '50%', background: PALETTE.ember,
            animation: `guideWidgetBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
    </div>
  )
}

export default function TheGuideWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: "Welcome. I'm The Guide — I know The Vault inside out.\n\nAsk me about any feature, any agent, or how to do something. I can also take notes during our conversation — just say \"take a note\".",
    id: 'welcome',
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionNotes, setSessionNotes] = useState([])
  const [showNotes, setShowNotes] = useState(false)
  const [newIds, setNewIds] = useState(new Set())
  const [pos, setPos] = useState({ x: 28, y: 600 })
  const [dragging, setDragging] = useState(false)

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const conversationRef = useRef([])
  const posRef = useRef(pos)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const dragStartRef = useRef(null)
  const dragMovedRef = useRef(false)

  // Restore saved position on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('guide-fab-pos')
      if (saved) {
        const p = JSON.parse(saved)
        setPos(p); posRef.current = p
      } else {
        const p = { x: 28, y: window.innerHeight - 84 }
        setPos(p); posRef.current = p
      }
    } catch {}
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => inputRef.current?.focus(), 120)
    }
  }, [open, messages, loading])

  // Start drag — shared by FAB and panel header
  const startDrag = useCallback((clientX, clientY) => {
    dragOffsetRef.current = { x: clientX - posRef.current.x, y: clientY - posRef.current.y }
    dragStartRef.current = { x: clientX, y: clientY }
    dragMovedRef.current = false
    setDragging(true)
  }, [])

  // Drag move + end listeners (mouse and touch unified)
  useEffect(() => {
    if (!dragging) return
    const FAB = 48

    const onMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const clientY = e.touches ? e.touches[0].clientY : e.clientY
      if (dragStartRef.current) {
        const d = Math.hypot(clientX - dragStartRef.current.x, clientY - dragStartRef.current.y)
        if (d > 4) dragMovedRef.current = true
      }
      let nx = clientX - dragOffsetRef.current.x
      let ny = clientY - dragOffsetRef.current.y
      nx = Math.max(0, Math.min(window.innerWidth - FAB, nx))
      ny = Math.max(0, Math.min(window.innerHeight - FAB, ny))
      const newPos = { x: nx, y: ny }
      setPos(newPos)
      posRef.current = newPos
    }

    const onEnd = () => {
      setDragging(false)
      try { localStorage.setItem('guide-fab-pos', JSON.stringify(posRef.current)) } catch {}
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onEnd)
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onEnd)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
    }
  }, [dragging])

  // Panel opens above FAB if FAB is in bottom half of screen
  const openAbove = pos.y > (typeof window !== 'undefined' ? window.innerHeight : 800) / 2
  // Clamp panel horizontally so it doesn't overflow the right edge
  const panelOffsetX = typeof window !== 'undefined'
    ? Math.min(0, window.innerWidth - pos.x - 400 - 8)
    : 0
  const panelTop = openAbove ? -(560 + 8) : (48 + 8)

  const isNoteRequest = (t) => /take a note|note this|remember this|write (this|that) down|jot (this|that)/i.test(t)
  const extractNote = (t) => t.replace(/^(take a note|note this|remember this|write (this|that) down|jot (this|that)):?\s*/i, '').trim()

  async function send(text) {
    const userText = (text || input).trim()
    if (!userText || loading) return
    setInput('')

    const userMsg = { role: 'user', content: userText, id: Date.now() + 'u' }
    setMessages(prev => [...prev, userMsg])
    setNewIds(prev => new Set([...prev, userMsg.id]))
    setLoading(true)

    if (isNoteRequest(userText)) {
      const noteContent = extractNote(userText)
      if (noteContent) setSessionNotes(prev => [...prev, noteContent])
      const count = sessionNotes.length + (noteContent ? 1 : 0)
      const replyId = Date.now() + 'a'
      const reply = {
        role: 'assistant',
        content: noteContent
          ? `Noted. I have ${count} note${count !== 1 ? 's' : ''} for you this session.`
          : "I'd be happy to take a note — what would you like me to remember?",
        id: replyId, isNote: !!noteContent,
      }
      setMessages(prev => [...prev, reply])
      setNewIds(prev => new Set([...prev, replyId]))
      conversationRef.current = [...conversationRef.current, userMsg, reply]
      setLoading(false)
      return
    }

    if (/show (my )?notes|what('s| is| are) my notes|summarize (my )?notes/i.test(userText)) {
      const replyId = Date.now() + 'a'
      const reply = {
        role: 'assistant',
        content: sessionNotes.length === 0
          ? 'No notes yet this session. Say "take a note" followed by what you want to remember.'
          : `Your notes this session:\n\n${sessionNotes.map((n, i) => `${i + 1}. ${n}`).join('\n')}`,
        id: replyId,
      }
      setMessages(prev => [...prev, reply])
      setNewIds(prev => new Set([...prev, replyId]))
      setLoading(false)
      return
    }

    conversationRef.current = [...conversationRef.current, { role: 'user', content: userText }]

    const streamId = Date.now() + 'a'
    setMessages(prev => [...prev, { role: 'assistant', content: '', id: streamId, streaming: true }])
    setNewIds(prev => new Set([...prev, streamId]))

    try {
      const res = await fetch(`${API_BASE}/api/chat/guide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversationRef.current }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let text = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += dec.decode(value, { stream: true })
        setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: text } : m))
      }

      conversationRef.current = [...conversationRef.current, { role: 'assistant', content: text }]
      setMessages(prev => prev.map(m => m.id === streamId ? { ...m, streaming: false } : m))
    } catch {
      setMessages(prev => prev.map(m => m.id === streamId
        ? { ...m, content: 'Something went quiet on my end. Try again in a moment.', streaming: false }
        : m
      ))
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  return (
    <>
      <style>{`
        @keyframes guideWidgetFadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes guideWidgetBounce {
          0%, 80%, 100% { transform: translateY(0); }
          40%           { transform: translateY(-5px); }
        }
        @keyframes guideWidgetPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(0.7); }
        }
        @keyframes guideWidgetSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .guide-trigger:hover { box-shadow: 0 0 18px ${PALETTE.ember}55 !important; }
        .guide-trigger { transition: box-shadow 0.2s !important; }
        .guide-suggestion:hover { background: #2e2b27 !important; border-color: ${PALETTE.ember}55 !important; color: ${PALETTE.text} !important; }
        .guide-send:hover:not(:disabled) { background: #a83e10 !important; }
        .guide-send:disabled { opacity: 0.35; cursor: not-allowed; }
        .guide-messages::-webkit-scrollbar { width: 3px; }
        .guide-messages::-webkit-scrollbar-track { background: transparent; }
        .guide-messages::-webkit-scrollbar-thumb { background: #2e2b27; border-radius: 2px; }
        .guide-drag-handle:hover { background: rgba(255,255,255,0.02) !important; }
      `}</style>

      <div style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9500 }}>

        {/* FAB — shown when panel is closed */}
        {!open && (
          <button
            className="guide-trigger"
            onMouseDown={e => { if (e.button === 0) { e.preventDefault(); startDrag(e.clientX, e.clientY) } }}
            onTouchStart={e => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
            onClick={() => { if (!dragMovedRef.current) setOpen(true) }}
            title="The Guide — drag to reposition · click to open"
            style={{
              width: 48, height: 48, borderRadius: '50%', border: 'none',
              background: PALETTE.bg,
              cursor: dragging ? 'grabbing' : 'grab',
              padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 2px 16px rgba(0,0,0,0.5), 0 0 0 1.5px ${PALETTE.ember}`,
              userSelect: 'none',
            }}
          >
            <GuideAvatar thinking={false} size={48} />
          </button>
        )}

        {/* Panel — shown when open */}
        {open && (
          <div style={{
            position: 'absolute',
            top: panelTop,
            left: panelOffsetX,
            width: 400, height: 560,
            display: 'flex', flexDirection: 'column',
            background: PALETTE.bg,
            border: `1px solid ${PALETTE.border}`,
            borderRadius: 12,
            boxShadow: '0 8px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(196,78,24,0.15)',
            overflow: 'hidden',
            animation: 'guideWidgetSlideUp 0.2s ease forwards',
          }}>

            {/* Header — drag handle for panel */}
            <div
              className="guide-drag-handle"
              onMouseDown={e => { if (e.button === 0) { e.preventDefault(); startDrag(e.clientX, e.clientY) } }}
              onTouchStart={e => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
              style={{
                padding: '14px 16px 12px',
                borderBottom: `1px solid ${PALETTE.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexShrink: 0,
                cursor: dragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <GuideAvatar thinking={loading} size={32} />
                <div>
                  <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 17, fontWeight: 600, letterSpacing: '0.02em', color: PALETTE.text, lineHeight: 1.1 }}>
                    The Guide
                  </div>
                  <div style={{ fontSize: 9.5, color: loading ? PALETTE.ember : PALETTE.muted, fontFamily: 'monospace', letterSpacing: '0.1em', transition: 'color 0.3s' }}>
                    {loading ? 'THINKING...' : 'VAULT KNOWLEDGE BASE'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {sessionNotes.length > 0 && (
                  <button onClick={e => { e.stopPropagation(); setShowNotes(!showNotes) }} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: PALETTE.gold, fontSize: 11, fontFamily: 'monospace',
                    display: 'flex', alignItems: 'center', gap: 4, padding: '2px 4px',
                  }}>
                    ◆ {sessionNotes.length}
                  </button>
                )}
                <button onClick={e => { e.stopPropagation(); setOpen(false) }} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: PALETTE.muted, fontSize: 18, lineHeight: 1,
                  padding: '2px 4px', borderRadius: 4,
                  transition: 'color 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.color = PALETTE.text}
                  onMouseLeave={e => e.currentTarget.style.color = PALETTE.muted}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Notes panel */}
            {showNotes && sessionNotes.length > 0 && (
              <div style={{
                padding: '10px 14px', borderBottom: `1px solid ${PALETTE.border}`,
                background: PALETTE.note_bg, flexShrink: 0,
              }}>
                <div style={{ fontSize: 9.5, color: PALETTE.gold, fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: 6, opacity: 0.7 }}>SESSION NOTES</div>
                {sessionNotes.map((n, i) => (
                  <div key={i} style={{ fontSize: 12.5, color: '#c8a850', lineHeight: 1.5, marginBottom: 4, fontFamily: 'monospace' }}>
                    <span style={{ color: PALETTE.gold, marginRight: 6 }}>{i + 1}.</span>{n}
                  </div>
                ))}
              </div>
            )}

            {/* Messages */}
            <div className="guide-messages" style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 8px' }}>
              {messages.map(msg => (
                <GuideMessage key={msg.id} msg={msg} isNew={newIds.has(msg.id)} />
              ))}
              {loading && !messages.some(m => m.streaming) && <ThinkingDots />}
              <div ref={bottomRef} />
            </div>

            {/* Suggestions — only on first message */}
            {messages.length <= 1 && (
              <div style={{ padding: '0 16px 10px', display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0 }}>
                {SUGGESTED.map((q, i) => (
                  <button key={i} className="guide-suggestion" onClick={() => send(q)} style={{
                    background: PALETTE.surface, border: `1px solid ${PALETTE.border}`,
                    borderRadius: 16, padding: '5px 11px', fontSize: 11.5,
                    color: PALETTE.muted, cursor: 'pointer',
                    fontFamily: "'Georgia', serif", transition: 'all 0.15s',
                  }}>
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div style={{ padding: '10px 14px 14px', borderTop: `1px solid ${PALETTE.border}`, flexShrink: 0 }}>
              <div style={{
                display: 'flex', gap: 8, alignItems: 'flex-end',
                background: PALETTE.surface, border: `1px solid ${PALETTE.border}`,
                borderRadius: 8, padding: '8px 10px',
              }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  placeholder="Ask anything about The Vault..."
                  rows={1}
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none',
                    color: PALETTE.text, fontSize: 13.5, fontFamily: "'Georgia', serif",
                    lineHeight: 1.55, maxHeight: 100, overflowY: 'auto',
                  }}
                  onInput={e => {
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
                  }}
                />
                <button
                  className="guide-send"
                  onClick={() => send()}
                  disabled={!input.trim() || loading}
                  style={{
                    background: PALETTE.ember, border: 'none', borderRadius: 6,
                    width: 30, height: 30, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1L13 7L7 13M1 7H13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
