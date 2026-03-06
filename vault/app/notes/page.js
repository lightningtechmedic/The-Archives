'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation' // eslint-disable-line
import { createClient } from '@/lib/supabase'
import TheGuideWidget from '@/components/TheGuideWidget'

function formatDate(ts) {
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Scrapbook Image ───────────────────────────────────────────────────────────
function ScrapbookImage({ img, onCaption, onRemove }) {
  return (
    <div className="scrapbook-wrap" style={{ transform: `rotate(${img.rotation}deg)`, margin: '.8rem 0' }}>
      <div className="tape-strip" />
      <img src={img.url} alt={img.caption} className="scrapbook-img" />
      <input className="scrapbook-caption" value={img.caption} onChange={e => onCaption(e.target.value)} placeholder="caption…" />
      {onRemove && (
        <button onClick={onRemove} style={{ position:'absolute', top:4, right:4, background:'rgba(0,0,0,0.6)', border:'none', color:'rgba(255,255,255,0.6)', borderRadius:'2px', fontSize:'.7rem', padding:'1px 4px' }}>×</button>
      )}
    </div>
  )
}

// ── Note Card ─────────────────────────────────────────────────────────────────
function NoteCard({ note, onOpen, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const preview = (note.content || '').replace(/\[img:[^\]]*\]/g, '').replace(/[#*`>]/g, '').trim()
  return (
    <div
      className={`note-card${hovered ? ' hovered' : ''}`}
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-hover
    >
      <div style={{ position:'absolute', top:0, left:0, width:2, height: hovered ? '100%' : 0, background:'linear-gradient(180deg,var(--ember),transparent)', transition:'height .4s var(--ease)' }} />
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'.5rem', marginBottom:'.4rem' }}>
        <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1.2rem', color:'var(--text)', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
          {note.title || 'Untitled'}
        </p>
        <div style={{ display:'flex', alignItems:'center', gap:'.4rem', flexShrink:0 }}>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:'.42rem', letterSpacing:'.08em', textTransform:'uppercase', color: note.is_shared ? 'var(--cyan)' : 'var(--muted)' }}>
            {note.is_shared ? 'shared' : 'private'}
          </span>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            style={{ background:'none', border:'none', color:'rgba(212,84,26,0.3)', fontSize:'.85rem', lineHeight:1, opacity: hovered ? 1 : 0, transition:'opacity .2s', padding:0 }}
          >×</button>
        </div>
      </div>
      <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1rem', color:'var(--muted)', lineHeight:1.45, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
        {preview || <em style={{ opacity:.4 }}>Empty note</em>}
      </p>
      <p className="msg-timestamp" style={{ marginTop:'.5rem' }}>{formatDate(note.updated_at)}</p>
    </div>
  )
}

// ── Voice FAB ─────────────────────────────────────────────────────────────────
function VoiceFAB({ setNoteContent }) {
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)
  const baseRef = useRef('')

  function toggle() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) { alert('Voice input not supported. Try Chrome.'); return }
    if (listening) { recRef.current?.stop(); setListening(false); return }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US'
    setNoteContent(prev => { baseRef.current = prev; return prev })
    rec.onresult = e => {
      let final = baseRef.current, interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript
        else interim = e.results[i][0].transcript
      }
      setNoteContent(final + (interim ? ` 🎙${interim}` : ''))
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recRef.current = rec; rec.start(); setListening(true)
  }

  return (
    <button className={`voice-fab${listening ? ' listening' : ''}`} onClick={toggle} data-hover
      style={{ bottom: '1.25rem', color: listening ? 'var(--green)' : 'var(--muted)' }} title="Voice input">
      🎙
    </button>
  )
}

// ── Floating Toolbar ──────────────────────────────────────────────────────────
function FloatingToolbar({ contentRef, setNoteContent, onImageClick }) {
  function apply(tag) {
    const ta = contentRef.current
    if (!ta) return
    const s = ta.selectionStart, e = ta.selectionEnd
    const sel = ta.value.slice(s, e)
    const map = { bold: `**${sel}**`, italic: `*${sel}*`, underline: `__${sel}__`, h1: `# ${sel}`, quote: `> ${sel}`, code: `\`${sel}\`` }
    const rep = map[tag] || sel
    setNoteContent(ta.value.slice(0, s) + rep + ta.value.slice(e))
    setTimeout(() => { ta.focus(); ta.selectionStart = s; ta.selectionEnd = s + rep.length }, 0)
  }
  const btns = [
    { tag: 'bold', label: 'B', style: { fontWeight: 700 } },
    { tag: 'italic', label: 'I', style: { fontStyle: 'italic' } },
    { tag: 'underline', label: 'U', style: { textDecoration: 'underline' } },
    { sep: true },
    { tag: 'h1', label: 'H₁', style: {} },
    { tag: 'quote', label: '❝', style: {} },
    { sep: true },
    { tag: 'image', label: '🖼', cls: 'ember', onClick: onImageClick },
    { tag: 'code', label: '#', style: {} },
  ]
  return (
    <div className="floating-toolbar" style={{ bottom: '1.25rem' }}>
      {btns.map((b, i) =>
        b.sep ? <div key={i} className="tb-sep" /> : (
          <button key={i} className={`tb-btn${b.cls ? ' ' + b.cls : ''}`}
            style={b.style} onClick={() => b.onClick ? b.onClick() : apply(b.tag)} title={b.tag}>
            {b.label}
          </button>
        )
      )}
    </div>
  )
}

// ── Inner (needs searchParams) ────────────────────────────────────────────────
function NotesInner() {
  const searchParams = useSearchParams()
  const supabaseRef = useRef(null)
  function getSupabase() {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }

  const [user, setUser] = useState(null)
  const [notes, setNotes] = useState([])
  const [sharedNotes, setSharedNotes] = useState([])
  const [activeNote, setActiveNote] = useState(null)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [noteImages, setNoteImages] = useState([])
  const [isShared, setIsShared] = useState(false)
  const [search, setSearch] = useState('')
  const [view, setView] = useState('grid')
  const [saveStatus, setSaveStatus] = useState('')
  const [mounted, setMounted] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const saveTimerRef = useRef(null)
  const contentRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const { data: { subscription } } = getSupabase().auth.onAuthStateChange((event, session) => {
      if (!session) { window.location.href = '/vault/login'; return }
      setUser(session.user); setMounted(true)
    })
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line

  useEffect(() => {
    if (!user) return
    loadNotes()
    getSupabase().from('notes').select('id,title,content,user_id,is_shared,created_at,updated_at').eq('is_shared', true).neq('user_id', user.id).order('updated_at', { ascending: false })
      .then(({ data }) => setSharedNotes(data || []))
  }, [user]) // eslint-disable-line

  async function loadNotes() {
    const { data } = await getSupabase().from('notes').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
    setNotes(data || [])
    const noteId = searchParams.get('id')
    if (noteId && data) { const found = data.find(n => n.id === noteId); if (found) openNote(found) }
  }

  function openNote(note) {
    setActiveNote(note); setNoteTitle(note.title || '')
    const IMG_RE = /\[img:(.*?):(.*?)\]/g
    const imgs = []; let m
    const raw = note.content || ''
    while ((m = IMG_RE.exec(raw)) !== null) imgs.push({ id: Date.now() + Math.random(), url: m[1], caption: m[2], rotation: parseFloat((Math.random() * 4 - 2).toFixed(2)) })
    setNoteContent(raw.replace(IMG_RE, '').trim())
    setNoteImages(imgs); setIsShared(note.is_shared || false); setView('editor')
  }

  function newNote() { setActiveNote(null); setNoteTitle(''); setNoteContent(''); setNoteImages([]); setIsShared(false); setView('editor') }

  useEffect(() => {
    if (view !== 'editor') return
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => { if (noteTitle || noteContent) autoSave() }, 2500)
    return () => clearTimeout(saveTimerRef.current)
  }, [noteTitle, noteContent, noteImages, isShared, view]) // eslint-disable-line

  async function autoSave() {
    setSaveStatus('saving')
    const imgStr = noteImages.map(i => `[img:${i.url}:${i.caption}]`).join('')
    const contentToSave = noteContent + (imgStr ? '\n' + imgStr : '')
    const sb = getSupabase()
    if (activeNote) {
      const { data } = await sb.from('notes').update({ title: noteTitle || 'Untitled', content: contentToSave, is_shared: isShared, updated_at: new Date().toISOString() }).eq('id', activeNote.id).select().single()
      if (data) { setActiveNote(data); setNotes(prev => prev.map(n => n.id === data.id ? data : n)) }
    } else {
      if (!noteTitle && !noteContent) { setSaveStatus(''); return }
      const { data } = await sb.from('notes').insert({ user_id: user.id, title: noteTitle || 'Untitled', content: contentToSave, is_shared: isShared }).select().single()
      if (data) { setActiveNote(data); setNotes(prev => [data, ...prev]) }
    }
    setSaveStatus('saved'); setTimeout(() => setSaveStatus(''), 2500)
  }

  async function deleteNote(id) {
    await getSupabase().from('notes').delete().eq('id', id)
    setNotes(prev => prev.filter(n => n.id !== id))
    if (activeNote?.id === id) { setActiveNote(null); setNoteTitle(''); setNoteContent(''); setView('grid') }
  }

  async function uploadImage(file) {
    if (!file || !file.type.startsWith('image/')) return
    const path = `${user.id}/${Date.now()}-${file.name}`
    const sb = getSupabase()
    const { error } = await sb.storage.from('vault-images').upload(path, file)
    if (error) { console.error('[image upload]', error); return }
    const { data: urlData } = sb.storage.from('vault-images').getPublicUrl(path)
    setNoteImages(prev => [...prev, { id: Date.now(), url: urlData.publicUrl, caption: '', rotation: parseFloat((Math.random() * 4 - 2).toFixed(2)) }])
  }

  const filtered = notes.filter(n => !search || (n.title || '').toLowerCase().includes(search.toLowerCase()) || (n.content || '').toLowerCase().includes(search.toLowerCase()))

  if (!mounted) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <p className="panel-label animate-pulse-slow">Loading notes…</p>
    </div>
  )

  const watermark = (noteTitle || 'N')[0].toUpperCase()

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column' }}>
      {/* Topbar */}
      <div style={{ position:'fixed', top:0, left:0, right:0, height:44, zIndex:500, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 1rem', background:'rgba(11,10,8,0.88)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'.65rem' }}>
          <div className="ember-pip" />
          <a href="/vault/dashboard" style={{ fontFamily:'var(--font-serif)', fontSize:'1.1rem', fontWeight:300, fontStyle:'italic', color:'var(--text)', textDecoration:'none' }}>
            The <em style={{ color:'var(--ember)' }}>Vault</em>
          </a>
          <span style={{ color:'var(--border)' }}>|</span>
          <span className="panel-label">Notes</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'.6rem' }}>
          {view === 'editor' && saveStatus && (
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'.48rem', letterSpacing:'.1em', color: saveStatus === 'saving' ? 'var(--muted)' : 'var(--green)', display:'flex', alignItems:'center', gap:'.3rem' }}>
              <span style={{ width:5, height:5, borderRadius:'50%', background: saveStatus === 'saving' ? 'var(--muted)' : 'var(--green)', animation: saveStatus === 'saving' ? 'pulseSlow 1s ease-in-out infinite' : 'none' }} />
              {saveStatus === 'saving' ? 'Saving…' : 'Saved just now'}
            </span>
          )}
          {view === 'editor' && (
            <button className="vault-btn-ghost" onClick={() => { autoSave(); setView('grid') }}>← All Notes</button>
          )}
          <button className="vault-btn" onClick={newNote} style={{ padding:'.45rem .9rem', fontSize:'.55rem' }}>+ New</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, paddingTop:44 }}>
        {view === 'grid' ? (
          /* ── Grid View ── */
          <div style={{ display:'flex', flex:1, minHeight:'calc(100vh - 44px)' }}>
            <div style={{ flex:1, padding:'1.5rem', overflowY:'auto' }}>
              {/* Search */}
              <div style={{ marginBottom:'1.5rem', maxWidth:400 }}>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes…" className="vault-input w-full" style={{ fontSize:'.8rem' }} />
              </div>
              {filtered.length === 0 ? (
                <div style={{ textAlign:'center', paddingTop:'5rem', opacity:.3 }}>
                  <p style={{ fontFamily:'var(--font-caveat)', fontSize:'2rem', color:'var(--muted)', fontStyle:'italic' }}>{search ? 'Nothing found.' : 'No notes yet.'}</p>
                  {!search && <button className="vault-btn" style={{ marginTop:'1rem' }} onClick={newNote}>+ Create your first note</button>}
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'.75rem' }}>
                  {filtered.map(note => (
                    <NoteCard key={note.id} note={note} onOpen={() => openNote(note)} onDelete={() => deleteNote(note.id)} />
                  ))}
                </div>
              )}
            </div>
            {/* Shared sidebar */}
            {sharedNotes.length > 0 && (
              <div style={{ width:260, flexShrink:0, borderLeft:'1px solid var(--border)', overflowY:'auto', padding:'.75rem' }}>
                <p className="panel-label" style={{ marginBottom:'.75rem' }}>Shared with me</p>
                {sharedNotes.map(n => (
                  <div key={n.id} style={{ padding:'.6rem 0', borderBottom:'1px solid var(--border)' }}>
                    <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1rem', color:'var(--mid)', marginBottom:'.2rem' }}>{n.title || 'Untitled'}</p>
                    <p style={{ fontFamily:'var(--font-caveat)', fontSize:'.85rem', color:'var(--muted)', lineHeight:1.35, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{(n.content || '').replace(/\[img:[^\]]*\]/g, '').trim()}</p>
                    <p className="msg-timestamp" style={{ marginTop:'.2rem' }}>{formatDate(n.updated_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── Editor View ── */
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) uploadImage(f) }}
            style={{ display:'flex', justifyContent:'center', minHeight:'calc(100vh - 44px)', position:'relative', padding:'2.5rem 2rem 5rem' }}
          >
            {/* Watermark */}
            <div style={{ position:'fixed', top:'20%', left:'50%', transform:'translateX(-50%)', fontSize:'20vw', fontFamily:'var(--font-serif)', fontWeight:300, fontStyle:'italic', color:'var(--ember)', opacity:.022, pointerEvents:'none', userSelect:'none', zIndex:0, lineHeight:1 }}>
              {watermark}
            </div>

            {/* Annotation */}
            <div style={{ position:'fixed', left:'calc(50% - 420px)', top:120, transform:'rotate(-2deg)', pointerEvents:'none', zIndex:1, opacity:.3 }}>
              <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1rem', color:'var(--ember)', fontStyle:'italic', borderLeft:'2px solid var(--ember)', paddingLeft:'.5rem' }}>
                {isShared ? '— shared with team' : '— private draft'}
              </p>
            </div>

            {/* Drop overlay */}
            {dragOver && (
              <div style={{ position:'fixed', inset:0, zIndex:50, border:'2px dashed var(--ember)', background:'rgba(212,84,26,0.04)', display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1.8rem', color:'var(--ember)' }}>Drop image into your note ✦</p>
              </div>
            )}

            <div style={{ width:'100%', maxWidth:740, zIndex:2, position:'relative' }}>
              {/* Share + meta */}
              <div style={{ display:'flex', alignItems:'center', gap:'.65rem', marginBottom:'1.5rem' }}>
                <button onClick={() => setIsShared(v => !v)} data-hover
                  style={{ display:'flex', alignItems:'center', gap:'.4rem', padding:'.3rem .75rem', background:'transparent', border:`1px solid ${isShared ? 'var(--cyan)' : 'var(--border)'}`, borderRadius:'20px', color: isShared ? 'var(--cyan)' : 'var(--muted)', fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.1em', textTransform:'uppercase', transition:'all .2s' }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background: isShared ? 'var(--cyan)' : 'var(--muted)' }} />
                  {isShared ? 'Shared' : 'Private'}
                </button>
                <span style={{ flex:1 }} />
                {activeNote && (
                  <button onClick={() => deleteNote(activeNote.id)} style={{ padding:'.3rem .7rem', border:'1px solid rgba(212,84,26,0.2)', borderRadius:'2px', background:'transparent', color:'rgba(212,84,26,0.45)', fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.1em', textTransform:'uppercase', transition:'all .2s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--ember)'; e.currentTarget.style.borderColor = 'var(--ember)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(212,84,26,0.45)'; e.currentTarget.style.borderColor = 'rgba(212,84,26,0.2)' }}>
                    Delete
                  </button>
                )}
              </div>

              {/* Title */}
              <textarea
                value={noteTitle} onChange={e => setNoteTitle(e.target.value)}
                placeholder="Note title…" rows={1}
                style={{ background:'transparent', border:'none', outline:'none', resize:'none', width:'100%', fontFamily:'var(--font-caveat)', fontSize:'clamp(2rem,5vw,3.2rem)', fontWeight:700, color:'var(--text)', lineHeight:1.1, padding:0, marginBottom:'1.5rem', overflow:'hidden' }}
                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
              />

              {/* Body */}
              <textarea
                ref={contentRef}
                value={noteContent} onChange={e => setNoteContent(e.target.value)}
                placeholder="Start writing…"
                className="ruled-editor"
                style={{ background:'transparent', border:'none', outline:'none', resize:'none', width:'100%', fontFamily:'var(--font-caveat)', fontSize:'1.25rem', color:'var(--text)', lineHeight:'2.3rem', minHeight:300 }}
              />

              {/* Images */}
              {noteImages.length > 0 && (
                <div style={{ marginTop:'1rem', display:'flex', flexWrap:'wrap', gap:'1rem' }}>
                  {noteImages.map((img, i) => (
                    <ScrapbookImage key={img.id} img={img}
                      onCaption={v => setNoteImages(prev => prev.map((x, j) => j === i ? { ...x, caption: v } : x))}
                      onRemove={() => setNoteImages(prev => prev.filter((_, j) => j !== i))}
                    />
                  ))}
                </div>
              )}

              {/* Footer */}
              {activeNote && (
                <div style={{ display:'flex', gap:'1rem', marginTop:'1.5rem' }}>
                  <span className="msg-timestamp">Created {formatDate(activeNote.created_at)}</span>
                  <span className="msg-timestamp">Updated {formatDate(activeNote.updated_at)}</span>
                </div>
              )}
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }}
              onChange={e => e.target.files[0] && uploadImage(e.target.files[0])} />

            <VoiceFAB setNoteContent={setNoteContent} />
            <FloatingToolbar contentRef={contentRef} setNoteContent={setNoteContent} onImageClick={() => fileInputRef.current?.click()} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function NotesPage() {
  return (
    <>
      <Suspense fallback={<div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}><p className="panel-label animate-pulse-slow">Loading…</p></div>}>
        <NotesInner />
      </Suspense>
      <TheGuideWidget />
    </>
  )
}
