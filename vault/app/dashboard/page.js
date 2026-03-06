'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

// ── Constants ─────────────────────────────────────────────

const AI_META = {
  claude: {
    label: 'Claude — The Architect',
    initial: 'C',
    color: '#d4541a',
    dimColor: 'rgba(212,84,26,0.15)',
    borderColor: 'rgba(212,84,26,0.5)',
    textColor: 'rgba(255,220,200,0.88)',
  },
  gpt: {
    label: 'GPT — The Spark',
    initial: 'G',
    color: '#c8973a',
    dimColor: 'rgba(200,151,58,0.15)',
    borderColor: 'rgba(200,151,58,0.5)',
    textColor: 'rgba(255,240,180,0.88)',
  },
}

// ── Helpers ────────────────────────────────────────────────

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getMsgRole(msg) {
  // normalize legacy roles
  if (msg.role === 'user') return 'human'
  if (msg.role === 'assistant') return 'gpt'
  return msg.role // 'human' | 'claude' | 'gpt'
}

// ── Avatar ─────────────────────────────────────────────────

function Avatar({ initial, color, size = 28 }) {
  return (
    <div
      style={{
        width: size, height: size, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: size * 0.38 + 'px',
        letterSpacing: '0.02em',
        color: color || 'rgba(255,255,255,0.6)',
        border: `1px solid ${color ? color + '55' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: '2px',
        background: color ? color + '18' : 'rgba(255,255,255,0.04)',
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  )
}

// ── Message ────────────────────────────────────────────────

function Message({ msg, profiles }) {
  const role = getMsgRole(msg)
  const isAI = role === 'claude' || role === 'gpt'
  const aiMeta = isAI ? AI_META[role] : null

  let initial = '?'
  let avatarColor = null
  let label = msg.display_name || 'Team'
  let msgColor = 'var(--text)'

  if (role === 'claude') {
    initial = 'C'
    avatarColor = AI_META.claude.color
    label = AI_META.claude.label
    msgColor = AI_META.claude.textColor
  } else if (role === 'gpt') {
    initial = 'G'
    avatarColor = AI_META.gpt.color
    label = AI_META.gpt.label
    msgColor = AI_META.gpt.textColor
  } else {
    // human
    const prof = profiles?.find(p => p.id === msg.user_id)
    initial = msg.avatar_initial || prof?.avatar_initial || label?.[0]?.toUpperCase() || '?'
    avatarColor = null
  }

  return (
    <div
      className="animate-fade-in"
      style={{
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-start',
        paddingLeft: isAI ? '0.6rem' : '0',
        borderLeft: isAI ? `2px solid ${aiMeta.borderColor}` : '2px solid transparent',
        marginLeft: '-0.6rem',
      }}
    >
      <Avatar initial={initial} color={avatarColor} size={28} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginBottom: '0.2rem' }}>
          <span
            className="msg-label"
            style={{ color: aiMeta?.color || 'rgba(255,255,255,0.7)' }}
          >
            {label}
          </span>
          <span className="msg-timestamp">{formatTime(msg.created_at)}</span>
        </div>
        <p
          className="msg-user"
          style={{
            color: msgColor,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {msg.content}
          {msg.streaming && (
            <span
              className="cursor-blink"
              style={{ color: aiMeta?.color || 'var(--ember)', marginLeft: '1px' }}
            >
              ▋
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

// ── Thinking indicator ─────────────────────────────────────

function ThinkingDot({ model }) {
  const meta = AI_META[model]
  return (
    <div
      className="animate-fade-in"
      style={{
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        paddingLeft: '0.6rem',
        borderLeft: `2px solid ${meta.borderColor}`,
        marginLeft: '-0.6rem',
        paddingTop: '0.2rem', paddingBottom: '0.2rem',
      }}
    >
      <Avatar initial={meta.initial} color={meta.color} size={28} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: meta.color,
            animation: 'pulseSlow 1.2s ease-in-out infinite',
          }}
        />
        <span
          className="font-mono"
          style={{
            fontSize: '0.55rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: meta.color,
            opacity: 0.7,
          }}
        >
          {model === 'claude' ? 'Claude is thinking…' : 'GPT is thinking…'}
        </span>
      </div>
    </div>
  )
}

// ── Display Name Modal ──────────────────────────────────────

function DisplayNameModal({ onSave }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 8000,
        background: 'rgba(10,10,10,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="vault-panel p-8 animate-fade-up"
        style={{ width: '100%', maxWidth: '400px', borderColor: 'var(--ember-dim)' }}
      >
        <p className="panel-label mb-2">First time here</p>
        <h2
          className="font-serif mb-1"
          style={{ fontSize: '2.5rem', fontWeight: 300, lineHeight: 1, color: 'var(--text)' }}
        >
          Set your <em style={{ color: 'var(--ember)', fontStyle: 'italic' }}>name</em>
        </h2>
        <p className="font-serif mb-6" style={{ color: 'var(--muted)', fontWeight: 300 }}>
          How should the team see you?
        </p>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && name.trim() && onSave(name.trim(), setLoading)}
          placeholder="Your name"
          className="vault-input w-full px-4 py-3 mb-4"
          autoFocus
          maxLength={32}
        />
        <button
          className="vault-btn w-full justify-center"
          disabled={!name.trim() || loading}
          onClick={() => onSave(name.trim(), setLoading)}
        >
          {loading ? 'Saving…' : 'Enter The Vault →'}
        </button>
      </div>
    </div>
  )
}

// ── Left Panel: Users ──────────────────────────────────────

function UserListPanel({ onlineUsers, allProfiles }) {
  return (
    <div className="vault-panel scanlines flex flex-col" style={{ width: '210px', flexShrink: 0 }}>
      <div
        style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <span className="panel-label">Who's In</span>
        <span className="font-mono" style={{ fontSize: '0.48rem', color: 'var(--muted)', letterSpacing: '0.1em' }}>
          {onlineUsers.length} live
        </span>
      </div>

      <div className="flex flex-col gap-1 p-2 overflow-y-auto flex-1">
        {allProfiles.map(profile => {
          const isOnline = onlineUsers.some(u => u.user_id === profile.id)
          return (
            <div
              key={profile.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.4rem 0.5rem',
                borderRadius: '2px',
                background: isOnline ? 'rgba(80,200,100,0.04)' : 'transparent',
                opacity: isOnline ? 1 : 0.35,
                transition: 'all 0.3s',
              }}
            >
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Avatar
                  initial={profile.avatar_initial || '?'}
                  color={null}
                  size={26}
                />
                {isOnline && (
                  <span style={{
                    position: 'absolute', bottom: -1, right: -1,
                    width: 6, height: 6, background: '#50c864',
                    borderRadius: '50%', border: '1px solid #0a0a0a',
                  }} />
                )}
              </div>
              <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--mid)', letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile.display_name || profile.email?.split('@')[0] || '—'}
              </p>
            </div>
          )
        })}

        {/* AI members — always shown */}
        <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
          <p className="panel-label mb-1 px-1" style={{ color: 'var(--muted)', fontSize: '0.48rem' }}>AI</p>
          {['claude', 'gpt'].map(ai => (
            <div
              key={ai}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.4rem 0.5rem',
              }}
            >
              <Avatar initial={AI_META[ai].initial} color={AI_META[ai].color} size={26} />
              <p className="font-mono" style={{ fontSize: '0.58rem', letterSpacing: '0.02em', color: AI_META[ai].color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {AI_META[ai].label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <Link href="/notes" className="vault-btn-ghost" style={{ justifyContent: 'center', textDecoration: 'none' }}>Notes</Link>
        <Link href="/files" className="vault-btn-ghost" style={{ justifyContent: 'center', textDecoration: 'none' }}>Files</Link>
      </div>
    </div>
  )
}

// ── Right Panel: Quick Notes ────────────────────────────────

function QuickNotePanel({ userId, supabase }) {
  const [notes, setNotes] = useState([])
  const [noteInput, setNoteInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!userId) return
    supabase.from('notes').select('id, title, created_at').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => setNotes(data || []))
  }, [userId, supabase])

  async function saveNote() {
    if (!noteInput.trim() || saving) return
    setSaving(true)
    const title = noteInput.trim().split('\n')[0].slice(0, 60) || 'Untitled'
    const { data } = await supabase.from('notes').insert({ user_id: userId, title, content: noteInput.trim() }).select('id, title, created_at').single()
    if (data) setNotes(prev => [data, ...prev].slice(0, 5))
    setNoteInput('')
    setSaving(false)
  }

  return (
    <div className="vault-panel scanlines flex flex-col" style={{ width: '250px', flexShrink: 0 }}>
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
        <span className="panel-label">Quick Capture</span>
      </div>
      <div style={{ padding: '0.6rem', borderBottom: '1px solid var(--border)' }}>
        <textarea
          value={noteInput}
          onChange={e => setNoteInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) saveNote() }}
          placeholder="Capture a thought…"
          className="vault-textarea w-full px-3 py-2"
          style={{ fontSize: '0.8rem', minHeight: '72px', maxHeight: '120px', resize: 'none' }}
        />
        <button
          className="vault-btn w-full justify-center mt-2"
          style={{ padding: '0.5rem', fontSize: '0.56rem' }}
          onClick={saveNote}
          disabled={saving || !noteInput.trim()}
        >
          {saving ? 'Saving…' : '+ Save Note'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ padding: '0.4rem' }}>
        {notes.length > 0 && <p className="panel-label px-2 py-1" style={{ color: 'var(--muted)' }}>Recent</p>}
        {notes.map(note => (
          <Link key={note.id} href={`/notes?id=${note.id}`} style={{ textDecoration: 'none' }}>
            <div
              data-hover
              style={{ padding: '0.5rem', borderRadius: '2px', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--mid)', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {note.title}
              </p>
              <p className="msg-timestamp mt-0.5">{formatTime(note.created_at)}</p>
            </div>
          </Link>
        ))}
      </div>
      <div style={{ padding: '0.6rem', borderTop: '1px solid var(--border)' }}>
        <Link href="/notes" style={{ textDecoration: 'none' }}>
          <button className="vault-btn-ghost w-full justify-center">View all →</button>
        </Link>
      </div>
    </div>
  )
}

// ── Main Dashboard ──────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()
  const supabaseRef = useRef(null)
  function getSupabase() {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }

  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [allProfiles, setAllProfiles] = useState([])
  const [onlineUsers, setOnlineUsers] = useState([])
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [thinking, setThinking] = useState(null)   // 'claude' | 'gpt' | null
  const [aiLocked, setAiLocked] = useState(false)
  const [autoAI, setAutoAI] = useState(true)
  const [needsName, setNeedsName] = useState(false)
  const [mounted, setMounted] = useState(false)

  const messagesEndRef = useRef(null)
  const historyRef = useRef([])  // always current for use inside async flows

  // Keep historyRef in sync
  useEffect(() => { historyRef.current = messages }, [messages])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])
  useEffect(() => { scrollToBottom() }, [messages, thinking, scrollToBottom])

  // ── Init ──────────────────────────────────────────────────

  useEffect(() => {
    let active = true
    let initialized = false

    const supabase = getSupabase()

    async function init(u) {
      try {
        const [{ data: prof }, { data: profs }, { data: msgs }] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', u.id).single(),
          supabase.from('profiles').select('*'),
          supabase.from('messages').select('*').order('created_at', { ascending: true }).limit(100),
        ])

        if (!active) return
        setUser(u)
        setProfile(prof)
        setAllProfiles(profs || [])
        setMessages(msgs || [])
        if (!prof?.display_name) setNeedsName(true)
        setMounted(true)

        // Realtime: new messages
        supabase.channel('messages-realtime')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            setMessages(prev => {
              if (prev.find(m => m.id === payload.new.id)) return prev
              return [...prev, payload.new]
            })
          })
          .subscribe()

        // Presence
        const presenceChannel = supabase.channel('online-users', {
          config: { presence: { key: u.id } },
        })
        presenceChannel
          .on('presence', { event: 'sync' }, () => {
            setOnlineUsers(Object.values(presenceChannel.presenceState()).flat())
          })
          .subscribe(async status => {
            if (status === 'SUBSCRIBED') {
              await presenceChannel.track({
                user_id: u.id,
                display_name: prof?.display_name || u.email,
                avatar_initial: prof?.avatar_initial || u.email?.[0]?.toUpperCase(),
              })
            }
          })
      } catch (err) {
        console.error('[Dashboard] init() failed:', err)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) { router.push('/login'); return }
      if (initialized) return
      initialized = true
      init(session.user)
    })

    return () => { active = false; subscription.unsubscribe() }
  }, []) // eslint-disable-line

  // ── Save display name ─────────────────────────────────────

  async function saveDisplayName(name, setLoading) {
    setLoading(true)
    const initial = name[0].toUpperCase()
    await getSupabase().from('profiles').update({ display_name: name, avatar_initial: initial }).eq('id', user.id)
    setProfile(prev => ({ ...prev, display_name: name, avatar_initial: initial }))
    setAllProfiles(prev => prev.map(p => p.id === user.id ? { ...p, display_name: name, avatar_initial: initial } : p))
    setNeedsName(false)
    setLoading(false)
  }

  // ── Core chat logic ───────────────────────────────────────

  async function saveHumanMessage(content) {
    const tempId = `${Date.now()}-human`
    const optimistic = {
      id: tempId,
      user_id: user.id,
      display_name: profile?.display_name || user.email,
      avatar_initial: profile?.avatar_initial || user.email?.[0]?.toUpperCase(),
      content,
      role: 'human',
      created_at: new Date().toISOString(),
    }
    setMessages(prev => {
      if (prev.find(m => m.id === tempId)) return prev
      return [...prev, optimistic]
    })

    const { data: saved } = await getSupabase().from('messages').insert({
      user_id: user.id,
      display_name: optimistic.display_name,
      avatar_initial: optimistic.avatar_initial,
      content,
      role: 'human',
    }).select().single()

    const final = saved || optimistic
    setMessages(prev => prev.map(m => m.id === tempId ? final : m))
    return final
  }

  async function triggerAI(model, history) {
    const tempId = `${Date.now()}-${model}`
    const meta = AI_META[model]

    const placeholder = {
      id: tempId,
      role: model,
      display_name: meta.label,
      avatar_initial: meta.initial,
      content: '',
      streaming: true,
      created_at: new Date().toISOString(),
    }

    setMessages(prev => [...prev, placeholder])
    setThinking(model)

    let text = ''

    try {
      const res = await fetch(`/api/chat/${model}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        setMessages(prev =>
          prev.map(m => m.id === tempId ? { ...m, content: text } : m)
        )
      }
    } catch (err) {
      text = `[${meta.label} encountered an error: ${err.message}]`
      setMessages(prev =>
        prev.map(m => m.id === tempId ? { ...m, content: text } : m)
      )
    }

    setThinking(null)

    // Persist to Supabase
    const { data: saved } = await getSupabase().from('messages').insert({
      user_id: null,
      display_name: meta.label,
      avatar_initial: meta.initial,
      content: text,
      role: model,
    }).select().single()

    const final = saved || { ...placeholder, content: text, streaming: false }
    setMessages(prev =>
      prev.map(m => m.id === tempId ? { ...final, streaming: false } : m)
    )
    return final
  }

  async function handleSend() {
    if (!chatInput.trim() || aiLocked) return
    const content = chatInput.trim()
    setChatInput('')

    const humanMsg = await saveHumanMessage(content)

    if (!autoAI) return

    setAiLocked(true)

    // Claude first — pass history snapshot at this moment
    const historyForClaude = [...historyRef.current]
    const claudeMsg = await triggerAI('claude', historyForClaude)

    // GPT second — include Claude's response in context
    const historyForGPT = [...historyRef.current]
    await triggerAI('gpt', historyForGPT)

    setAiLocked(false)
  }

  async function handleAskClaude() {
    if (aiLocked) return
    setAiLocked(true)
    await triggerAI('claude', [...historyRef.current])
    setAiLocked(false)
  }

  async function handleAskGPT() {
    if (aiLocked) return
    setAiLocked(true)
    await triggerAI('gpt', [...historyRef.current])
    setAiLocked(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleSignOut() {
    await getSupabase().auth.signOut()
    router.push('/login')
  }

  // ── Render ────────────────────────────────────────────────

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="panel-label animate-pulse-slow">Initializing…</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {needsName && <DisplayNameModal onSave={saveDisplayName} />}

      {/* Top bar */}
      <div
        style={{
          height: '48px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 1.25rem', flexShrink: 0,
          background: 'rgba(255,255,255,0.01)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
          <span className="font-serif" style={{ fontSize: '1.2rem', fontWeight: 300, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            The <em style={{ color: 'var(--ember)', fontStyle: 'italic' }}>Vault</em>
          </span>
          <span className="font-mono" style={{ fontSize: '0.48rem', color: 'var(--muted)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Command Center
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {profile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Avatar initial={profile.avatar_initial} color={null} size={26} />
              <span className="font-mono" style={{ fontSize: '0.58rem', color: 'var(--mid)', letterSpacing: '0.04em' }}>
                {profile.display_name || profile.email?.split('@')[0]}
              </span>
            </div>
          )}
          <button className="vault-btn-ghost" onClick={handleSignOut} style={{ fontSize: '0.5rem', padding: '0.3rem 0.6rem' }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Three panels */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: '1px', background: 'var(--border)' }}>

        {/* LEFT: Users */}
        <UserListPanel onlineUsers={onlineUsers} allProfiles={allProfiles} />

        {/* CENTER: Chat terminal */}
        <div className="vault-panel scanlines flex flex-col flex-1 min-w-0">

          {/* Chat header */}
          <div
            style={{
              padding: '0.65rem 1.25rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span className="panel-label">The Vault Terminal</span>
              {/* AI persona tags */}
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {['claude', 'gpt'].map(ai => (
                  <span
                    key={ai}
                    className="font-mono"
                    style={{
                      fontSize: '0.48rem', letterSpacing: '0.1em', textTransform: 'uppercase',
                      padding: '0.2rem 0.5rem',
                      border: `1px solid ${AI_META[ai].borderColor}`,
                      borderRadius: '2px',
                      color: AI_META[ai].color,
                      background: AI_META[ai].dimColor,
                    }}
                  >
                    {ai === 'claude' ? 'The Architect' : 'The Spark'}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {/* Manual trigger buttons (always visible, disabled when locked) */}
              {!autoAI && (
                <>
                  <button
                    onClick={handleAskClaude}
                    disabled={aiLocked}
                    style={{
                      padding: '0.3rem 0.7rem',
                      fontFamily: 'var(--font-mono)', fontSize: '0.5rem',
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      border: `1px solid ${AI_META.claude.borderColor}`,
                      borderRadius: '2px',
                      background: aiLocked ? 'transparent' : AI_META.claude.dimColor,
                      color: aiLocked ? 'var(--muted)' : AI_META.claude.color,
                      transition: 'all 0.15s', opacity: aiLocked ? 0.4 : 1,
                    }}
                  >
                    Ask Claude
                  </button>
                  <button
                    onClick={handleAskGPT}
                    disabled={aiLocked}
                    style={{
                      padding: '0.3rem 0.7rem',
                      fontFamily: 'var(--font-mono)', fontSize: '0.5rem',
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      border: `1px solid ${AI_META.gpt.borderColor}`,
                      borderRadius: '2px',
                      background: aiLocked ? 'transparent' : AI_META.gpt.dimColor,
                      color: aiLocked ? 'var(--muted)' : AI_META.gpt.color,
                      transition: 'all 0.15s', opacity: aiLocked ? 0.4 : 1,
                    }}
                  >
                    Ask GPT
                  </button>
                </>
              )}

              {/* Auto AI toggle */}
              <button
                onClick={() => setAutoAI(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.3rem 0.7rem',
                  fontFamily: 'var(--font-mono)', fontSize: '0.5rem',
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  border: `1px solid ${autoAI ? 'rgba(80,200,100,0.4)' : 'var(--border)'}`,
                  borderRadius: '2px',
                  background: autoAI ? 'rgba(80,200,100,0.06)' : 'transparent',
                  color: autoAI ? '#50c864' : 'var(--muted)',
                  transition: 'all 0.2s',
                }}
              >
                <span
                  style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: autoAI ? '#50c864' : 'var(--muted)',
                    animation: autoAI ? 'pulseSlow 2s ease-in-out infinite' : 'none',
                  }}
                />
                Auto AI: {autoAI ? 'ON' : 'OFF'}
              </button>

              <span className="font-mono" style={{ fontSize: '0.48rem', color: '#50c864', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                ◆ Live
              </span>
            </div>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto"
            style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
          >
            {messages.length === 0 && (
              <div style={{ margin: 'auto', textAlign: 'center', opacity: 0.25 }}>
                <p className="font-serif" style={{ fontSize: '1.4rem', fontWeight: 300, color: 'var(--muted)' }}>
                  The terminal awaits.
                </p>
                <p className="font-mono mt-2" style={{ fontSize: '0.55rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                  Claude & GPT are listening
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <Message key={msg.id || i} msg={msg} profiles={allProfiles} />
            ))}

            {thinking && <ThinkingDot model={thinking} />}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: '0.75rem 1.25rem',
              borderTop: '1px solid var(--border)',
              display: 'flex', gap: '0.6rem', alignItems: 'flex-end',
              flexShrink: 0,
            }}
          >
            <div style={{ flex: 1 }}>
              <textarea
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  aiLocked
                    ? 'AIs are responding…'
                    : autoAI
                    ? 'Message the vault… (⏎ send · Shift+⏎ newline · both AIs will respond)'
                    : 'Message the team… (AIs off — use Ask Claude / Ask GPT above)'
                }
                disabled={aiLocked}
                className="vault-input w-full px-3 py-2"
                style={{
                  resize: 'none', height: '2.8rem', maxHeight: '120px',
                  fontFamily: 'var(--font-mono)', fontSize: '0.8rem', lineHeight: 1.5,
                  opacity: aiLocked ? 0.5 : 1,
                }}
                rows={1}
                onInput={e => {
                  e.target.style.height = '2.8rem'
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                }}
              />
            </div>
            <button
              className="vault-btn"
              onClick={handleSend}
              disabled={aiLocked || !chatInput.trim()}
              style={{ padding: '0.6rem 1.1rem', flexShrink: 0 }}
            >
              {aiLocked ? '…' : 'Send'}
            </button>
          </div>
        </div>

        {/* RIGHT: Notes */}
        <QuickNotePanel userId={user?.id} supabase={getSupabase()} />
      </div>
    </div>
  )
}
