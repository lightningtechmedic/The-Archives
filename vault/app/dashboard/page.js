'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

// ── AI config (DB roles stay 'claude'/'gpt' for backwards compat) ──────────
const AI = {
  claude: {
    label: 'The Architect', initial: 'A', role: 'claude',
    color: '#d4541a', dim: 'rgba(212,84,26,0.12)', border: 'rgba(212,84,26,0.4)',
    textColor: 'rgba(255,220,200,0.88)',
  },
  gpt: {
    label: 'The Spark', initial: 'S', role: 'gpt',
    color: '#c8973a', dim: 'rgba(200,151,58,0.12)', border: 'rgba(200,151,58,0.4)',
    textColor: 'rgba(255,240,180,0.88)',
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
function isSmara(profile) {
  if (!profile) return false
  const n = (profile.display_name || profile.email || '').toLowerCase()
  return n.includes('smara')
}

// ── Animated avatars ─────────────────────────────────────────────────────────
function AvatarArchitect({ size = 30 }) {
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      background: 'linear-gradient(135deg,#1a0d05,#0d0805)',
      border: '1px solid rgba(212,84,26,0.45)', borderRadius: '2px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(212,84,26,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(212,84,26,0.07) 1px,transparent 1px)',
        backgroundSize: '6px 6px',
      }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: size * 0.1 }}>
        <div style={{ display: 'flex', gap: size * 0.14 }}>
          {[0, 1].map(i => (
            <div key={i} style={{
              width: size * 0.2, height: size * 0.11,
              background: 'var(--ember)', borderRadius: '1px',
              animation: `scanEyes ${2 + i * 0.4}s ease-in-out infinite`,
              animationDelay: i * 0.2 + 's',
            }} />
          ))}
        </div>
        <div style={{ width: size * 0.38, height: '1px', background: 'rgba(212,84,26,0.45)' }} />
      </div>
    </div>
  )
}

function AvatarSpark({ size = 30 }) {
  const [sparkPos, setSparkPos] = useState({ x: 2, y: -2 })
  useEffect(() => {
    const id = setInterval(() => setSparkPos({ x: Math.random() * 12 - 6, y: Math.random() * 12 - 10 }), 2800)
    return () => clearInterval(id)
  }, [])
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      background: 'linear-gradient(135deg,#1a1205,#0d0c05)',
      border: '1px solid rgba(200,151,58,0.45)', borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'visible',
      animation: 'glitch 8s ease-in-out infinite',
    }}>
      <div style={{ display: 'flex', gap: size * 0.13, alignItems: 'center' }}>
        <div style={{ width: size * 0.22, height: size * 0.22, background: 'var(--gold)', borderRadius: '50%', animation: 'blinkEye 4s ease-in-out infinite' }} />
        <div style={{ width: size * 0.15, height: size * 0.18, background: 'var(--gold)', borderRadius: '50%', animation: 'blinkEye 4s ease-in-out infinite', animationDelay: '.6s' }} />
      </div>
      <div style={{
        position: 'absolute', top: sparkPos.y, right: sparkPos.x,
        fontSize: size * 0.28, color: 'var(--gold)',
        animation: 'sparkle 2.8s ease-in-out infinite',
        transition: 'top .8s ease, right .8s ease',
      }}>✦</div>
    </div>
  )
}

function AvatarUser({ size = 30 }) {
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      background: 'linear-gradient(135deg,#3d1a08,#1a0d05)',
      border: '1px solid rgba(212,84,26,0.5)', borderRadius: '4px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.46, animation: 'pulseSlow 3s ease-in-out infinite',
    }}>⚡</div>
  )
}

function AvatarSmara({ size = 30 }) {
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      background: 'radial-gradient(circle at 35% 35%,rgba(255,255,255,0.9),rgba(58,212,200,0.7),rgba(30,80,200,0.4))',
      borderRadius: '50%',
      border: '1px solid rgba(58,212,200,0.35)',
      animation: 'breatheOrb 2s ease-in-out infinite',
    }} />
  )
}

function AvatarGeneric({ initial, size = 30 }) {
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-mono)', fontSize: size * 0.4,
      color: 'rgba(255,255,255,0.55)',
    }}>{initial || '?'}</div>
  )
}

function getAvatar(profile, isCurrentUser, size = 30) {
  if (isCurrentUser) return <AvatarUser size={size} />
  if (isSmara(profile)) return <AvatarSmara size={size} />
  return <AvatarGeneric initial={(profile?.display_name || profile?.email || '?')[0].toUpperCase()} size={size} />
}

// ── Display Name Modal ────────────────────────────────────────────────────────
function DisplayNameModal({ onSave }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  return (
    <div style={{ position:'fixed', inset:0, zIndex:8000, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:'380px', background:'rgba(11,10,8,0.97)', border:'1px solid var(--border)', borderRadius:'4px', padding:'2rem' }}>
        <p className="panel-label" style={{ marginBottom:'.5rem' }}>First time here</p>
        <h2 style={{ fontFamily:'var(--font-caveat)', fontSize:'2.4rem', color:'var(--text)', fontWeight:600, marginBottom:'1.25rem', lineHeight:1 }}>
          What's your <span style={{ color:'var(--ember)', fontStyle:'italic' }}>name</span>?
        </h2>
        <input
          type="text" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onSave(name.trim(), setLoading)}
          placeholder="Your name" autoFocus maxLength={32}
          className="vault-input w-full" style={{ marginBottom:'1rem' }}
        />
        <button className="vault-btn w-full justify-center" disabled={!name.trim() || loading}
          onClick={() => onSave(name.trim(), setLoading)}>
          {loading ? 'Saving…' : 'Enter The Vault →'}
        </button>
      </div>
    </div>
  )
}

// ── TopBar ────────────────────────────────────────────────────────────────────
function TopBar({ noteTitle, notesCount, onNotesToggle, onlineUsers, allProfiles, profile, user, onSignOut }) {
  return (
    <div className="topbar">
      {/* Left */}
      <div style={{ display:'flex', alignItems:'center', gap:'.65rem' }}>
        <div className="ember-pip" />
        <span style={{ fontFamily:'var(--font-serif)', fontSize:'1.1rem', fontWeight:300, fontStyle:'italic', color:'var(--text)', letterSpacing:'.01em' }}>
          The <em style={{ color:'var(--ember)' }}>Vault</em>
        </span>
      </div>

      {/* Center */}
      <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', maxWidth:'300px', overflow:'hidden' }}>
        <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1rem', color:'var(--muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', textAlign:'center' }}>
          {noteTitle || 'Untitled'}
        </p>
      </div>

      {/* Right */}
      <div style={{ display:'flex', alignItems:'center', gap:'.6rem' }}>
        <button
          onClick={onNotesToggle} data-hover
          style={{ display:'flex', alignItems:'center', gap:'.4rem', background:'transparent', border:'1px solid var(--border)', borderRadius:'4px', padding:'.3rem .65rem', color:'var(--muted)', fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.12em', textTransform:'uppercase', transition:'all .2s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-h)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)';   e.currentTarget.style.color = 'var(--muted)' }}
        >
          Notes
          {notesCount > 0 && (
            <span style={{ background:'var(--ember)', color:'#0b0a08', borderRadius:'3px', padding:'0 .3rem', fontSize:'.48rem', fontWeight:700 }}>{notesCount}</span>
          )}
        </button>

        {/* Online avatars */}
        <div style={{ display:'flex', alignItems:'center', gap:'-.3rem' }}>
          {onlineUsers.slice(0, 4).map((u, i) => {
            const prof = allProfiles.find(p => p.id === u.user_id)
            const isMe = prof?.id === user?.id
            return (
              <div key={u.user_id || i} style={{ marginLeft: i > 0 ? '-6px' : 0, zIndex: 10 - i }}>
                {getAvatar(prof, isMe, 24)}
              </div>
            )
          })}
        </div>

        <button className="vault-btn-ghost" onClick={onSignOut} style={{ padding:'.3rem .6rem', fontSize:'.48rem' }}>
          Out
        </button>
      </div>
    </div>
  )
}

// ── Notes Drawer ──────────────────────────────────────────────────────────────
function NotesDrawer({ open, notes, sharedNotes, activeNoteId, onOpen, onNew, onClose, search, setSearch }) {
  return (
    <div className={`notes-drawer${open ? ' open' : ''}`}>
      {/* Header */}
      <div style={{ padding:'.85rem 1rem', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <h2 style={{ fontFamily:'var(--font-caveat)', fontSize:'1.8rem', color:'var(--text)', fontWeight:600, marginBottom:'.6rem', lineHeight:1 }}>notes</h2>
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search…" className="vault-input w-full" style={{ fontSize:'.75rem', padding:'.4rem .7rem' }}
        />
      </div>

      {/* List */}
      <div style={{ flex:1, overflowY:'auto', padding:'.4rem' }}>
        {notes.length === 0 && !search && (
          <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1.1rem', color:'var(--muted)', textAlign:'center', padding:'2rem .5rem', fontStyle:'italic' }}>
            No notes yet. Create one.
          </p>
        )}
        {notes.length > 0 && (
          <>
            <p className="panel-label" style={{ padding:'.5rem .5rem .25rem', opacity:.7 }}>Mine</p>
            {notes.map(note => (
              <NoteRow key={note.id} note={note} active={note.id === activeNoteId} onOpen={() => { onOpen(note); onClose() }} />
            ))}
          </>
        )}
        {sharedNotes.length > 0 && (
          <>
            <p className="panel-label" style={{ padding:'.75rem .5rem .25rem', opacity:.7 }}>Shared with me</p>
            {sharedNotes.map(note => (
              <NoteRow key={note.id} note={note} active={note.id === activeNoteId} onOpen={() => { onOpen(note); onClose() }} readOnly />
            ))}
          </>
        )}
      </div>

      {/* New note */}
      <div style={{ padding:'.75rem', borderTop:'1px solid var(--border)', flexShrink:0 }}>
        <button
          onClick={() => { onNew(); onClose() }} data-hover
          style={{ width:'100%', padding:'.65rem', background:'transparent', border:'1px dashed var(--ember)', borderRadius:'3px', color:'var(--ember)', fontFamily:'var(--font-caveat)', fontSize:'1.1rem', transition:'all .2s var(--ease)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--ember-glow)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >+ new note</button>
      </div>
    </div>
  )
}

function NoteRow({ note, active, onOpen, readOnly }) {
  return (
    <div
      onClick={onOpen} data-hover
      style={{
        padding:'.6rem .65rem', borderRadius:'2px', cursor:'none',
        borderLeft: active ? '2px solid var(--ember)' : '2px solid transparent',
        background: active ? 'rgba(212,84,26,0.05)' : 'transparent',
        transition:'all .15s', marginBottom:'1px',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ display:'flex', alignItems:'center', gap:'.4rem', marginBottom:'.2rem' }}>
        <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1.05rem', color: active ? 'var(--text)' : 'var(--mid)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {note.title || 'Untitled'}
        </p>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'.42rem', letterSpacing:'.08em', textTransform:'uppercase', color: note.is_shared ? 'var(--cyan)' : 'var(--muted)', flexShrink:0 }}>
          {note.is_shared ? 'shared' : 'private'}
        </span>
      </div>
      <p style={{ fontFamily:'var(--font-caveat)', fontSize:'.9rem', color:'var(--muted)', lineHeight:1.3, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical' }}>
        {(note.content || '').replace(/\[img:[^\]]*\]/g, '').trim() || 'Empty'}
      </p>
      <p className="msg-timestamp" style={{ marginTop:'.2rem' }}>
        {new Date(note.updated_at).toLocaleDateString([], { month:'short', day:'numeric' })}
      </p>
    </div>
  )
}

// ── Scrapbook Image ────────────────────────────────────────────────────────────
function ScrapbookImage({ img, onCaption, onRemove }) {
  return (
    <div className="scrapbook-wrap" style={{ transform: `rotate(${img.rotation}deg)`, margin: '1rem 0' }}>
      <div className="tape-strip" />
      <img src={img.url} alt={img.caption} className="scrapbook-img" />
      <input
        className="scrapbook-caption"
        value={img.caption}
        onChange={e => onCaption(e.target.value)}
        placeholder="caption…"
      />
      {onRemove && (
        <button onClick={onRemove} style={{ position:'absolute', top:4, right:4, background:'rgba(0,0,0,0.6)', border:'none', color:'rgba(255,255,255,0.6)', borderRadius:'2px', fontSize:'.7rem', padding:'1px 4px', lineHeight:1 }}>×</button>
      )}
    </div>
  )
}

// ── Full Screen Editor ─────────────────────────────────────────────────────────
function FullScreenEditor({ noteTitle, setNoteTitle, noteContent, setNoteContent, noteImages, setNoteImages, isShared, setIsShared, saveStatus, user, supabase, chatHeight, contentRef }) {
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const watermarkLetter = (noteTitle || 'N')[0].toUpperCase()

  async function uploadImage(file) {
    if (!file || !file.type.startsWith('image/')) return
    const path = `${user.id}/${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage.from('vault-images').upload(path, file, { upsert: false })
    if (error) { console.error('[image upload]', error); return }
    const { data: urlData } = supabase.storage.from('vault-images').getPublicUrl(path)
    const rotation = (Math.random() * 4 - 2).toFixed(2)
    setNoteImages(prev => [...prev, { id: Date.now(), url: urlData.publicUrl, caption: '', rotation: parseFloat(rotation) }])
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadImage(file)
  }

  function formatSelection(tag) {
    const ta = contentRef.current
    if (!ta) return
    const start = ta.selectionStart, end = ta.selectionEnd
    const sel = ta.value.slice(start, end)
    let replacement = sel
    if (tag === 'bold')       replacement = `**${sel}**`
    else if (tag === 'italic') replacement = `*${sel}*`
    else if (tag === 'h1')     replacement = `# ${sel}`
    else if (tag === 'quote')  replacement = `> ${sel}`
    const newVal = ta.value.slice(0, start) + replacement + ta.value.slice(end)
    setNoteContent(newVal)
    setTimeout(() => { ta.selectionStart = start; ta.selectionEnd = start + replacement.length; ta.focus() }, 0)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{ position:'relative', flex:1, display:'flex', flexDirection:'column', alignItems:'center', paddingTop:'44px', paddingBottom: chatHeight + 64 + 'px', overflow:'hidden' }}
    >
      {/* Ghost watermark */}
      <div style={{ position:'absolute', top:'15%', left:'50%', transform:'translateX(-50%)', fontSize:'22vw', fontFamily:'var(--font-serif)', fontWeight:300, fontStyle:'italic', color:'var(--ember)', opacity:.025, pointerEvents:'none', userSelect:'none', zIndex:0, lineHeight:1 }}>
        {watermarkLetter}
      </div>

      {/* Sketch annotation */}
      <div style={{ position:'absolute', left:'calc(50% - 420px)', top:'120px', transform:'rotate(-2.5deg)', pointerEvents:'none', zIndex:1, opacity:.35 }}>
        <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1rem', color:'var(--ember)', fontStyle:'italic', borderLeft:'2px solid var(--ember)', paddingLeft:'.5rem' }}>
          {isShared ? '— shared with team' : '— private draft'}
        </p>
      </div>

      {/* Drop overlay */}
      {dragOver && (
        <div style={{ position:'absolute', inset:0, zIndex:50, border:'2px dashed var(--ember)', borderRadius:'4px', background:'rgba(212,84,26,0.04)', display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
          <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1.6rem', color:'var(--ember)' }}>Drop image into your note ✦</p>
        </div>
      )}

      {/* Editor content */}
      <div style={{ position:'relative', zIndex:2, width:'100%', maxWidth:'740px', padding:'2.5rem 2rem 1rem', display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>

        {/* Share pill + save */}
        <div style={{ display:'flex', alignItems:'center', gap:'.65rem', marginBottom:'1.5rem', flexShrink:0 }}>
          <button
            onClick={() => setIsShared(v => !v)} data-hover
            style={{ display:'flex', alignItems:'center', gap:'.4rem', padding:'.3rem .75rem', background:'transparent', border:`1px solid ${isShared ? 'var(--cyan)' : 'var(--border)'}`, borderRadius:'20px', color: isShared ? 'var(--cyan)' : 'var(--muted)', fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.1em', textTransform:'uppercase', transition:'all .2s' }}
          >
            <span style={{ width:6, height:6, borderRadius:'50%', background: isShared ? 'var(--cyan)' : 'var(--muted)', animation: isShared ? 'pulseSlow 2s ease-in-out infinite' : 'none' }} />
            {isShared ? 'Shared' : 'Private'}
          </button>
          <span style={{ flex:1 }} />
          {saveStatus && (
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'.48rem', letterSpacing:'.1em', color: saveStatus === 'saving' ? 'var(--muted)' : 'var(--green)', display:'flex', alignItems:'center', gap:'.3rem' }}>
              <span style={{ width:5, height:5, borderRadius:'50%', background: saveStatus === 'saving' ? 'var(--muted)' : 'var(--green)', animation: saveStatus === 'saving' ? 'pulseSlow 1s ease-in-out infinite' : 'none' }} />
              {saveStatus === 'saving' ? 'Saving…' : 'Saved just now'}
            </span>
          )}
        </div>

        {/* Title */}
        <textarea
          value={noteTitle}
          onChange={e => setNoteTitle(e.target.value)}
          placeholder="Note title…"
          rows={1}
          style={{ background:'transparent', border:'none', outline:'none', resize:'none', width:'100%', fontFamily:'var(--font-caveat)', fontSize:'clamp(2rem,5vw,3.2rem)', fontWeight:700, color:'var(--text)', lineHeight:1.1, padding:0, marginBottom:'1.5rem', flexShrink:0, overflow:'hidden' }}
          onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
        />

        {/* Body */}
        <textarea
          ref={contentRef}
          value={noteContent}
          onChange={e => setNoteContent(e.target.value)}
          placeholder="Start writing…"
          className="ruled-editor"
          style={{ flex:1, background:'transparent', border:'none', outline:'none', resize:'none', width:'100%', fontFamily:'var(--font-caveat)', fontSize:'1.25rem', color:'var(--text)', lineHeight:'2.3rem', padding:0, minHeight:'200px' }}
        />

        {/* Scrapbook images */}
        {noteImages.length > 0 && (
          <div style={{ marginTop:'1rem', display:'flex', flexWrap:'wrap', gap:'1rem' }}>
            {noteImages.map((img, i) => (
              <ScrapbookImage
                key={img.id}
                img={img}
                onCaption={v => setNoteImages(prev => prev.map((x, j) => j === i ? { ...x, caption: v } : x))}
                onRemove={() => setNoteImages(prev => prev.filter((_, j) => j !== i))}
              />
            ))}
          </div>
        )}

        {/* Image upload trigger (hidden, called from toolbar) */}
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }}
          onChange={e => e.target.files[0] && uploadImage(e.target.files[0])} />
      </div>

      {/* Expose file input trigger via custom event */}
      <div id="img-input-trigger" data-open={() => fileInputRef.current?.click()} style={{ display:'none' }} />
    </div>
  )
}

// ── Floating Toolbar ──────────────────────────────────────────────────────────
function FloatingToolbar({ contentRef, setNoteContent, chatHeight, onImageClick }) {
  const bottom = chatHeight + 16

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
    { tag: 'bold',      label: 'B', style: { fontWeight: 700 } },
    { tag: 'italic',    label: 'I', style: { fontStyle: 'italic' } },
    { tag: 'underline', label: 'U', style: { textDecoration: 'underline' } },
    { sep: true },
    { tag: 'h1',        label: 'H₁', style: {} },
    { tag: 'quote',     label: '❝', style: {} },
    { sep: true },
    { tag: 'image',     label: '🖼', cls: 'ember', onClick: onImageClick },
    { tag: 'code',      label: '#', style: {} },
  ]

  return (
    <div className="floating-toolbar" style={{ bottom }}>
      {btns.map((b, i) =>
        b.sep ? <div key={i} className="tb-sep" /> : (
          <button key={i} className={`tb-btn${b.cls ? ' ' + b.cls : ''}`}
            style={b.style} onClick={() => b.onClick ? b.onClick() : apply(b.tag)}
            title={b.tag}
          >{b.label}</button>
        )
      )}
    </div>
  )
}

// ── Voice FAB ─────────────────────────────────────────────────────────────────
function VoiceFAB({ setNoteContent, chatHeight }) {
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)
  const baseRef = useRef('')

  function toggle() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input not supported. Try Chrome.')
      return
    }
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
    recRef.current = rec
    rec.start()
    setListening(true)
  }

  return (
    <button className={`voice-fab${listening ? ' listening' : ''}`} onClick={toggle} data-hover
      style={{ bottom: chatHeight + 16, color: listening ? 'var(--green)' : 'var(--muted)' }} title="Voice input">
      🎙
    </button>
  )
}

// ── Chat Message ──────────────────────────────────────────────────────────────
function ChatMessage({ msg, allProfiles, currentUserId, onPin, isPinned }) {
  const role = msg.role === 'user' ? 'human' : msg.role
  const isArchitect = role === 'claude'
  const isSpark = role === 'gpt'
  const isAI = isArchitect || isSpark
  const aiMeta = isArchitect ? AI.claude : isSpark ? AI.gpt : null

  const prof = allProfiles?.find(p => p.id === msg.user_id)
  const isMe = msg.user_id === currentUserId
  const label = isArchitect ? AI.claude.label : isSpark ? AI.gpt.label : (msg.display_name || prof?.display_name || 'Team')

  let avatar
  if (isArchitect)   avatar = <AvatarArchitect size={26} />
  else if (isSpark)  avatar = <AvatarSpark size={26} />
  else if (isSmara(prof)) avatar = <AvatarSmara size={26} />
  else if (isMe)     avatar = <AvatarUser size={26} />
  else               avatar = <AvatarGeneric initial={(label || '?')[0].toUpperCase()} size={26} />

  return (
    <div className="msg-row" style={{ borderLeft: isAI ? `2px solid ${aiMeta.border}` : `2px solid rgba(58,212,200,0.15)`, paddingLeft:'.5rem', marginLeft:'-.5rem' }}>
      {avatar}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:'.5rem', marginBottom:'.1rem' }}>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.12em', textTransform:'uppercase', color: aiMeta?.color || (isSmara(prof) ? 'var(--cyan)' : 'rgba(255,255,255,0.6)') }}>
            {label}
          </span>
          <span className="msg-timestamp">{formatTime(msg.created_at)}</span>
        </div>
        <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1.1rem', color: aiMeta?.textColor || 'var(--text)', lineHeight:1.55, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
          {msg.content}
          {msg.streaming && <span style={{ color: aiMeta?.color || 'var(--ember)', marginLeft:1 }} className="animate-pulse-slow">▋</span>}
        </p>
      </div>
      <button className={`pin-btn${isPinned ? ' pinned' : ''}`} onClick={() => onPin(msg)} title="Pin to note">
        {isPinned ? '📌' : '📍'}
      </button>
    </div>
  )
}

function ThinkingDot({ model }) {
  const meta = AI[model]
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'.5rem', paddingLeft:'.5rem', borderLeft:`2px solid ${meta.border}`, marginLeft:'-.5rem' }}>
      <AvatarArchitect size={26} />
      <div style={{ display:'flex', alignItems:'center', gap:'.4rem' }}>
        <div style={{ width:5, height:5, borderRadius:'50%', background:meta.color, animation:'pulseSlow 1.2s ease-in-out infinite' }} />
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.12em', textTransform:'uppercase', color:meta.color, opacity:.8 }}>
          {meta.label} is thinking…
        </span>
      </div>
    </div>
  )
}

// ── Lattice (chat) Drawer ─────────────────────────────────────────────────────
function LatticeDrawer({ expanded, setExpanded, messages, chatInput, setChatInput, onSend, onKeyDown, thinking, aiLocked, autoAI, setAutoAI, onAskArchitect, onAskSpark, allProfiles, currentUserId, onPin, pinnedIds }) {
  const messagesEndRef = useRef(null)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, thinking])

  const height = expanded ? 400 : 44

  return (
    <div className="lattice-drawer" style={{ height }}>
      {/* Handle */}
      <div className="lattice-handle" onClick={() => setExpanded(v => !v)} data-hover>
        <div className="drawer-pill" />
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'.52rem', letterSpacing:'.18em', textTransform:'uppercase', color:'var(--mid)' }}>Lattice</span>
        {[AI.claude, AI.gpt].map(ai => (
          <span key={ai.role} style={{ padding:'.15rem .4rem', border:`1px solid ${ai.border}`, borderRadius:'2px', fontFamily:'var(--font-mono)', fontSize:'.44rem', letterSpacing:'.1em', textTransform:'uppercase', color:ai.color, background:ai.dim }}>
            {ai.label}
          </span>
        ))}
        <div style={{ flex:1 }} />
        <button
          onClick={e => { e.stopPropagation(); setAutoAI(v => !v) }}
          style={{ display:'flex', alignItems:'center', gap:'.3rem', padding:'.2rem .5rem', background:'transparent', border:`1px solid ${autoAI ? 'rgba(80,200,100,0.4)' : 'var(--border)'}`, borderRadius:'2px', color: autoAI ? 'var(--green)' : 'var(--muted)', fontFamily:'var(--font-mono)', fontSize:'.44rem', letterSpacing:'.1em', textTransform:'uppercase', transition:'all .2s' }}
        >
          <span style={{ width:5, height:5, borderRadius:'50%', background: autoAI ? 'var(--green)' : 'var(--muted)', animation: autoAI ? 'pulseSlow 2s ease-in-out infinite' : 'none' }} />
          Auto {autoAI ? 'ON' : 'OFF'}
        </button>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'.44rem', letterSpacing:'.1em', textTransform:'uppercase', color:'var(--green)' }}>◆ Live</span>
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0 }}>
          {/* Messages */}
          <div style={{ flex:1, overflowY:'auto', padding:'1rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
            {messages.length === 0 && (
              <div style={{ margin:'auto', textAlign:'center', opacity:.25 }}>
                <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1.4rem', color:'var(--muted)', fontStyle:'italic' }}>The Lattice awaits.</p>
                <p style={{ fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.15em', textTransform:'uppercase', color:'var(--muted)', marginTop:'.4rem' }}>The Architect & The Spark are listening</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <ChatMessage key={msg.id || i} msg={msg} allProfiles={allProfiles} currentUserId={currentUserId} onPin={onPin} isPinned={pinnedIds.has(msg.id)} />
            ))}
            {thinking && <ThinkingDot model={thinking} />}
            <div ref={messagesEndRef} />
          </div>

          {/* Manual AI buttons */}
          {!autoAI && (
            <div style={{ display:'flex', gap:'.5rem', padding:'.4rem 1rem 0', flexShrink:0 }}>
              {[{ fn: onAskArchitect, meta: AI.claude }, { fn: onAskSpark, meta: AI.gpt }].map(({ fn, meta }) => (
                <button key={meta.role} onClick={fn} disabled={aiLocked}
                  style={{ flex:1, padding:'.35rem', border:`1px solid ${meta.border}`, borderRadius:'2px', background: aiLocked ? 'transparent' : meta.dim, color: aiLocked ? 'var(--muted)' : meta.color, fontFamily:'var(--font-mono)', fontSize:'.48rem', letterSpacing:'.1em', textTransform:'uppercase', transition:'all .15s', opacity: aiLocked ? .4 : 1 }}>
                  Ask {meta.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ display:'flex', gap:'.5rem', padding:'.6rem 1rem', flexShrink:0, borderTop:'1px solid var(--border)' }}>
            <textarea
              value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={onKeyDown}
              placeholder={aiLocked ? 'AIs are responding…' : 'Message the Lattice…'}
              disabled={aiLocked}
              style={{ flex:1, background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)', borderRadius:'2px', color:'var(--text)', fontFamily:'var(--font-caveat)', fontSize:'1.1rem', lineHeight:1.4, padding:'.45rem .7rem', resize:'none', outline:'none', height:'2.6rem', maxHeight:'100px', opacity: aiLocked ? .5 : 1, transition:'border-color .2s' }}
              onFocus={e => e.target.style.borderColor = 'var(--ember-dim)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
              rows={1}
              onInput={e => { e.target.style.height = '2.6rem'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px' }}
            />
            <button className="vault-btn" onClick={onSend} disabled={aiLocked || !chatInput.trim()} style={{ padding:'.5rem 1rem', alignSelf:'flex-end' }}>
              {aiLocked ? '…' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const supabaseRef = useRef(null)
  function getSupabase() {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }

  // Auth
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [allProfiles, setAllProfiles] = useState([])
  const [onlineUsers, setOnlineUsers] = useState([])
  const [needsName, setNeedsName] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Notes
  const [notes, setNotes] = useState([])
  const [sharedNotes, setSharedNotes] = useState([])
  const [activeNote, setActiveNote] = useState(null)
  const [noteTitle, setNoteTitle] = useState('Untitled')
  const [noteContent, setNoteContent] = useState('')
  const [noteImages, setNoteImages] = useState([])
  const [isShared, setIsShared] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [notesSearch, setNotesSearch] = useState('')
  const [notesOpen, setNotesOpen] = useState(false)

  // Chat
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [thinking, setThinking] = useState(null)
  const [aiLocked, setAiLocked] = useState(false)
  const [autoAI, setAutoAI] = useState(true)
  const [chatExpanded, setChatExpanded] = useState(false)
  const [pinnedIds, setPinnedIds] = useState(new Set())
  const [pinToast, setPinToast] = useState(false)

  const historyRef = useRef([])
  const saveTimerRef = useRef(null)
  const contentRef = useRef(null)

  useEffect(() => { historyRef.current = messages }, [messages])

  // ── Auth + init ──
  useEffect(() => {
    let active = true, initialized = false

    async function init(u) {
      try {
        const sb = getSupabase()
        const [{ data: prof }, { data: profs }, { data: msgs }, { data: myNotes }, { data: sNotes }] = await Promise.all([
          sb.from('profiles').select('*').eq('id', u.id).single(),
          sb.from('profiles').select('*'),
          sb.from('messages').select('*').order('created_at', { ascending: true }).limit(100),
          sb.from('notes').select('*').eq('user_id', u.id).order('updated_at', { ascending: false }),
          sb.from('notes').select('id,title,content,user_id,is_shared,created_at,updated_at').eq('is_shared', true).neq('user_id', u.id).order('updated_at', { ascending: false }),
        ])
        if (!active) return

        setUser(u); setProfile(prof); setAllProfiles(profs || [])
        setMessages(msgs || []); setNotes(myNotes || []); setSharedNotes(sNotes || [])
        if (!prof?.display_name) setNeedsName(true)

        // Open most recent note
        if (myNotes && myNotes.length > 0) openNote(myNotes[0])

        setMounted(true)

        // Realtime messages
        sb.channel('messages-rt')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            setMessages(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
          })
          .subscribe()

        // Presence
        const pc = sb.channel('online-users', { config: { presence: { key: u.id } } })
        pc.on('presence', { event: 'sync' }, () => setOnlineUsers(Object.values(pc.presenceState()).flat()))
          .subscribe(async s => {
            if (s === 'SUBSCRIBED') await pc.track({ user_id: u.id, display_name: prof?.display_name || u.email, avatar_initial: prof?.avatar_initial || u.email?.[0]?.toUpperCase() })
          })
      } catch (err) {
        console.error('[Dashboard] init failed:', err)
      }
    }

    const { data: { subscription } } = getSupabase().auth.onAuthStateChange((event, session) => {
      if (!session) { window.location.href = '/vault/login'; return }
      if (initialized) return
      initialized = true
      init(session.user)
    })

    return () => { active = false; subscription.unsubscribe() }
  }, []) // eslint-disable-line

  // ── Autosave notes ──
  useEffect(() => {
    if (!user) return
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if (noteTitle || noteContent) autoSaveNote()
    }, 2500)
    return () => clearTimeout(saveTimerRef.current)
  }, [noteTitle, noteContent, noteImages, isShared]) // eslint-disable-line

  async function autoSaveNote() {
    setSaveStatus('saving')
    const sb = getSupabase()
    const imgStr = noteImages.map(i => `[img:${i.url}:${i.caption}]`).join('')
    const contentToSave = noteContent + (imgStr ? '\n' + imgStr : '')

    if (activeNote) {
      const { data } = await sb.from('notes').update({ title: noteTitle || 'Untitled', content: contentToSave, is_shared: isShared, updated_at: new Date().toISOString() }).eq('id', activeNote.id).select().single()
      if (data) { setActiveNote(data); setNotes(prev => prev.map(n => n.id === data.id ? data : n)) }
    } else {
      if (!noteTitle && !noteContent) { setSaveStatus(''); return }
      const { data } = await sb.from('notes').insert({ user_id: user.id, title: noteTitle || 'Untitled', content: contentToSave, is_shared: isShared }).select().single()
      if (data) { setActiveNote(data); setNotes(prev => [data, ...prev]) }
    }
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus(''), 2500)
  }

  function openNote(note) {
    setActiveNote(note)
    setNoteTitle(note.title || '')
    // Parse embedded images
    const IMG_RE = /\[img:(.*?):(.*?)\]/g
    const imgs = []
    let m
    const raw = note.content || ''
    while ((m = IMG_RE.exec(raw)) !== null) imgs.push({ id: Date.now() + Math.random(), url: m[1], caption: m[2], rotation: parseFloat((Math.random() * 4 - 2).toFixed(2)) })
    const text = raw.replace(IMG_RE, '').trim()
    setNoteContent(text)
    setNoteImages(imgs)
    setIsShared(note.is_shared || false)
  }

  function newNote() {
    setActiveNote(null); setNoteTitle('Untitled'); setNoteContent(''); setNoteImages([]); setIsShared(false)
  }

  // ── Save display name ──
  async function saveDisplayName(name, setLoading) {
    setLoading(true)
    const initial = name[0].toUpperCase()
    const sb = getSupabase()
    await sb.from('profiles').update({ display_name: name, avatar_initial: initial }).eq('id', user.id)
    setProfile(prev => ({ ...prev, display_name: name, avatar_initial: initial }))
    setAllProfiles(prev => prev.map(p => p.id === user.id ? { ...p, display_name: name, avatar_initial: initial } : p))
    setNeedsName(false); setLoading(false)
  }

  // ── Chat ──
  async function saveHumanMessage(content) {
    const tempId = `${Date.now()}-h`
    const optimistic = { id: tempId, user_id: user.id, display_name: profile?.display_name || user.email, avatar_initial: profile?.avatar_initial, content, role: 'human', created_at: new Date().toISOString() }
    setMessages(prev => prev.find(m => m.id === tempId) ? prev : [...prev, optimistic])
    const { data: saved } = await getSupabase().from('messages').insert({ user_id: user.id, display_name: optimistic.display_name, avatar_initial: optimistic.avatar_initial, content, role: 'human' }).select().single()
    const final = saved || optimistic
    setMessages(prev => prev.map(m => m.id === tempId ? final : m))
    return final
  }

  async function triggerAI(model, history) {
    const meta = AI[model]
    const tempId = `${Date.now()}-${model}`
    const placeholder = { id: tempId, role: model, display_name: meta.label, content: '', streaming: true, created_at: new Date().toISOString() }
    setMessages(prev => [...prev, placeholder])
    setThinking(model)

    let text = ''
    try {
      const res = await fetch(`/api/chat/${model}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history }) })
      if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Error' })); throw new Error(e.error || `HTTP ${res.status}`) }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += dec.decode(value, { stream: true })
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: text } : m))
      }
    } catch (err) {
      text = `[${meta.label} error: ${err.message}]`
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: text } : m))
    }

    setThinking(null)
    const { data: saved } = await getSupabase().from('messages').insert({ user_id: null, display_name: meta.label, content: text, role: model }).select().single()
    const final = saved || { ...placeholder, content: text, streaming: false }
    setMessages(prev => prev.map(m => m.id === tempId ? { ...final, streaming: false } : m))
    return final
  }

  async function handleSend() {
    if (!chatInput.trim() || aiLocked) return
    const content = chatInput.trim(); setChatInput('')
    await saveHumanMessage(content)
    if (!autoAI) return
    setAiLocked(true)
    await triggerAI('claude', [...historyRef.current])
    await triggerAI('gpt', [...historyRef.current])
    setAiLocked(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function pinMessage(msg) {
    const quote = `\n\n> ${msg.content}\n> — ${msg.display_name || 'Unknown'}, ${formatTime(msg.created_at)}\n`
    setNoteContent(prev => prev + quote)
    setPinnedIds(prev => new Set([...prev, msg.id]))
    setPinToast(true)
    setTimeout(() => setPinToast(false), 2200)
    // Persist pin to note
    if (activeNote) {
      const imgStr = noteImages.map(i => `[img:${i.url}:${i.caption}]`).join('')
      const newContent = noteContent + quote + (imgStr ? '\n' + imgStr : '')
      getSupabase().from('notes').update({ content: newContent, updated_at: new Date().toISOString() }).eq('id', activeNote.id)
    }
  }

  function handleImageClick() {
    const el = document.querySelector('input[accept="image/*"]')
    if (el) el.click()
  }

  if (!mounted) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <p className="panel-label animate-pulse-slow">Initializing…</p>
    </div>
  )

  const chatHeight = chatExpanded ? 400 : 44
  const filteredNotes = notes.filter(n => !notesSearch || (n.title || '').toLowerCase().includes(notesSearch.toLowerCase()) || (n.content || '').toLowerCase().includes(notesSearch.toLowerCase()))

  return (
    <div style={{ height:'100vh', overflow:'hidden', position:'relative' }}>
      {needsName && <DisplayNameModal onSave={saveDisplayName} />}

      {pinToast && <div className="pin-toast">📌 Pinned to note</div>}

      <TopBar
        noteTitle={noteTitle}
        notesCount={notes.length}
        onNotesToggle={() => setNotesOpen(v => !v)}
        onlineUsers={onlineUsers}
        allProfiles={allProfiles}
        profile={profile}
        user={user}
        onSignOut={async () => { await getSupabase().auth.signOut(); window.location.href = '/vault/login' }}
      />

      {notesOpen && <div className="drawer-overlay" onClick={() => setNotesOpen(false)} />}
      <NotesDrawer
        open={notesOpen}
        notes={filteredNotes}
        sharedNotes={sharedNotes}
        activeNoteId={activeNote?.id}
        onOpen={openNote}
        onNew={newNote}
        onClose={() => setNotesOpen(false)}
        search={notesSearch}
        setSearch={setNotesSearch}
      />

      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column' }}>
        <FullScreenEditor
          noteTitle={noteTitle} setNoteTitle={setNoteTitle}
          noteContent={noteContent} setNoteContent={setNoteContent}
          noteImages={noteImages} setNoteImages={setNoteImages}
          isShared={isShared} setIsShared={setIsShared}
          saveStatus={saveStatus} user={user}
          supabase={getSupabase()}
          chatHeight={chatHeight}
          contentRef={contentRef}
        />
      </div>

      <FloatingToolbar
        contentRef={contentRef}
        setNoteContent={setNoteContent}
        chatHeight={chatHeight}
        onImageClick={handleImageClick}
      />

      <VoiceFAB setNoteContent={setNoteContent} chatHeight={chatHeight} />

      <LatticeDrawer
        expanded={chatExpanded} setExpanded={setChatExpanded}
        messages={messages} chatInput={chatInput} setChatInput={setChatInput}
        onSend={handleSend} onKeyDown={handleKeyDown}
        thinking={thinking} aiLocked={aiLocked}
        autoAI={autoAI} setAutoAI={setAutoAI}
        onAskArchitect={async () => { setAiLocked(true); await triggerAI('claude', [...historyRef.current]); setAiLocked(false) }}
        onAskSpark={async () => { setAiLocked(true); await triggerAI('gpt', [...historyRef.current]); setAiLocked(false) }}
        allProfiles={allProfiles} currentUserId={user?.id}
        onPin={pinMessage} pinnedIds={pinnedIds}
      />
    </div>
  )
}
