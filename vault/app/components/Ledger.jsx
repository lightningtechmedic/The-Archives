'use client'

import { useState, useEffect, useMemo } from 'react'

// ── Agent metadata ─────────────────────────────────────────────────────────────
const AGENT_META = {
  claude:     { label: 'The Architect', color: '#d45a20', bg: 'rgba(212,90,32,.08)',   border: 'rgba(212,90,32,.2)' },
  gpt:        { label: 'The Spark',     color: '#c49030', bg: 'rgba(196,144,48,.07)',  border: 'rgba(196,144,48,.18)' },
  scribe:     { label: 'The Scribe',    color: '#5870e0', bg: 'rgba(88,112,224,.07)',  border: 'rgba(88,112,224,.2)' },
  steward:    { label: 'The Steward',   color: '#a07840', bg: 'rgba(160,120,64,.07)',  border: 'rgba(160,120,64,.18)' },
  advocate:   { label: 'The Advocate',  color: '#c86070', bg: 'rgba(200,96,112,.07)',  border: 'rgba(200,96,112,.18)' },
  contrarian: { label: 'The Contrarian',color: '#6888a0', bg: 'rgba(104,136,160,.07)', border: 'rgba(104,136,160,.18)' },
  socra:      { label: 'Socra',         color: '#d8c060', bg: 'rgba(216,192,96,.07)',  border: 'rgba(216,192,96,.18)' },
}

// ── Reminder / date extraction ─────────────────────────────────────────────────
const MONTH_NAMES = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
const MONTH_FULL  = ['january','february','march','april','may','june','july','august','september','october','november','december']

function extractUrgentItems(notes) {
  const TRIGGER_RE = /(?:finalize\s+before|revisit\s+by|don'?t\s+forget|follow[\s-]?up|remind(?:er)?\s+me|due\s+(?:by|on)|deadline|before\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|by\s+(?:friday|monday|tuesday|wednesday|thursday|eod|end\s+of\s+(?:week|day|month)|tomorrow))/gi
  const MONTH_RE   = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:[,\s]+(\d{4}))?/gi
  const QUARTER_RE = /\b(Q[1-4])[\s,]*(\d{4})?/gi

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const items = []
  const seen  = new Set()

  for (const note of notes) {
    const content = note.content || ''
    const lines   = content.split(/\n+/)

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.length < 8) continue
      if (!TRIGGER_RE.test(trimmed)) { TRIGGER_RE.lastIndex = 0; continue }
      TRIGGER_RE.lastIndex = 0

      const key = trimmed.slice(0, 50)
      if (seen.has(key)) continue
      seen.add(key)

      // Try to extract a date
      let dateDisplay = '—'
      let dateMonth   = 'Open'
      let dateObj     = null
      let urgency     = 'cool'

      const mMatch = trimmed.match(MONTH_RE)
      if (mMatch) {
        const raw   = mMatch[0]
        const parts = raw.toLowerCase().split(/\s+/)
        const mIdx  = MONTH_NAMES.indexOf(parts[0].slice(0, 3))
        const day   = parseInt(parts[1], 10) || 1
        const year  = parseInt(parts[2], 10) || today.getFullYear()
        if (mIdx >= 0) {
          dateObj     = new Date(year, mIdx, day)
          dateDisplay = String(day)
          dateMonth   = parts[0].slice(0, 3).toUpperCase()
        }
      }

      const qMatch = trimmed.match(QUARTER_RE)
      if (!mMatch && qMatch) {
        dateDisplay = qMatch[0].split(/\s+/)[0]
        const yr    = qMatch[0].match(/\d{4}/)?.[0] || today.getFullYear()
        dateMonth   = String(yr)
      }

      if (dateObj) {
        const days = Math.floor((dateObj - today) / 86400000)
        if (days >= 0 && days < 7)  urgency = 'hot'
        else if (days >= 7 && days < 30) urgency = 'warm'
      }

      // Build title: strip the trigger phrase, take first meaningful clause
      const titleRaw = trimmed
        .replace(TRIGGER_RE, '')
        .replace(/^[\s\-–—:,]+|[\s\-–—:,]+$/g, '')
        .slice(0, 72)

      items.push({
        id: `${note.id}-${key}`,
        title: titleRaw || trimmed.slice(0, 72),
        noteTitle: note.title || 'Untitled',
        noteId: note.id,
        enclaveId: note.enclave_id,
        dateDisplay,
        dateMonth,
        urgency,
        raw: trimmed,
      })
    }
  }

  const ORDER = { hot: 0, warm: 1, cool: 2 }
  return items.sort((a, b) => ORDER[a.urgency] - ORDER[b.urgency]).slice(0, 6)
}

// ── Relative time ──────────────────────────────────────────────────────────────
function relTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 2)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d === 1) return 'Yesterday'
  return `${d}d ago`
}

// ── Small agent dot avatar ─────────────────────────────────────────────────────
function AgentDot({ role, size = 28 }) {
  const meta = AGENT_META[role]
  if (!meta) return <div style={{ width: size, height: size, borderRadius: 7, background: 'rgba(255,248,238,.04)', border: '1px solid rgba(255,248,238,.08)', flexShrink: 0 }} />
  return (
    <div style={{
      width: size, height: size, borderRadius: 7, flexShrink: 0,
      background: meta.bg, border: `1px solid ${meta.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: meta.color, display: 'block', opacity: 0.85 }} />
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({ label }) {
  return (
    <div className="ledger-sec">
      <span className="ledger-sec-label">{label}</span>
      <div className="ledger-sec-line" />
    </div>
  )
}

// ── LEDGER ─────────────────────────────────────────────────────────────────────
export default function Ledger({
  user,
  notes = [],
  messages = [],
  pinnedMessages = [],
  echoInsight = '',
  echoTime = null,
  echoTopConcepts = [],
  patternLibraryBuilds = [],
  activeEnclaveId,
  enclaves = [],
  onOpenNote,
}) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  // ── Greeting ──
  const hour      = now.getHours()
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = (user?.display_name || user?.email || 'there').split(/[\s@]/)[0]

  const dayStr  = now.toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  // ── Urgent items ──
  const urgentItems = useMemo(() => extractUrgentItems(notes), [notes])
  const urgentCount = urgentItems.filter(i => i.urgency !== 'cool').length
  const hasEcho = !!echoInsight

  // ── Sub-line ──
  let subLine = 'The vault is quiet.'
  if (urgentCount > 0 && hasEcho)
    subLine = `${urgentCount} thing${urgentCount !== 1 ? 's' : ''} need your attention today. Echo has been reading.`
  else if (urgentCount > 0)
    subLine = `${urgentCount} thing${urgentCount !== 1 ? 's' : ''} need your attention today.`
  else if (hasEcho)
    subLine = 'Nothing urgent. Echo found something interesting.'

  // ── Activity — derive from messages + builds ──
  const activity = useMemo(() => {
    const items = []
    const aiMsgs = [...messages].reverse().filter(m => m.role && m.role !== 'user').slice(0, 7)
    for (const m of aiMsgs) {
      const meta = AGENT_META[m.role]
      items.push({
        id: m.id,
        color: meta?.color || 'rgba(255,248,238,.3)',
        text: meta?.label || m.role,
        sub: 'responded',
        ts: m.inserted_at || m.created_at,
        enclave: null,
      })
    }
    for (const b of patternLibraryBuilds.slice(0, 4)) {
      items.push({
        id: `build-${b.capturedAt}`,
        color: '#5870e0',
        text: 'Build logged',
        sub: b.summary ? `— ${b.summary.slice(0, 40)}` : '',
        ts: b.capturedAt,
        enclave: null,
      })
    }
    return items.sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 10)
  }, [messages, patternLibraryBuilds])

  // ── Active enclave name ──
  const activeEnclaveName = enclaves.find(e => e.id === activeEnclaveId)?.name || null

  return (
    <div className="ledger">
      <div className="ledger-scroll">

        {/* ── GREETING ── */}
        <div className="ledger-greeting">
          <div className="ledger-time">{dayStr} · {dateStr} · {timeStr}</div>
          <div className="ledger-headline">{greeting}, {firstName}.</div>
          {subLine && <div className="ledger-sub">{subLine}</div>}
        </div>

        {/* ── URGENT ── */}
        {urgentItems.length > 0 && (
          <>
            <SectionHeader label="Urgent" />
            <div className="ledger-urgent-grid">
              {urgentItems.map(item => (
                <div
                  key={item.id}
                  className={`ledger-urgent-card${item.urgency === 'hot' ? ' hot' : item.urgency === 'warm' ? ' warm' : ''}`}
                  onClick={() => {
                    const note = notes.find(n => n.id === item.noteId)
                    if (note) onOpenNote?.(note)
                  }}
                >
                  <div className="uc-date">
                    <div className="uc-day">{item.dateDisplay}</div>
                    <div className="uc-mon">{item.dateMonth}</div>
                  </div>
                  <div className="uc-body">
                    <div className="uc-title">{item.title}</div>
                    <div className="uc-note">from &ldquo;{item.noteTitle}&rdquo; — {item.raw.slice(0, 60)}</div>
                  </div>
                  <div className="uc-right">
                    {activeEnclaveName && <div className="uc-enc">{activeEnclaveName}</div>}
                    {item.urgency !== 'cool' && (
                      <div className="uc-urgent">{item.urgency === 'hot' ? 'soon' : 'upcoming'}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── PINNED INSIGHTS ── */}
        <SectionHeader label="Pinned insights" />
        {pinnedMessages.length === 0 ? (
          <p className="ledger-empty">Pin agent insights from any note — they&apos;ll collect here.</p>
        ) : (
          <div className="ledger-insight-grid">
            {pinnedMessages.slice(0, 5).map((msg, i) => {
              const meta = AGENT_META[msg.role]
              return (
                <div
                  key={msg.id || i}
                  className="ledger-insight-card"
                  onClick={() => {
                    const note = notes.find(n => n.id === msg.note_id)
                    if (note) onOpenNote?.(note)
                  }}
                >
                  <AgentDot role={msg.role} size={28} />
                  <div className="ic-body">
                    <div className="ic-who">
                      <span className="ic-name" style={{ color: meta?.color || 'var(--muted)' }}>
                        {meta?.label || msg.display_name || msg.role}
                      </span>
                      {msg.note_title && <span className="ic-from">· {msg.note_title}</span>}
                    </div>
                    <div className="ic-text">{msg.content}</div>
                    {msg.note_id && (
                      <div className="ic-note-ref">→ open note</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── ECHO SNAPSHOT ── */}
        <SectionHeader label="Echo" />
        <div className="ledger-echo-card">
          {!hasEcho ? (
            <div style={{ textAlign: 'center', padding: '.8rem 0' }}>
              <span style={{ fontSize: '1.4rem', color: '#8ab4c8', display: 'block', marginBottom: '.55rem', animation: 'pulseSlow 4s ease-in-out infinite' }}>∿</span>
              <p style={{ fontFamily: 'var(--font-prose)', fontStyle: 'italic', fontSize: '.85rem', color: 'rgba(138,180,200,.45)', lineHeight: 1.65, margin: 0 }}>
                Echo is listening. Open a note and start thinking.
              </p>
            </div>
          ) : (
            <>
              <div className="echo-header">
                <span className="echo-glyph-lg">∿</span>
                <span className="echo-title">Echo</span>
                {echoTime && <span className="echo-ts">last read · {echoTime}</span>}
              </div>
              <p className="echo-text">{echoInsight}</p>
              {echoTopConcepts.length > 0 && (
                <div className="echo-concepts">
                  {echoTopConcepts.map((c, i) => (
                    <span key={i} className="echo-concept">{c}</span>
                  ))}
                </div>
              )}
              <div className="echo-footer">
                {patternLibraryBuilds.length > 0 ? `${patternLibraryBuilds.length} pattern${patternLibraryBuilds.length !== 1 ? 's' : ''} · ${notes.length} note${notes.length !== 1 ? 's' : ''} read` : `${notes.length} note${notes.length !== 1 ? 's' : ''} in context`}
              </div>
            </>
          )}
        </div>

        {/* ── RECENT ACTIVITY ── */}
        {activity.length > 0 && (
          <>
            <SectionHeader label="Recent activity" />
            <div className="ledger-activity-list">
              {activity.map(row => (
                <div key={row.id} className="ledger-act-row">
                  <div className="act-pip" style={{ background: row.color }} />
                  <div className="act-text">
                    {row.text} <span>{row.sub}</span>
                  </div>
                  <div className="act-time">{relTime(row.ts)}</div>
                  {row.enclave && <div className="act-enc">{row.enclave}</div>}
                </div>
              ))}
            </div>
          </>
        )}

        {/* bottom breathing room */}
        <div style={{ height: 64 }} />
      </div>

      {/* Open note hint */}
      <div className="ledger-open-hint" onClick={() => {
        if (notes.length > 0) onOpenNote?.(notes[0])
      }}>
        <div className="onh-pip" />
        Open a note to start writing
      </div>
    </div>
  )
}
