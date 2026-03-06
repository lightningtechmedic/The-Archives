'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Suspense } from 'react'

function formatDate(ts) {
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function MicIcon({ active }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function NotesInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [user, setUser] = useState(null)
  const [notes, setNotes] = useState([])
  const [sharedNotes, setSharedNotes] = useState([])
  const [activeNote, setActiveNote] = useState(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isShared, setIsShared] = useState(false)
  const [search, setSearch] = useState('')
  const [view, setView] = useState('grid') // 'grid' | 'editor'
  const [listening, setListening] = useState(false)
  const [saveStatus, setSaveStatus] = useState('') // 'saving' | 'saved' | ''
  const [mounted, setMounted] = useState(false)

  const saveTimer = useRef(null)
  const recognitionRef = useRef(null)
  const contentRef = useRef(content)
  contentRef.current = content

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      setMounted(true)
    })
  }, []) // eslint-disable-line

  // Load notes
  useEffect(() => {
    if (!user) return
    loadNotes()

    // Load shared notes from all users (not just own)
    supabase
      .from('notes')
      .select('id, title, content, user_id, created_at, updated_at')
      .eq('is_shared', true)
      .neq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .then(({ data }) => setSharedNotes(data || []))
  }, [user]) // eslint-disable-line

  async function loadNotes() {
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    setNotes(data || [])

    // If URL has ?id=..., open that note
    const noteId = searchParams.get('id')
    if (noteId && data) {
      const found = data.find(n => n.id === noteId)
      if (found) openNote(found)
    }
  }

  function openNote(note) {
    setActiveNote(note)
    setTitle(note.title)
    setContent(note.content)
    setIsShared(note.is_shared)
    setView('editor')
  }

  function newNote() {
    setActiveNote(null)
    setTitle('')
    setContent('')
    setIsShared(false)
    setView('editor')
  }

  // Auto-save every 3 seconds when in editor
  useEffect(() => {
    if (view !== 'editor') return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (title || content) autoSave()
    }, 3000)
    return () => clearTimeout(saveTimer.current)
  }, [title, content, isShared, view]) // eslint-disable-line

  async function autoSave() {
    setSaveStatus('saving')
    if (activeNote) {
      const { data } = await supabase
        .from('notes')
        .update({ title: title || 'Untitled', content, is_shared: isShared, updated_at: new Date().toISOString() })
        .eq('id', activeNote.id)
        .select()
        .single()
      if (data) {
        setActiveNote(data)
        setNotes(prev => prev.map(n => n.id === data.id ? data : n))
      }
    } else {
      if (!title && !content) { setSaveStatus(''); return }
      const { data } = await supabase
        .from('notes')
        .insert({ user_id: user.id, title: title || 'Untitled', content, is_shared: isShared })
        .select()
        .single()
      if (data) {
        setActiveNote(data)
        setNotes(prev => [data, ...prev])
      }
    }
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus(''), 2000)
  }

  async function manualSave() {
    clearTimeout(saveTimer.current)
    await autoSave()
  }

  async function deleteNote(id) {
    await supabase.from('notes').delete().eq('id', id)
    setNotes(prev => prev.filter(n => n.id !== id))
    if (activeNote?.id === id) {
      setActiveNote(null)
      setTitle('')
      setContent('')
      setView('grid')
    }
  }

  // Voice to text
  function toggleVoice() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input not supported in this browser. Try Chrome.')
      return
    }

    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

    let finalTranscript = contentRef.current

    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalTranscript += e.results[i][0].transcript
        } else {
          interim = e.results[i][0].transcript
        }
      }
      setContent(finalTranscript + interim)
    }

    rec.onerror = () => setListening(false)
    rec.onend = () => {
      setContent(finalTranscript)
      setListening(false)
    }

    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }

  // Filtered notes
  const filtered = notes.filter(n =>
    !search ||
    n.title?.toLowerCase().includes(search.toLowerCase()) ||
    n.content?.toLowerCase().includes(search.toLowerCase())
  )

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="panel-label animate-pulse-slow">Loading notes…</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link
            href="/dashboard"
            className="font-mono"
            style={{
              fontSize: '0.58rem', letterSpacing: '0.15em', textTransform: 'uppercase',
              color: 'var(--muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}
          >
            ← Vault
          </Link>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span className="panel-label">Notes</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {view === 'editor' && saveStatus && (
            <span className="font-mono" style={{ fontSize: '0.5rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: saveStatus === 'saving' ? 'var(--muted)' : '#50c864' }}>
              {saveStatus === 'saving' ? 'Saving…' : '✓ Saved'}
            </span>
          )}
          {view === 'editor' && (
            <button className="vault-btn-ghost" onClick={() => { manualSave(); setView('grid') }}>
              ← All Notes
            </button>
          )}
          <button className="vault-btn" onClick={newNote} style={{ padding: '0.5rem 1rem' }}>
            + New
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {view === 'grid' ? (
          /* ── Grid View ── */
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Notes grid */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              {/* Search */}
              <div style={{ marginBottom: '1.5rem', maxWidth: '400px' }}>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search notes…"
                  className="vault-input w-full px-4 py-2"
                  style={{ fontSize: '0.8rem' }}
                />
              </div>

              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', paddingTop: '4rem', opacity: 0.3 }}>
                  <p className="font-serif" style={{ fontSize: '1.8rem', fontWeight: 300, color: 'var(--muted)' }}>
                    {search ? 'Nothing found.' : 'No notes yet.'}
                  </p>
                  {!search && (
                    <button className="vault-btn mt-4" onClick={newNote} style={{ fontSize: '0.6rem' }}>
                      + Create your first note
                    </button>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    gap: '1px',
                    background: 'var(--border)',
                  }}
                >
                  {filtered.map((note, i) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      index={i}
                      onOpen={() => openNote(note)}
                      onDelete={() => deleteNote(note.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Shared ideas sidebar */}
            {sharedNotes.length > 0 && (
              <div
                className="vault-panel"
                style={{ width: '280px', flexShrink: 0, overflowY: 'auto', borderLeft: '1px solid var(--border)' }}
              >
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: '#0a0a0a' }}>
                  <span className="panel-label">Shared Ideas</span>
                  <p className="font-mono mt-1" style={{ fontSize: '0.5rem', color: 'var(--muted)', letterSpacing: '0.1em' }}>
                    From the team
                  </p>
                </div>
                <div style={{ padding: '0.5rem' }}>
                  {sharedNotes.map(note => (
                    <div
                      key={note.id}
                      style={{
                        padding: '0.75rem',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <p className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--text)', letterSpacing: '0.02em', marginBottom: '0.25rem' }}>
                        {note.title}
                      </p>
                      <p className="font-serif" style={{ fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 300, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {note.content}
                      </p>
                      <p className="msg-timestamp mt-1">{formatDate(note.updated_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── Editor View ── */
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: '820px', margin: '0 auto', padding: '2rem 2rem 1rem', overflow: 'hidden' }}>
              {/* Editor toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexShrink: 0 }}>
                {/* Voice button */}
                <button
                  onClick={toggleVoice}
                  data-hover
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.4rem 0.8rem',
                    fontFamily: 'var(--font-mono)', fontSize: '0.58rem',
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    border: `1px solid ${listening ? 'var(--ember)' : 'var(--border)'}`,
                    borderRadius: '2px',
                    background: listening ? 'var(--ember-dim)' : 'transparent',
                    color: listening ? 'var(--ember)' : 'var(--muted)',
                    transition: 'all 0.2s',
                  }}
                >
                  <MicIcon active={listening} />
                  {listening ? (
                    <span style={{ animation: 'pulseSlow 1s ease-in-out infinite' }}>Listening…</span>
                  ) : 'Voice'}
                </button>

                {/* Share toggle */}
                <button
                  onClick={() => setIsShared(v => !v)}
                  data-hover
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.4rem 0.8rem',
                    fontFamily: 'var(--font-mono)', fontSize: '0.58rem',
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    border: `1px solid ${isShared ? '#50c864' : 'var(--border)'}`,
                    borderRadius: '2px',
                    background: isShared ? 'rgba(80,200,100,0.08)' : 'transparent',
                    color: isShared ? '#50c864' : 'var(--muted)',
                    transition: 'all 0.2s',
                  }}
                >
                  <span>{isShared ? '◆ Shared' : '◇ Private'}</span>
                </button>

                {/* Save now */}
                <button
                  onClick={manualSave}
                  className="vault-btn-ghost"
                  style={{ marginLeft: 'auto' }}
                >
                  Save now
                </button>

                {/* Delete */}
                {activeNote && (
                  <button
                    onClick={() => deleteNote(activeNote.id)}
                    style={{
                      padding: '0.4rem 0.8rem',
                      fontFamily: 'var(--font-mono)', fontSize: '0.58rem',
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      border: '1px solid rgba(212,84,26,0.2)',
                      borderRadius: '2px',
                      background: 'transparent',
                      color: 'rgba(212,84,26,0.5)',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--ember)'; e.currentTarget.style.borderColor = 'var(--ember)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(212,84,26,0.5)'; e.currentTarget.style.borderColor = 'rgba(212,84,26,0.2)' }}
                  >
                    Delete
                  </button>
                )}
              </div>

              {/* Title */}
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Note title…"
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-serif)',
                  fontSize: 'clamp(1.8rem, 4vw, 3rem)',
                  fontWeight: 300,
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                  outline: 'none',
                  padding: '0 0 0.75rem',
                  marginBottom: '1.5rem',
                  width: '100%',
                  flexShrink: 0,
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--ember-dim)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />

              {/* Body */}
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Start writing… or tap the mic to speak."
                className="vault-textarea"
                style={{
                  flex: 1,
                  padding: '0',
                  border: 'none',
                  background: 'transparent',
                  fontSize: '1.05rem',
                  resize: 'none',
                  outline: 'none',
                }}
              />

              {/* Footer meta */}
              {activeNote && (
                <div style={{ flexShrink: 0, paddingTop: '1rem', display: 'flex', gap: '1rem' }}>
                  <span className="msg-timestamp">Created {formatDate(activeNote.created_at)}</span>
                  <span className="msg-timestamp">Updated {formatDate(activeNote.updated_at)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function NoteCard({ note, onOpen, onDelete }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onOpen}
      data-hover
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.01)',
        padding: '1.25rem',
        cursor: 'none',
        transition: 'background 0.2s, box-shadow 0.3s',
        boxShadow: hovered ? 'inset 0 0 20px rgba(212,84,26,0.04)' : 'none',
        position: 'relative',
      }}
    >
      {/* Ember left accent on hover */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0,
          width: '2px', height: hovered ? '100%' : '0',
          background: 'linear-gradient(180deg, var(--ember), transparent)',
          transition: 'height 0.4s cubic-bezier(0.16,1,0.3,1)',
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <p
          className="font-mono"
          style={{
            fontSize: '0.7rem', color: 'var(--text)',
            letterSpacing: '0.02em', lineHeight: 1.3,
            flex: 1, marginRight: '0.5rem',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {note.title || 'Untitled'}
        </p>
        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
          {note.is_shared && (
            <span style={{ fontSize: '0.45rem', color: '#50c864', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Shared
            </span>
          )}
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            style={{
              background: 'none', border: 'none', padding: '0',
              color: 'rgba(212,84,26,0.3)',
              fontSize: '0.7rem', lineHeight: 1,
              opacity: hovered ? 1 : 0, transition: 'opacity 0.2s',
            }}
          >
            ×
          </button>
        </div>
      </div>

      <p
        className="font-serif"
        style={{
          fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 300, lineHeight: 1.6,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}
      >
        {note.content || <em style={{ opacity: 0.4 }}>Empty note</em>}
      </p>

      <p className="msg-timestamp mt-2">{formatDate(note.updated_at)}</p>
    </div>
  )
}

export default function NotesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="panel-label animate-pulse-slow">Loading…</p>
      </div>
    }>
      <NotesInner />
    </Suspense>
  )
}
