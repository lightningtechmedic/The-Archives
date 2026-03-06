'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

// ── Helpers ────────────────────────────────────────────────

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function Avatar({ initial, size = 32, online = false }) {
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div
        style={{
          width: size, height: size,
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '2px',
          background: 'rgba(212,84,26,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: size * 0.38 + 'px',
          color: 'var(--ember)',
          letterSpacing: '0.05em',
        }}
      >
        {initial || '?'}
      </div>
      {online && (
        <span
          style={{
            position: 'absolute', bottom: -1, right: -1,
            width: 7, height: 7,
            background: '#50c864', borderRadius: '50%',
            border: '1px solid #0a0a0a',
          }}
        />
      )}
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

// ── Left Panel: Online Users ────────────────────────────────

function UserListPanel({ onlineUsers, allProfiles }) {
  return (
    <div className="vault-panel scanlines flex flex-col" style={{ width: '220px', flexShrink: 0 }}>
      <div
        style={{
          padding: '1rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <span className="panel-label">Who's In</span>
        <span
          className="font-mono"
          style={{ fontSize: '0.5rem', color: 'var(--muted)', letterSpacing: '0.1em' }}
        >
          {onlineUsers.length} online
        </span>
      </div>

      <div className="flex flex-col gap-1 p-2 overflow-y-auto flex-1">
        {allProfiles.map(profile => {
          const isOnline = onlineUsers.some(u => u.user_id === profile.id)
          return (
            <div
              key={profile.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.5rem 0.5rem',
                borderRadius: '2px',
                background: isOnline ? 'rgba(80,200,100,0.04)' : 'transparent',
                opacity: isOnline ? 1 : 0.4,
                transition: 'all 0.3s',
              }}
            >
              <Avatar initial={profile.avatar_initial} size={28} online={isOnline} />
              <div>
                <p
                  className="font-mono"
                  style={{ fontSize: '0.62rem', color: 'var(--text)', letterSpacing: '0.05em' }}
                >
                  {profile.display_name || profile.email?.split('@')[0] || 'Unknown'}
                </p>
                {isOnline && (
                  <p className="font-mono" style={{ fontSize: '0.48rem', color: '#50c864', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Active
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Nav links */}
      <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <Link href="/notes" className="vault-btn-ghost" style={{ justifyContent: 'center', textDecoration: 'none' }}>
          Notes
        </Link>
        <Link href="/files" className="vault-btn-ghost" style={{ justifyContent: 'center', textDecoration: 'none' }}>
          Files
        </Link>
      </div>
    </div>
  )
}

// ── Center Panel: Chat Terminal ─────────────────────────────

function ChatTerminal({ messages, loading, inputValue, onInputChange, onSend, onKeyDown, messagesEndRef, profile }) {
  return (
    <div className="vault-panel scanlines flex flex-col flex-1 min-w-0">
      {/* Header */}
      <div
        style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <div>
          <span className="panel-label">The Vault Terminal</span>
          <span
            className="font-mono ml-3"
            style={{ fontSize: '0.48rem', color: 'var(--muted)', letterSpacing: '0.1em' }}
          >
            Shared · All members see this
          </span>
        </div>
        <span
          className="font-mono"
          style={{ fontSize: '0.5rem', color: '#50c864', letterSpacing: '0.12em', textTransform: 'uppercase' }}
        >
          ◆ Live
        </span>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
      >
        {messages.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', opacity: 0.3 }}>
            <p className="font-serif" style={{ fontSize: '1.5rem', fontWeight: 300, color: 'var(--muted)' }}>
              The terminal is empty.
            </p>
            <p className="font-mono mt-2" style={{ fontSize: '0.6rem', letterSpacing: '0.15em', color: 'var(--muted)', textTransform: 'uppercase' }}>
              Start the conversation
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={msg.id || i} className="animate-fade-in" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            {msg.role === 'user' ? (
              <Avatar initial={msg.avatar_initial || '?'} size={28} />
            ) : (
              <div
                style={{
                  width: 28, height: 28, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: '0.55rem',
                  color: 'var(--gold)', letterSpacing: '0.05em',
                  border: '1px solid var(--gold-dim)', borderRadius: '2px',
                  background: 'rgba(200,151,58,0.05)',
                }}
              >
                AI
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginBottom: '0.25rem' }}>
                <span
                  className="msg-label"
                  style={{ color: msg.role === 'user' ? 'var(--text)' : 'var(--gold)' }}
                >
                  {msg.role === 'user'
                    ? (msg.display_name || 'Unknown')
                    : 'Vault AI'}
                </span>
                <span className="msg-timestamp">{formatTime(msg.created_at)}</span>
              </div>
              <p className={msg.role === 'user' ? 'msg-user' : 'msg-ai'}>
                {msg.content}
                {msg.streaming && (
                  <span className="cursor-blink" style={{ color: 'var(--gold)', marginLeft: '1px' }}>▋</span>
                )}
              </p>
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: '1rem 1.25rem',
          borderTop: '1px solid var(--border)',
          display: 'flex', gap: '0.75rem', alignItems: 'flex-end',
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1 }}>
          <textarea
            value={inputValue}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message the team… (⏎ send, Shift+⏎ newline)"
            className="vault-input w-full px-3 py-2"
            style={{ resize: 'none', height: '2.8rem', maxHeight: '120px', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', lineHeight: 1.5 }}
            rows={1}
            onInput={e => {
              e.target.style.height = '2.8rem'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
          />
        </div>
        <button
          className="vault-btn"
          onClick={onSend}
          disabled={loading || !inputValue.trim()}
          style={{ padding: '0.6rem 1.2rem', flexShrink: 0 }}
        >
          {loading ? '…' : 'Send'}
        </button>
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
    supabase
      .from('notes')
      .select('id, title, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setNotes(data || []))
  }, [userId, supabase])

  async function saveNote() {
    if (!noteInput.trim() || saving) return
    setSaving(true)
    const lines = noteInput.trim().split('\n')
    const title = lines[0].slice(0, 60) || 'Untitled'
    const content = noteInput.trim()

    const { data } = await supabase
      .from('notes')
      .insert({ user_id: userId, title, content })
      .select('id, title, created_at')
      .single()

    if (data) {
      setNotes(prev => [data, ...prev].slice(0, 5))
    }
    setNoteInput('')
    setSaving(false)
  }

  return (
    <div className="vault-panel scanlines flex flex-col" style={{ width: '260px', flexShrink: 0 }}>
      <div
        style={{
          padding: '1rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <span className="panel-label">Quick Capture</span>
      </div>

      {/* Note input */}
      <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
        <textarea
          value={noteInput}
          onChange={e => setNoteInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && e.metaKey) saveNote()
          }}
          placeholder="Capture a thought… (⌘↵ to save)"
          className="vault-textarea w-full px-3 py-2"
          style={{ fontSize: '0.82rem', minHeight: '80px', maxHeight: '140px', resize: 'none' }}
        />
        <button
          className="vault-btn w-full justify-center mt-2"
          style={{ padding: '0.6rem', fontSize: '0.58rem' }}
          onClick={saveNote}
          disabled={saving || !noteInput.trim()}
        >
          {saving ? 'Saving…' : '+ Save Note'}
        </button>
      </div>

      {/* Recent notes */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '0.5rem' }}>
        {notes.length > 0 && (
          <p className="panel-label px-2 py-2" style={{ color: 'var(--muted)' }}>Recent</p>
        )}
        {notes.map(note => (
          <Link
            key={note.id}
            href={`/notes?id=${note.id}`}
            style={{ textDecoration: 'none' }}
          >
            <div
              data-hover
              style={{
                padding: '0.6rem 0.5rem',
                borderRadius: '2px',
                transition: 'background 0.15s',
                cursor: 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <p
                className="font-mono"
                style={{
                  fontSize: '0.62rem', color: 'var(--mid)',
                  letterSpacing: '0.02em', lineHeight: 1.4,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {note.title}
              </p>
              <p className="msg-timestamp mt-0.5">{formatTime(note.created_at)}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* View all link */}
      <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border)' }}>
        <Link href="/notes" style={{ textDecoration: 'none' }}>
          <button className="vault-btn-ghost w-full justify-center">
            View all notes →
          </button>
        </Link>
      </div>
    </div>
  )
}

// ── Main Dashboard ──────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [allProfiles, setAllProfiles] = useState([])
  const [onlineUsers, setOnlineUsers] = useState([])
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [needsName, setNeedsName] = useState(false)
  const [mounted, setMounted] = useState(false)
  const messagesEndRef = useRef(null)
  const channelRef = useRef(null)

  // Scroll chat to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  // Auth + data init
  useEffect(() => {
    let mounted = true

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const u = session.user

      // Fetch profile
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', u.id)
        .single()

      if (!mounted) return

      setUser(u)
      setProfile(prof)

      if (!prof?.display_name) {
        setNeedsName(true)
      }

      // Fetch all profiles
      const { data: profs } = await supabase.from('profiles').select('*')
      setAllProfiles(profs || [])

      // Load messages
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
      setMessages(msgs || [])

      setMounted(true)

      // Realtime: subscribe to new messages
      supabase
        .channel('messages-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
          setMessages(prev => {
            // Avoid duplicates from our own send
            if (prev.find(m => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
        })
        .subscribe()

      // Presence tracking
      const presenceChannel = supabase.channel('online-users', {
        config: { presence: { key: u.id } },
      })

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState()
          setOnlineUsers(Object.values(state).flat())
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

      channelRef.current = presenceChannel
    }

    init()
    return () => { mounted = false }
  }, []) // eslint-disable-line

  async function saveDisplayName(name, setLoading) {
    setLoading(true)
    const initial = name[0].toUpperCase()
    await supabase.from('profiles').update({ display_name: name, avatar_initial: initial }).eq('id', user.id)
    setProfile(prev => ({ ...prev, display_name: name, avatar_initial: initial }))
    setAllProfiles(prev => prev.map(p => p.id === user.id ? { ...p, display_name: name, avatar_initial: initial } : p))
    setNeedsName(false)
    setLoading(false)
  }

  async function sendMessage() {
    if (!chatInput.trim() || chatLoading) return
    const content = chatInput.trim()
    setChatInput('')
    setChatLoading(true)

    // Insert user message
    const userMsg = {
      user_id: user.id,
      display_name: profile?.display_name || user.email,
      avatar_initial: profile?.avatar_initial || user.email?.[0]?.toUpperCase(),
      content,
      role: 'user',
      created_at: new Date().toISOString(),
    }

    const { data: savedMsg } = await supabase
      .from('messages')
      .insert(userMsg)
      .select()
      .single()

    const userMsgWithId = savedMsg || { ...userMsg, id: Date.now() + '-user' }
    setMessages(prev => {
      if (prev.find(m => m.id === userMsgWithId.id)) return prev
      return [...prev, userMsgWithId]
    })

    // Build history for AI
    const history = [...messages, userMsgWithId]

    // Streaming AI response
    const streamId = Date.now() + '-stream'
    const aiPlaceholder = {
      id: streamId,
      role: 'assistant',
      content: '',
      streaming: true,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, aiPlaceholder])

    let aiText = ''

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        aiText += chunk
        setMessages(prev =>
          prev.map(m => m.id === streamId ? { ...m, content: aiText } : m)
        )
      }
    } catch (err) {
      aiText = 'Something went wrong. Try again.'
      setMessages(prev =>
        prev.map(m => m.id === streamId ? { ...m, content: aiText } : m)
      )
    }

    // Finalize — remove streaming flag and save to DB
    setMessages(prev =>
      prev.map(m => m.id === streamId ? { ...m, streaming: false } : m)
    )

    const { data: savedAI } = await supabase
      .from('messages')
      .insert({
        user_id: null,
        display_name: 'Vault AI',
        content: aiText,
        role: 'assistant',
      })
      .select()
      .single()

    // Replace stream placeholder with real DB id
    if (savedAI) {
      setMessages(prev =>
        prev.map(m => m.id === streamId ? { ...savedAI, streaming: false } : m)
      )
    }

    setChatLoading(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

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
          padding: '0 1.25rem',
          flexShrink: 0,
          background: 'rgba(255,255,255,0.01)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
          <span
            className="font-serif"
            style={{ fontSize: '1.2rem', fontWeight: 300, color: 'var(--text)', letterSpacing: '-0.01em' }}
          >
            The <em style={{ color: 'var(--ember)', fontStyle: 'italic' }}>Vault</em>
          </span>
          <span className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--muted)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Command Center
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {profile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Avatar initial={profile.avatar_initial} size={26} />
              <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--mid)', letterSpacing: '0.05em' }}>
                {profile.display_name || profile.email?.split('@')[0]}
              </span>
            </div>
          )}
          <button
            className="vault-btn-ghost"
            onClick={handleSignOut}
            style={{ fontSize: '0.5rem', padding: '0.3rem 0.7rem' }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Three-panel layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: '1px', background: 'var(--border)' }}>
        <UserListPanel onlineUsers={onlineUsers} allProfiles={allProfiles} />
        <ChatTerminal
          messages={messages}
          loading={chatLoading}
          inputValue={chatInput}
          onInputChange={setChatInput}
          onSend={sendMessage}
          onKeyDown={handleKeyDown}
          messagesEndRef={messagesEndRef}
          profile={profile}
        />
        <QuickNotePanel userId={user?.id} supabase={supabase} />
      </div>
    </div>
  )
}
