'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { createEnclave, getUserEnclaves, inviteMember, removeMember, deleteEnclave } from '@/lib/enclaves'
import { pinLatticeMsgToBoard } from '@/lib/stickies'
import {
  AvatarArchitect,
  AvatarSpark,
  AvatarSmara,
  AvatarYou,
  AvatarSocra,
  AvatarGeneric,
} from '@/components/Avatars'
import WelcomeModal from '@/components/WelcomeModal'

// ── Base path for API routes ───────────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/vault'

// ── AI config ──────────────────────────────────────────────────────────────────
const AI = {
  claude: {
    label: 'The Architect', role: 'claude',
    color: '#d4541a', dim: 'rgba(212,84,26,0.12)', border: 'rgba(212,84,26,0.4)',
    textColor: 'rgba(255,220,200,0.88)',
    thinkingLabel: 'constructing a framework…',
  },
  gpt: {
    label: 'The Spark', role: 'gpt',
    color: '#c8973a', dim: 'rgba(200,151,58,0.12)', border: 'rgba(200,151,58,0.4)',
    textColor: 'rgba(255,240,180,0.88)',
    thinkingLabel: 'making a leap…',
  },
}

// ── Reminder regex ─────────────────────────────────────────────────────────────
const REMINDER_RE = /\b(remind(?:er|s)?(?:\s+me)?|remember\s+to|don'?t\s+forget|follow[\s-]?up(?:\s+(?:on|with))?|check\s+back|revisit|by\s+(?:eod|end\s+of\s+(?:day|week)|tomorrow|(?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|week|month))|deadline[:\s]|due\s+(?:date[:\s]|by[:\s]|on[:\s]|\d+)|in\s+\d+\s+(?:days?|weeks?|months?|hours?)|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|next\s+(?:monday|tuesday|wednesday|thursday|friday|week|month)|this\s+(?:friday|monday|tuesday|wednesday|thursday))\b/gi

// ── Contrast words for disagreement detection ─────────────────────────────────
const CONTRAST_RE = /\b(actually|however|but\s+i|disagree|rather|on\s+the\s+other|in\s+contrast|yet\s+i|i'd\s+argue|contrary|wait[,—]|hold\s+on|not\s+quite|i\s+see\s+it\s+differently)\b/i

// ── Spark provocations (auto-fire after 10 min idle) ─────────────────────────
const PROVOCATIONS = [
  "Nothing for a while. What are we actually trying to solve here?",
  "Long silence. Either deep thought or the draft got away from you. Which is it?",
  "I have a question. What happens if none of this works?",
  "Still here. The Architect and I have been having a quiet debate. Want in?",
]

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
function isSmara(profile) {
  if (!profile) return false
  return (profile.display_name || profile.email || '').toLowerCase().includes('smara')
}
function noteVisibilityFromRecord(note) {
  return note.visibility || (note.is_shared ? 'enclave' : 'private')
}
function getAvatar(profile, isCurrentUser, size = 30, yourState = 'idle') {
  if (isCurrentUser) return <AvatarYou size={size} state={yourState} />
  if (isSmara(profile)) return <AvatarSmara size={size} />
  return <AvatarGeneric initial={(profile?.display_name || profile?.email || '?')[0]?.toUpperCase()} size={size} />
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

// ── Reminder Card ─────────────────────────────────────────────────────────────
function ReminderCard({ phrase, noteTitle, onSave, onDismiss }) {
  const [date, setDate] = useState('')
  const [notifyAll, setNotifyAll] = useState(false)
  const [saving, setSaving] = useState(false)
  return (
    <div style={{ position:'fixed', inset:0, zIndex:9000, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:'380px', background:'rgba(11,10,8,0.97)', border:'1px solid rgba(212,84,26,0.35)', borderRadius:'4px', padding:'1.5rem' }}>
        <p className="panel-label" style={{ marginBottom:'.4rem' }}>Reminder detected</p>
        <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1.4rem', color:'var(--text)', marginBottom:'1.25rem', lineHeight:1.3 }}>
          "<span style={{ color:'var(--ember)' }}>{phrase}</span>"
        </p>
        {noteTitle && <p style={{ fontFamily:'var(--font-mono)', fontSize:'.46rem', letterSpacing:'.1em', color:'var(--muted)', marginBottom:'1rem', textTransform:'uppercase' }}>In: {noteTitle}</p>}
        <div style={{ display:'flex', flexDirection:'column', gap:'.85rem' }}>
          <div>
            <label style={{ display:'block', fontFamily:'var(--font-mono)', fontSize:'.46rem', letterSpacing:'.14em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'.4rem' }}>When (optional)</label>
            <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} className="vault-input w-full" style={{ fontSize:'.8rem' }} />
          </div>
          <div style={{ display:'flex', gap:'.5rem' }}>
            {[{ v: false, label: 'Just me' }, { v: true, label: 'Whole team' }].map(opt => (
              <button key={String(opt.v)} onClick={() => setNotifyAll(opt.v)}
                style={{ flex:1, padding:'.5rem', border:`1px solid ${notifyAll === opt.v ? 'var(--ember)' : 'var(--border)'}`, borderRadius:'2px', background: notifyAll === opt.v ? 'var(--ember-glow)' : 'transparent', color: notifyAll === opt.v ? 'var(--ember)' : 'var(--muted)', fontFamily:'var(--font-mono)', fontSize:'.48rem', letterSpacing:'.1em', textTransform:'uppercase', transition:'all .15s' }}>
                {opt.label}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', gap:'.5rem' }}>
            <button onClick={onDismiss} className="vault-btn-ghost" style={{ flex:1, padding:'.6rem', fontSize:'.5rem' }}>Dismiss</button>
            <button onClick={async () => { setSaving(true); await onSave(phrase, date || null, notifyAll); setSaving(false) }}
              disabled={saving} className="vault-btn" style={{ flex:2, padding:'.6rem', fontSize:'.5rem' }}>
              {saving ? 'Saving…' : 'Set Reminder →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Reminder Notifications ────────────────────────────────────────────────────
function ReminderNotifications({ notifs, onGoTo, onDismiss }) {
  if (!notifs.length) return null
  return (
    <div style={{ position:'fixed', top:'3.5rem', right:'1rem', zIndex:8500, display:'flex', flexDirection:'column', gap:'.5rem', maxWidth:'300px' }}>
      {notifs.map(r => (
        <div key={r.id} style={{ background:'rgba(11,10,8,0.96)', border:'1px solid rgba(212,84,26,0.45)', borderRadius:'4px', padding:'.85rem', boxShadow:'0 4px 24px rgba(0,0,0,0.5)' }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:'.5rem', marginBottom:'.5rem' }}>
            <span style={{ fontSize:'1rem', flexShrink:0 }}>⏰</span>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1rem', color:'var(--text)', lineHeight:1.3, marginBottom:'.2rem' }}>{r.phrase}</p>
              {r.note_title && <p style={{ fontFamily:'var(--font-mono)', fontSize:'.44rem', letterSpacing:'.08em', color:'var(--muted)', textTransform:'uppercase' }}>{r.note_title}</p>}
            </div>
          </div>
          <div style={{ display:'flex', gap:'.4rem' }}>
            {r.note_id && <button onClick={() => onGoTo(r)} className="vault-btn-ghost" style={{ flex:1, padding:'.3rem', fontSize:'.48rem' }}>Go to note</button>}
            <button onClick={() => onDismiss(r.id)} style={{ flex:1, padding:'.3rem', background:'transparent', border:'1px solid rgba(212,84,26,0.25)', borderRadius:'2px', color:'rgba(212,84,26,0.7)', fontFamily:'var(--font-mono)', fontSize:'.48rem', letterSpacing:'.1em', textTransform:'uppercase', transition:'all .15s' }}>Dismiss</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Visibility Confirm ────────────────────────────────────────────────────────
function VisibilityConfirmModal({ enclaveName, onConfirm, onCancel }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:8500, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:'360px', background:'rgba(11,10,8,0.97)', border:'1px solid rgba(58,212,200,0.3)', borderRadius:'4px', padding:'1.5rem' }}>
        <p className="panel-label" style={{ marginBottom:'.4rem', color:'var(--cyan)' }}>Share with enclave?</p>
        <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1.3rem', color:'var(--text)', lineHeight:1.4, marginBottom:'1.25rem' }}>
          This note will enter <span style={{ color:'var(--cyan)' }}>{enclaveName || 'shared'} memory</span> — The Architect and The Spark will have full context.
        </p>
        <div style={{ display:'flex', gap:'.5rem' }}>
          <button onClick={onCancel} className="vault-btn-ghost" style={{ flex:1, padding:'.6rem', fontSize:'.5rem' }}>Keep private</button>
          <button onClick={onConfirm} className="vault-btn" style={{ flex:1, padding:'.6rem', fontSize:'.5rem', borderColor:'var(--cyan)', color:'var(--cyan)' }}>Share with enclave →</button>
        </div>
      </div>
    </div>
  )
}

// ── Enclave Switcher ──────────────────────────────────────────────────────────
function EnclaveSwitcher({ enclaves, activeEnclaveId, onSwitch, onCreateNew, onSettings }) {
  const [open, setOpen] = useState(false)
  const active = enclaves.find(e => e.id === activeEnclaveId)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDoc(e) { if (!e.target.closest('[data-enclave-switcher]')) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div style={{ position:'relative' }} data-enclave-switcher>
      <button onClick={() => setOpen(v => !v)}
        style={{ display:'flex', alignItems:'center', gap:'.4rem',
          background: activeEnclaveId ? 'rgba(58,212,200,0.06)' : 'transparent',
          border:`1px solid ${activeEnclaveId ? 'rgba(58,212,200,0.35)' : 'var(--border)'}`,
          borderRadius:'4px', padding:'.3rem .75rem',
          color: activeEnclaveId ? 'var(--cyan)' : 'var(--muted)',
          fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.12em',
          textTransform:'uppercase', transition:'all .2s', minWidth:'90px', justifyContent:'space-between' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = activeEnclaveId ? 'rgba(58,212,200,0.6)' : 'var(--border-h)'; e.currentTarget.style.color = activeEnclaveId ? 'var(--cyan)' : 'var(--text)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = activeEnclaveId ? 'rgba(58,212,200,0.35)' : 'var(--border)'; e.currentTarget.style.color = activeEnclaveId ? 'var(--cyan)' : 'var(--muted)' }}>
        <span style={{ display:'flex', alignItems:'center', gap:'.35rem' }}>
          {activeEnclaveId
            ? <span style={{ fontSize:'.6rem', lineHeight:1 }}>◆</span>
            : <span style={{ width:5, height:5, borderRadius:'50%', background:'var(--muted)', flexShrink:0 }} />
          }
          {active?.name || 'Personal'}
        </span>
        <span style={{ fontSize:'.44rem', opacity:.45, marginLeft:'.2rem' }}>▾</span>
      </button>

      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:4000,
          background:'rgba(11,10,8,0.98)', border:'1px solid var(--border)',
          borderRadius:'4px', minWidth:'200px', overflow:'hidden',
          boxShadow:'0 8px 40px rgba(0,0,0,0.7)', backdropFilter:'blur(20px)' }}>

          {/* Personal */}
          <button onClick={() => { onSwitch(null); setOpen(false) }}
            style={{ width:'100%', padding:'.55rem .85rem', background:'transparent',
              color: !activeEnclaveId ? 'var(--text)' : 'var(--muted)',
              fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.1em',
              textTransform:'uppercase', textAlign:'left', display:'flex', alignItems:'center',
              justifyContent:'space-between', borderBottom:'1px solid var(--border)', transition:'all .15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <span style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
              <span style={{ width:5, height:5, borderRadius:'50%', background: !activeEnclaveId ? 'var(--text)' : 'var(--muted)' }} />
              Personal
            </span>
            {!activeEnclaveId && <span style={{ color:'var(--ember)', fontSize:'.6rem' }}>✓</span>}
          </button>

          {/* Enclave list */}
          {enclaves.map(e => (
            <button key={e.id} onClick={() => { onSwitch(e.id); setOpen(false) }}
              style={{ width:'100%', padding:'.55rem .85rem',
                background: activeEnclaveId === e.id ? 'rgba(58,212,200,0.06)' : 'transparent',
                color: activeEnclaveId === e.id ? 'var(--cyan)' : 'var(--muted)',
                fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.1em',
                textTransform:'uppercase', textAlign:'left', display:'flex',
                alignItems:'center', justifyContent:'space-between', transition:'all .15s' }}
              onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(58,212,200,0.04)'}
              onMouseLeave={ev => ev.currentTarget.style.background = activeEnclaveId === e.id ? 'rgba(58,212,200,0.06)' : 'transparent'}>
              <span style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
                <span style={{ fontSize:'.55rem', color: activeEnclaveId === e.id ? 'var(--cyan)' : 'var(--muted)' }}>◆</span>
                {e.name}
              </span>
              <span style={{ display:'flex', alignItems:'center', gap:'.4rem' }}>
                {activeEnclaveId === e.id && <span style={{ color:'var(--ember)', fontSize:'.6rem' }}>✓</span>}
                <span onClick={ev => { ev.stopPropagation(); setOpen(false); onSettings() }}
                  title="Manage enclave"
                  style={{ fontSize:'.6rem', opacity:.4, transition:'opacity .15s' }}
                  onMouseEnter={ev => ev.currentTarget.style.opacity = '1'}
                  onMouseLeave={ev => ev.currentTarget.style.opacity = '.4'}>⚙</span>
              </span>
            </button>
          ))}

          {/* Divider + actions */}
          <div style={{ borderTop:'1px solid var(--border)' }}>
            <button onClick={() => { setOpen(false); onCreateNew() }}
              style={{ width:'100%', padding:'.55rem .85rem', background:'transparent',
                color:'var(--ember)', fontFamily:'var(--font-mono)', fontSize:'.5rem',
                letterSpacing:'.1em', textTransform:'uppercase', textAlign:'left',
                display:'flex', alignItems:'center', gap:'.4rem', transition:'all .15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--ember-glow)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              + Create Enclave
            </button>
            {enclaves.length > 0 && (
              <button onClick={() => { setOpen(false); onSettings() }}
                style={{ width:'100%', padding:'.55rem .85rem', background:'transparent',
                  color:'var(--muted)', fontFamily:'var(--font-mono)', fontSize:'.5rem',
                  letterSpacing:'.1em', textTransform:'uppercase', textAlign:'left',
                  display:'flex', alignItems:'center', gap:'.4rem', borderTop:'1px solid var(--border)', transition:'all .15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                ⚙ Manage Enclaves
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Create Enclave Modal ──────────────────────────────────────────────────────
function CreateEnclaveModal({ onCreate, onClose }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  return (
    <div style={{ position:'fixed', inset:0, zIndex:8000, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:'380px', background:'rgba(11,10,8,0.97)', border:'1px solid rgba(58,212,200,0.2)', borderRadius:'4px', padding:'2rem' }}>
        <p className="panel-label" style={{ marginBottom:'.5rem', color:'var(--cyan)' }}>New Enclave</p>
        <h2 style={{ fontFamily:'var(--font-caveat)', fontSize:'2rem', color:'var(--text)', fontWeight:600, marginBottom:'1.25rem', lineHeight:1 }}>
          Name your <span style={{ color:'var(--cyan)', fontStyle:'italic' }}>group</span>
        </h2>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && !loading && onCreate(name.trim(), setLoading)}
          placeholder="e.g. Core Team" autoFocus maxLength={48}
          className="vault-input w-full" style={{ marginBottom:'1rem' }} />
        <div style={{ display:'flex', gap:'.5rem' }}>
          <button onClick={onClose} className="vault-btn-ghost" style={{ flex:1, padding:'.6rem', fontSize:'.5rem' }}>Cancel</button>
          <button onClick={() => name.trim() && onCreate(name.trim(), setLoading)}
            disabled={!name.trim() || loading} className="vault-btn"
            style={{ flex:2, padding:'.6rem', fontSize:'.5rem', borderColor:'var(--cyan)', color:'var(--cyan)' }}>
            {loading ? 'Creating…' : 'Create Enclave →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Enclave Settings Panel ────────────────────────────────────────────────────
function EnclaveSettingsPanel({ enclave, members, onInvite, onRemove, onDelete, onClose }) {
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  return (
    <div style={{ position:'fixed', inset:0, zIndex:8000, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:'420px', background:'rgba(11,10,8,0.97)', border:'1px solid rgba(58,212,200,0.2)', borderRadius:'4px', padding:'2rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.5rem' }}>
          <div>
            <p className="panel-label" style={{ marginBottom:'.25rem', color:'var(--cyan)' }}>Enclave</p>
            <h2 style={{ fontFamily:'var(--font-caveat)', fontSize:'1.8rem', color:'var(--text)', fontWeight:600, lineHeight:1 }}>{enclave.name}</h2>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:'1.2rem', padding:'.25rem', lineHeight:1 }}>×</button>
        </div>
        <p className="panel-label" style={{ marginBottom:'.6rem' }}>Members</p>
        <div style={{ display:'flex', flexDirection:'column', gap:'.35rem', marginBottom:'1.25rem' }}>
          {members.map(m => (
            <div key={m.profiles?.id || m.user_id}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'.4rem .6rem', background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)', borderRadius:'2px' }}>
              <div>
                <span style={{ fontFamily:'var(--font-caveat)', fontSize:'1rem', color:'var(--text)' }}>
                  {m.profiles?.display_name || m.profiles?.email || 'Unknown'}
                </span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:'.44rem', letterSpacing:'.1em', textTransform:'uppercase', color: m.role === 'owner' ? 'var(--ember)' : 'var(--muted)', marginLeft:'.5rem' }}>{m.role}</span>
              </div>
              {m.role !== 'owner' && (
                <button onClick={() => onRemove(m.profiles?.id)}
                  style={{ background:'none', border:'none', color:'var(--muted)', fontSize:'.85rem', padding:'0 .2rem', lineHeight:1, transition:'color .15s' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--ember)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}>×</button>
              )}
            </div>
          ))}
        </div>
        <p className="panel-label" style={{ marginBottom:'.4rem' }}>Invite by email</p>
        <div style={{ display:'flex', gap:'.5rem', marginBottom:'.5rem' }}>
          <input type="email" value={inviteEmail}
            onChange={e => { setInviteEmail(e.target.value); setInviteError('') }}
            placeholder="teammate@studio.com" className="vault-input"
            style={{ flex:1, fontSize:'.75rem' }} />
          <button onClick={async () => {
            setInviting(true)
            const r = await onInvite(inviteEmail)
            if (r?.error) setInviteError(r.error)
            else setInviteEmail('')
            setInviting(false)
          }} disabled={!inviteEmail.trim() || inviting} className="vault-btn"
            style={{ padding:'.5rem .9rem', fontSize:'.48rem', borderColor:'var(--cyan)', color:'var(--cyan)' }}>
            {inviting ? '…' : 'Invite'}
          </button>
        </div>
        {inviteError && <p style={{ fontFamily:'var(--font-mono)', fontSize:'.48rem', color:'var(--ember)', marginBottom:'.75rem' }}>{inviteError}</p>}
        <div style={{ borderTop:'1px solid var(--border)', paddingTop:'.75rem', marginTop:'.25rem' }}>
          <button onClick={onDelete}
            style={{ background:'none', border:'none', color:'rgba(212,84,26,0.4)', fontFamily:'var(--font-mono)', fontSize:'.46rem', letterSpacing:'.1em', textTransform:'uppercase', transition:'color .15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--ember)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(212,84,26,0.4)'}>
            Delete enclave
          </button>
        </div>
      </div>
    </div>
  )
}

// ── TopBar ────────────────────────────────────────────────────────────────────
function TopBar({ noteTitle, notesCount, onNotesToggle, onlineUsers, allProfiles, profile, user, onSignOut, yourState, architectState, sparkState, enclaves, activeEnclaveId, onEnclaveSwitch, onCreateEnclave, onEnclaveSettings, boardCount }) {
  return (
    <div className="topbar">
      <div style={{ display:'flex', alignItems:'center', gap:'.65rem' }}>
        <div className="ember-pip" />
        <span style={{ fontFamily:'var(--font-serif)', fontSize:'1.1rem', fontWeight:300, fontStyle:'italic', color:'var(--text)' }}>
          The <em style={{ color:'var(--ember)' }}>Vault</em>
        </span>
      </div>

      <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', maxWidth:'300px' }}>
        <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1rem', color:'var(--muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', textAlign:'center' }}>
          {noteTitle || 'Untitled'}
        </p>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:'.6rem' }}>
        <EnclaveSwitcher enclaves={enclaves} activeEnclaveId={activeEnclaveId}
          onSwitch={onEnclaveSwitch} onCreateNew={onCreateEnclave} onSettings={onEnclaveSettings} />
        <button onClick={onNotesToggle} data-hover
          style={{ display:'flex', alignItems:'center', gap:'.4rem', background:'transparent', border:'1px solid var(--border)', borderRadius:'4px', padding:'.3rem .65rem', color:'var(--muted)', fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.12em', textTransform:'uppercase', transition:'all .2s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-h)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
          Notes
          {notesCount > 0 && <span style={{ background:'var(--ember)', color:'#0b0a08', borderRadius:'3px', padding:'0 .3rem', fontSize:'.48rem', fontWeight:700 }}>{notesCount}</span>}
        </button>
        <button onClick={() => { window.location.href = '/vault/board' }} data-hover
          style={{ display:'flex', alignItems:'center', gap:'.4rem', background:'transparent', border:'1px solid var(--border)', borderRadius:'4px', padding:'.3rem .65rem', color:'var(--muted)', fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.12em', textTransform:'uppercase', transition:'all .2s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-h)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
          Board
          {boardCount > 0 && <span style={{ background:'rgba(212,84,26,0.2)', color:'var(--ember)', borderRadius:'3px', padding:'0 .3rem', fontSize:'.48rem', fontWeight:700 }}>{boardCount}</span>}
        </button>

        {/* AI presence — always visible */}
        <div style={{ display:'flex', alignItems:'center', gap:3, padding:'0 .25rem', borderLeft:'1px solid var(--border)', borderRight:'1px solid var(--border)', marginLeft:2, marginRight:2 }}>
          <AvatarArchitect size={26} state={architectState} />
          <AvatarSpark size={26} state={sparkState} />
        </div>

        {/* Human presence */}
        <div style={{ display:'flex', alignItems:'center' }}>
          {onlineUsers.slice(0, 4).map((u, i) => {
            const prof = allProfiles.find(p => p.id === u.user_id)
            const isMe = prof?.id === user?.id
            return (
              <div key={u.user_id || i} style={{ marginLeft: i > 0 ? '-6px' : 0, zIndex: 10 - i }}>
                {getAvatar(prof, isMe, 26, isMe ? yourState : 'idle')}
              </div>
            )
          })}
        </div>

        <button className="vault-btn-ghost" onClick={onSignOut} style={{ padding:'.3rem .6rem', fontSize:'.48rem' }}>Out</button>
      </div>
    </div>
  )
}

// ── Notes Drawer ──────────────────────────────────────────────────────────────
function NoteRow({ note, active, onOpen }) {
  const vis = noteVisibilityFromRecord(note)
  const isEnclave = vis === 'enclave' || vis === 'public'
  return (
    <div onClick={onOpen} data-hover
      style={{ padding:'.6rem .65rem', borderRadius:'2px', cursor:'none', borderLeft: active ? '2px solid var(--ember)' : '2px solid transparent', background: active ? 'rgba(212,84,26,0.05)' : 'transparent', transition:'all .15s', marginBottom:'1px' }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'.4rem', marginBottom:'.2rem' }}>
        <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1.05rem', color: active ? 'var(--text)' : 'var(--mid)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{note.title || 'Untitled'}</p>
        {isEnclave && (
          <span style={{ fontFamily:'var(--font-mono)', fontSize:'.42rem', letterSpacing:'.06em', color:'var(--cyan)', flexShrink:0, display:'flex', alignItems:'center', gap:'.2rem' }}>
            <span style={{ fontSize:'.5rem' }}>◆</span>
            {vis}
          </span>
        )}
      </div>
      <p style={{ fontFamily:'var(--font-caveat)', fontSize:'.9rem', color:'var(--muted)', lineHeight:1.3, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical' }}>
        {(note.content || '').replace(/\[img:[^\]]*\]/g, '').trim() || 'Empty'}
      </p>
      <p className="msg-timestamp" style={{ marginTop:'.2rem' }}>{new Date(note.updated_at).toLocaleDateString([], { month:'short', day:'numeric' })}</p>
    </div>
  )
}

function NotesDrawer({ open, notes, sharedNotes, enclaveNotes, activeEnclave, activeNoteId, reminders, onOpen, onNew, onClose, search, setSearch }) {
  return (
    <div className={`notes-drawer${open ? ' open' : ''}`}>
      <div style={{ padding:'.85rem 1rem', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <h2 style={{ fontFamily:'var(--font-caveat)', fontSize:'1.8rem', color:'var(--text)', fontWeight:600, marginBottom:'.6rem', lineHeight:1 }}>notes</h2>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="vault-input w-full" style={{ fontSize:'.75rem', padding:'.4rem .7rem' }} />
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'.4rem' }}>
        {notes.length === 0 && !search && (
          <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1.1rem', color:'var(--mid)', textAlign:'center', padding:'2rem .5rem', fontStyle:'italic' }}>No notes yet. Create one.</p>
        )}
        {notes.length > 0 && (
          <>
            <p className="panel-label" style={{ padding:'.5rem .5rem .25rem', opacity:.7 }}>{activeEnclave ? 'Personal' : 'Mine'}</p>
            {notes.map(note => <NoteRow key={note.id} note={note} active={note.id === activeNoteId} onOpen={() => { onOpen(note); onClose() }} />)}
          </>
        )}
        {activeEnclave && (
          <>
            <p className="panel-label" style={{ padding:'.75rem .5rem .25rem', opacity:.7, color:'var(--cyan)' }}>◆ {activeEnclave.name}</p>
            {enclaveNotes.length === 0 ? (
              <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1rem', color:'var(--muted)', textAlign:'center', padding:'1.25rem .5rem', fontStyle:'italic', lineHeight:1.4 }}>
                No notes in {activeEnclave.name} yet.<br />
                Notes you share to this enclave will appear here.
              </p>
            ) : (
              enclaveNotes.map(note => <NoteRow key={note.id} note={note} active={note.id === activeNoteId} onOpen={() => { onOpen(note); onClose() }} />)
            )}
          </>
        )}
        {!activeEnclave && sharedNotes.length > 0 && (
          <>
            <p className="panel-label" style={{ padding:'.75rem .5rem .25rem', opacity:.7 }}>Shared with me</p>
            {sharedNotes.map(note => <NoteRow key={note.id} note={note} active={note.id === activeNoteId} onOpen={() => { onOpen(note); onClose() }} />)}
          </>
        )}
        {reminders.length > 0 && (
          <>
            <p className="panel-label" style={{ padding:'.75rem .5rem .25rem', opacity:.7 }}>Reminders</p>
            {reminders.map(r => (
              <div key={r.id} style={{ padding:'.5rem .65rem', borderRadius:'2px', marginBottom:'1px', borderLeft:'2px solid rgba(212,84,26,0.3)' }}>
                <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1rem', color:'var(--mid)', lineHeight:1.3 }}>{r.phrase}</p>
                {r.reminder_date && <p className="msg-timestamp">{new Date(r.reminder_date).toLocaleDateString([], { month:'short', day:'numeric' })}</p>}
              </div>
            ))}
          </>
        )}
      </div>
      <div style={{ padding:'.75rem', borderTop:'1px solid var(--border)', flexShrink:0 }}>
        <button onClick={() => { onNew(); onClose() }} data-hover
          style={{ width:'100%', padding:'.65rem', background:'transparent', border:'1px dashed var(--ember)', borderRadius:'3px', color:'var(--ember)', fontFamily:'var(--font-caveat)', fontSize:'1.1rem', transition:'all .2s var(--ease)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--ember-glow)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          + new note
        </button>
      </div>
    </div>
  )
}

// ── Scrapbook Image ────────────────────────────────────────────────────────────
function ScrapbookImage({ img, onCaption, onRemove }) {
  return (
    <div className="scrapbook-wrap" style={{ transform:`rotate(${img.rotation}deg)`, margin:'1rem 0' }}>
      <div className="tape-strip" />
      <img src={img.url} alt={img.caption} className="scrapbook-img" />
      <input className="scrapbook-caption" value={img.caption} onChange={e => onCaption(e.target.value)} placeholder="caption…" />
      {onRemove && <button onClick={onRemove} style={{ position:'absolute', top:4, right:4, background:'rgba(0,0,0,0.6)', border:'none', color:'rgba(255,255,255,0.6)', borderRadius:'2px', fontSize:'.7rem', padding:'1px 4px', lineHeight:1 }}>×</button>}
    </div>
  )
}

// ── Full Screen Editor ─────────────────────────────────────────────────────────
function FullScreenEditor({ noteTitle, setNoteTitle, noteContent, setNoteContent, noteImages, setNoteImages, noteVisibility, onVisibilityToggle, saveStatus, user, supabase, chatHeight, contentRef, detectedReminders, onReminderClick, onImageUploaded, activeEnclave }) {
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)
  const isEnclave = noteVisibility === 'enclave'

  async function uploadImage(file) {
    if (!file || !file.type.startsWith('image/')) return
    const path = `${user.id}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('vault-images').upload(path, file, { upsert: false })
    if (error) { console.error('[image upload]', error); return }
    const { data: urlData } = supabase.storage.from('vault-images').getPublicUrl(path)
    const rotation = parseFloat((Math.random() * 4 - 2).toFixed(2))
    setNoteImages(prev => [...prev, { id: Date.now(), url: urlData.publicUrl, caption: '', rotation }])
    onImageUploaded?.(file.name)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) uploadImage(f) }}
      style={{ position:'relative', flex:1, display:'flex', flexDirection:'column', alignItems:'center', paddingTop:'44px', paddingBottom: chatHeight + 64 + 'px', overflow:'hidden' }}
    >
      {/* Ghost watermark */}
      <div style={{ position:'absolute', top:'15%', left:'50%', transform:'translateX(-50%)', fontSize:'22vw', fontFamily:'var(--font-serif)', fontWeight:300, fontStyle:'italic', color:'var(--ember)', opacity:.042, pointerEvents:'none', userSelect:'none', zIndex:0 }}>
        {(noteTitle || 'N')[0].toUpperCase()}
      </div>

      {/* Visibility annotation */}
      <div style={{ position:'absolute', left:'calc(50% - 420px)', top:'120px', transform:'rotate(-2.5deg)', pointerEvents:'none', zIndex:1, opacity:.35 }}>
        <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1rem', color: isEnclave ? 'var(--cyan)' : 'var(--ember)', fontStyle:'italic', borderLeft:`2px solid ${isEnclave ? 'var(--cyan)' : 'var(--ember)'}`, paddingLeft:'.5rem' }}>
          {isEnclave ? `— ${activeEnclave?.name || 'enclave'} memory` : '— private draft'}
        </p>
      </div>

      {dragOver && (
        <div style={{ position:'absolute', inset:0, zIndex:50, border:'2px dashed var(--ember)', borderRadius:'4px', background:'rgba(212,84,26,0.04)', display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
          <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1.6rem', color:'var(--ember)' }}>Drop image into your note ✦</p>
        </div>
      )}

      <div style={{ position:'relative', zIndex:2, width:'100%', maxWidth:'740px', padding:'2.5rem 2rem 1rem', display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
        {/* Controls row */}
        <div style={{ display:'flex', alignItems:'center', gap:'.65rem', marginBottom:'1.5rem', flexShrink:0 }}>
          {activeEnclave ? (
            <button onClick={onVisibilityToggle} data-hover
              style={{ display:'flex', alignItems:'center', gap:'.4rem', padding:'.3rem .75rem', background:'transparent', border:`1px solid ${isEnclave ? 'rgba(58,212,200,0.4)' : 'var(--border)'}`, borderRadius:'20px', color: isEnclave ? 'var(--cyan)' : 'var(--muted)', fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.1em', textTransform:'uppercase', transition:'all .2s' }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background: isEnclave ? 'var(--cyan)' : 'var(--muted)', animation: isEnclave ? 'pulseSlow 2s ease-in-out infinite' : 'none' }} />
              {isEnclave ? `◆ ${activeEnclave.name}` : '🔒 Private'}
            </button>
          ) : (
            <span style={{ display:'flex', alignItems:'center', gap:'.4rem', padding:'.3rem .75rem', border:'1px solid var(--border)', borderRadius:'20px', color:'var(--muted)', fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.1em', textTransform:'uppercase', opacity:.5 }}>
              🔒 Private
            </span>
          )}

          {detectedReminders.length > 0 && (
            <button onClick={() => onReminderClick(detectedReminders[0])} data-hover
              style={{ display:'flex', alignItems:'center', gap:'.35rem', padding:'.3rem .65rem', background:'var(--ember-glow)', border:'1px solid rgba(212,84,26,0.35)', borderRadius:'20px', color:'var(--ember)', fontFamily:'var(--font-mono)', fontSize:'.46rem', letterSpacing:'.1em', textTransform:'uppercase', transition:'all .2s' }}>
              ⏰ {detectedReminders.length} reminder{detectedReminders.length > 1 ? 's' : ''}
            </button>
          )}

          <span style={{ flex:1 }} />
          {saveStatus && (
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'.48rem', letterSpacing:'.1em', color: saveStatus === 'saving' ? 'var(--muted)' : 'var(--green)', display:'flex', alignItems:'center', gap:'.3rem' }}>
              <span style={{ width:5, height:5, borderRadius:'50%', background: saveStatus === 'saving' ? 'var(--muted)' : 'var(--green)', animation: saveStatus === 'saving' ? 'pulseSlow 1s ease-in-out infinite' : 'none' }} />
              {saveStatus === 'saving' ? 'Saving…' : 'Saved just now'}
            </span>
          )}
        </div>

        {/* Title */}
        <textarea value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="Note title…" rows={1}
          style={{ background:'transparent', border:'none', outline:'none', resize:'none', width:'100%', fontFamily:'var(--font-caveat)', fontSize:'clamp(2rem,5vw,3.2rem)', fontWeight:700, color:'var(--text)', lineHeight:1.1, padding:0, marginBottom:'1.5rem', flexShrink:0, overflow:'hidden' }}
          onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }} />

        {/* Body */}
        <textarea ref={contentRef} value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Start writing…" className="ruled-editor"
          style={{ flex:1, backgroundColor:'transparent', border:'none', outline:'none', resize:'none', width:'100%', fontFamily:'var(--font-caveat)', fontSize:'1.25rem', color:'var(--text)', lineHeight:'2.3rem', padding:0, minHeight:'200px' }} />

        {/* Scrapbook images */}
        {noteImages.length > 0 && (
          <div style={{ marginTop:'1rem', display:'flex', flexWrap:'wrap', gap:'1rem' }}>
            {noteImages.map((img, i) => (
              <ScrapbookImage key={img.id} img={img}
                onCaption={v => setNoteImages(prev => prev.map((x, j) => j === i ? { ...x, caption: v } : x))}
                onRemove={() => setNoteImages(prev => prev.filter((_, j) => j !== i))} />
            ))}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }}
          onChange={e => e.target.files[0] && uploadImage(e.target.files[0])} />
      </div>
      <div id="img-input-trigger" data-open={() => fileInputRef.current?.click()} style={{ display:'none' }} />
    </div>
  )
}

// ── Floating Toolbar ──────────────────────────────────────────────────────────
function FloatingToolbar({ contentRef, setNoteContent, chatHeight, onImageClick }) {
  function apply(tag) {
    const ta = contentRef.current; if (!ta) return
    const s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e)
    const map = { bold:`**${sel}**`, italic:`*${sel}*`, underline:`__${sel}__`, h1:`# ${sel}`, quote:`> ${sel}`, code:`\`${sel}\`` }
    const rep = map[tag] || sel
    setNoteContent(ta.value.slice(0, s) + rep + ta.value.slice(e))
    setTimeout(() => { ta.focus(); ta.selectionStart = s; ta.selectionEnd = s + rep.length }, 0)
  }
  const btns = [
    { tag:'bold', label:'B', style:{ fontWeight:700 } }, { tag:'italic', label:'I', style:{ fontStyle:'italic' } },
    { tag:'underline', label:'U', style:{ textDecoration:'underline' } }, { sep:true },
    { tag:'h1', label:'H₁', style:{} }, { tag:'quote', label:'❝', style:{} }, { sep:true },
    { tag:'image', label:'🖼', cls:'ember', onClick: onImageClick }, { tag:'code', label:'#', style:{} },
  ]
  return (
    <div className="floating-toolbar" style={{ bottom: chatHeight + 16 }}>
      {btns.map((b, i) => b.sep ? <div key={i} className="tb-sep" /> : (
        <button key={i} className={`tb-btn${b.cls ? ' '+b.cls : ''}`} style={b.style}
          onClick={() => b.onClick ? b.onClick() : apply(b.tag)} title={b.tag}>{b.label}</button>
      ))}
    </div>
  )
}

// ── Voice FAB ─────────────────────────────────────────────────────────────────
function VoiceFAB({ setNoteContent, chatHeight }) {
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)
  const baseRef = useRef('')
  function toggle() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) { alert('Try Chrome.'); return }
    if (listening) { recRef.current?.stop(); setListening(false); return }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US'
    setNoteContent(prev => { baseRef.current = prev; return prev })
    rec.onresult = e => {
      let final = baseRef.current, interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript
        else interim = e.results[i][0].transcript
      }
      setNoteContent(final + (interim ? ` 🎙${interim}` : ''))
    }
    rec.onerror = () => setListening(false); rec.onend = () => setListening(false)
    recRef.current = rec; rec.start(); setListening(true)
  }
  return (
    <button className={`voice-fab${listening ? ' listening' : ''}`} onClick={toggle} data-hover
      style={{ bottom: chatHeight + 16, color: listening ? 'var(--green)' : 'var(--muted)' }} title="Voice input">🎙</button>
  )
}

// ── Chat Message ──────────────────────────────────────────────────────────────
function ChatMessage({ msg, allProfiles, currentUserId, onPin, isPinned, onPinToBoard, architectState, sparkState, yourState }) {
  const role = msg.role === 'user' ? 'human' : msg.role
  const isArchitect = role === 'claude'
  const isSpark = role === 'gpt'
  const isAI = isArchitect || isSpark
  const aiMeta = isArchitect ? AI.claude : isSpark ? AI.gpt : null
  const prof = allProfiles?.find(p => p.id === msg.user_id)
  const isMe = msg.user_id === currentUserId
  const label = isArchitect ? AI.claude.label : isSpark ? AI.gpt.label : (msg.display_name || prof?.display_name || 'Team')

  let avatar
  if (isArchitect)        avatar = <AvatarArchitect size={26} state={architectState} />
  else if (isSpark)       avatar = <AvatarSpark size={26} state={sparkState} />
  else if (isSmara(prof)) avatar = <AvatarSmara size={26} />
  else if (isMe)          avatar = <AvatarYou size={26} state={yourState} />
  else                    avatar = <AvatarGeneric initial={(label || '?')[0]?.toUpperCase()} size={26} />

  return (
    <div className="msg-row" style={{ borderLeft: isAI ? `2px solid ${aiMeta.border}` : `2px solid rgba(58,212,200,0.15)`, paddingLeft:'.5rem', marginLeft:'-.5rem' }}>
      {avatar}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:'.5rem', marginBottom:'.1rem' }}>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.12em', textTransform:'uppercase', color: aiMeta?.color || (isSmara(prof) ? 'var(--cyan)' : 'rgba(255,255,255,0.6)') }}>{label}</span>
          <span className="msg-timestamp">{formatTime(msg.created_at)}</span>
        </div>
        <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1.1rem', color: aiMeta?.textColor || 'var(--text)', lineHeight:1.55, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
          {msg.content}
          {msg.streaming && <span style={{ color: aiMeta?.color || 'var(--ember)', marginLeft:1 }} className="animate-pulse-slow">▋</span>}
        </p>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:2, flexShrink:0 }}>
        <button className={`pin-btn${isPinned ? ' pinned' : ''}`} onClick={() => onPin(msg)} title="Pin to note">
          {isPinned ? '📌' : '📍'}
        </button>
        {onPinToBoard && (
          <button onClick={() => onPinToBoard(msg)} title="Pin to board"
            style={{ background:'none', border:'none', color:'rgba(212,84,26,0.3)', fontSize:'.75rem', padding:'1px 3px', lineHeight:1, cursor:'none', transition:'color .15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--ember)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(212,84,26,0.3)'}>
            🗂
          </button>
        )}
      </div>
    </div>
  )
}

function ThinkingDot({ model, architectState, sparkState }) {
  const meta = AI[model]
  const avatarEl = model === 'claude'
    ? <AvatarArchitect size={26} state={architectState} />
    : <AvatarSpark size={26} state={sparkState} />
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'.5rem', paddingLeft:'.5rem', borderLeft:`2px solid ${meta.border}`, marginLeft:'-.5rem' }}>
      {avatarEl}
      <div style={{ display:'flex', alignItems:'center', gap:'.4rem' }}>
        <div style={{ width:5, height:5, borderRadius:'50%', background:meta.color, animation:'pulseSlow 1.2s ease-in-out infinite' }} />
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.12em', textTransform:'uppercase', color:meta.color, opacity:.8 }}>
          {meta.thinkingLabel}
        </span>
      </div>
    </div>
  )
}

// ── Socra Scroll Panel ────────────────────────────────────────────────────────
const SCROLL_WISDOM = [
  'Every draft has a thesis hiding behind the thing you think you\'re saying.',
  'The gap between what you wrote and what you meant — that\'s where the work is.',
  'Strong ideas need weak sentences. That\'s where they breathe.',
  'You\'re solving the right problem. Are you building the right thing?',
  'The clearest sentence in this draft is probably the last one you wrote.',
  'What\'s the one thing this note must accomplish?',
  'Read it as someone who has never met you.',
]

function SocraScrollPanel({ open, onClose, noteTitle, wisdomIdx }) {
  if (!open) return null
  const wisdom = SCROLL_WISDOM[wisdomIdx % SCROLL_WISDOM.length]
  return (
    <div style={{
      position:'absolute', bottom:'100%', right:0, marginBottom:8,
      width:260, background:'rgba(6,7,5,0.97)', border:'1px solid rgba(80,200,100,0.3)',
      borderRadius:'6px', padding:'1rem', zIndex:300,
      boxShadow:'0 -4px 24px rgba(0,0,0,0.6)',
      animation:'fadeUp .25s var(--ease)',
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.75rem' }}>
        <p style={{ fontFamily:'var(--font-mono)', fontSize:'.46rem', letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(80,200,100,0.7)' }}>Socra's scroll</p>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:'.85rem', padding:'0 .2rem', lineHeight:1 }}>×</button>
      </div>
      {noteTitle && (
        <p style={{ fontFamily:'var(--font-mono)', fontSize:'.46rem', letterSpacing:'.08em', color:'var(--muted)', marginBottom:'.75rem', textTransform:'uppercase', opacity:.7 }}>
          On: {noteTitle}
        </p>
      )}
      <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1.1rem', color:'rgba(80,200,100,0.88)', lineHeight:1.5, marginBottom:'.75rem' }}>
        {wisdom}
      </p>
      <p style={{ fontFamily:'var(--font-mono)', fontSize:'.42rem', letterSpacing:'.1em', color:'var(--muted)', opacity:.5, textTransform:'uppercase' }}>
        Click Socra for more ↑
      </p>
    </div>
  )
}

// ── Lattice Drawer ────────────────────────────────────────────────────────────
function LatticeDrawer({ expanded, setExpanded, messages, chatInput, setChatInput, onSend, onKeyDown, thinking, aiLocked, autoAI, setAutoAI, onAskArchitect, onAskSpark, allProfiles, currentUserId, onPin, pinnedIds, onPinToBoard, architectState, sparkState, yourState, noteTitle, activeEnclave }) {
  const messagesEndRef = useRef(null)
  const [socraOpen, setSocraOpen] = useState(false)
  const [socraWisdomIdx, setSocraWisdomIdx] = useState(0)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, thinking])

  const height = expanded ? 400 : 44

  function handleSocraClick(phrase) {
    setSocraWisdomIdx(i => (i + 1) % SCROLL_WISDOM.length)
    setSocraOpen(v => !v)
  }

  return (
    <div className="lattice-drawer" style={{ height }}>
      {/* Handle */}
      <div className="lattice-handle" onClick={() => setExpanded(v => !v)} data-hover>
        <div className="drawer-pill" />
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'.52rem', letterSpacing:'.18em', textTransform:'uppercase', color:'var(--mid)' }}>Lattice</span>
        {activeEnclave && (
          <span style={{ fontFamily:'var(--font-mono)', fontSize:'.44rem', letterSpacing:'.1em', textTransform:'uppercase', color:'var(--cyan)', opacity:.65 }}>
            ◆ {activeEnclave.name}
          </span>
        )}
        {[AI.claude, AI.gpt].map(ai => (
          <span key={ai.role} style={{ padding:'.15rem .4rem', border:`1px solid ${ai.border}`, borderRadius:'2px', fontFamily:'var(--font-mono)', fontSize:'.44rem', letterSpacing:'.1em', textTransform:'uppercase', color:ai.color, background:ai.dim }}>
            {ai.label}
          </span>
        ))}
        <div style={{ flex:1 }} />
        <button onClick={e => { e.stopPropagation(); setAutoAI(v => !v) }}
          style={{ display:'flex', alignItems:'center', gap:'.3rem', padding:'.2rem .5rem', background:'transparent', border:`1px solid ${autoAI ? 'rgba(80,200,100,0.4)' : 'var(--border)'}`, borderRadius:'2px', color: autoAI ? 'var(--green)' : 'var(--muted)', fontFamily:'var(--font-mono)', fontSize:'.44rem', letterSpacing:'.1em', textTransform:'uppercase', transition:'all .2s' }}>
          <span style={{ width:5, height:5, borderRadius:'50%', background: autoAI ? 'var(--green)' : 'var(--muted)', animation: autoAI ? 'pulseSlow 2s ease-in-out infinite' : 'none' }} />
          Auto {autoAI ? 'ON' : 'OFF'}
        </button>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'.44rem', letterSpacing:'.1em', textTransform:'uppercase', color:'var(--green)' }}>◆ Live</span>
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0, position:'relative' }}>
          {/* Messages */}
          <div style={{ flex:1, overflowY:'auto', padding:'1rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
            {messages.length === 0 && (
              <div style={{ margin:'auto', textAlign:'center', opacity:.25 }}>
                <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1.4rem', color:'var(--muted)', fontStyle:'italic' }}>The Lattice awaits.</p>
                <p style={{ fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.15em', textTransform:'uppercase', color:'var(--muted)', marginTop:'.4rem' }}>The Architect & The Spark are listening</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <ChatMessage key={msg.id || i} msg={msg} allProfiles={allProfiles} currentUserId={currentUserId}
                onPin={onPin} isPinned={pinnedIds.has(msg.id)} onPinToBoard={onPinToBoard}
                architectState={architectState} sparkState={sparkState} yourState={yourState} />
            ))}
            {thinking && <ThinkingDot model={thinking} architectState={architectState} sparkState={sparkState} />}
            <div ref={messagesEndRef} />
          </div>

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

          {/* Input row with Socra */}
          <div style={{ display:'flex', gap:'.5rem', padding:'.6rem 1rem', flexShrink:0, borderTop:'1px solid var(--border)', position:'relative', alignItems:'flex-end' }}>
            <textarea value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={onKeyDown}
              placeholder={aiLocked ? 'AIs are responding…' : 'Message the Lattice…'} disabled={aiLocked}
              style={{ flex:1, background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)', borderRadius:'2px', color:'var(--text)', fontFamily:'var(--font-caveat)', fontSize:'1.1rem', lineHeight:1.4, padding:'.45rem .7rem', resize:'none', outline:'none', height:'2.6rem', maxHeight:'100px', opacity: aiLocked ? .5 : 1, transition:'border-color .2s' }}
              onFocus={e => e.target.style.borderColor = 'var(--ember-dim)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
              rows={1} onInput={e => { e.target.style.height = '2.6rem'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px' }} />
            <button className="vault-btn" onClick={onSend} disabled={aiLocked || !chatInput.trim()} style={{ padding:'.5rem 1rem', alignSelf:'flex-end' }}>
              {aiLocked ? '…' : 'Send'}
            </button>

            {/* Socra — bottom-right corner */}
            <div style={{ position:'relative', flexShrink:0 }}>
              <SocraScrollPanel open={socraOpen} onClose={() => setSocraOpen(false)} noteTitle={noteTitle} wisdomIdx={socraWisdomIdx} />
              <AvatarSocra size={44} state="idle" onScrollClick={handleSocraClick} showThought={false} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Dashboard
// ════════════════════════════════════════════════════════════════
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
  const [showWelcome, setShowWelcome] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Notes
  const [notes, setNotes] = useState([])
  const [sharedNotes, setSharedNotes] = useState([])
  const [activeNote, setActiveNote] = useState(null)
  const [noteTitle, setNoteTitle] = useState('Untitled')
  const [noteContent, setNoteContent] = useState('')
  const [noteImages, setNoteImages] = useState([])
  const [noteVisibility, setNoteVisibility] = useState('private')
  const [saveStatus, setSaveStatus] = useState('')
  const [notesSearch, setNotesSearch] = useState('')
  const [notesOpen, setNotesOpen] = useState(false)
  const [visConfirmOpen, setVisConfirmOpen] = useState(false)

  // Reminders
  const [detectedReminders, setDetectedReminders] = useState([])
  const [reminderCard, setReminderCard] = useState(null)
  const [reminders, setReminders] = useState([])
  const [reminderNotifs, setReminderNotifs] = useState([])

  // Chat
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [thinking, setThinking] = useState(null)
  const [aiLocked, setAiLocked] = useState(false)
  const [autoAI, setAutoAI] = useState(true)
  const [chatExpanded, setChatExpanded] = useState(false)
  const [pinnedIds, setPinnedIds] = useState(new Set())
  const [pinToast, setPinToast] = useState(false)
  const [boardPinToast, setBoardPinToast] = useState(false)
  const [boardStickyCount, setBoardStickyCount] = useState(0)

  // Avatar states
  const [architectState, setArchitectState] = useState('idle')
  const [sparkState, setSparkState] = useState('idle')
  const [yourState, setYourState] = useState('idle')

  // Enclaves
  const [enclaves, setEnclaves] = useState([])
  const [activeEnclaveId, setActiveEnclaveId] = useState(null)
  const [activeEnclaveMembers, setActiveEnclaveMembers] = useState([])
  const [enclaveNotes, setEnclaveNotes] = useState([])
  const [showCreateEnclave, setShowCreateEnclave] = useState(false)
  const [showEnclaveSettings, setShowEnclaveSettings] = useState(false)
  const [enclaveToast, setEnclaveToast] = useState('')

  // Refs
  const historyRef = useRef([])
  const saveTimerRef = useRef(null)
  const contentRef = useRef(null)
  const activeNoteRef = useRef(null)
  const noteTitleRef = useRef('')
  const noteContentRef = useRef('')
  const lastMsgTimeRef = useRef(Date.now())
  const pinPendingRef = useRef(false)
  const avatarTimersRef = useRef({})
  const activeEnclaveIdRef = useRef(null)

  useEffect(() => { historyRef.current = messages }, [messages])
  useEffect(() => { activeNoteRef.current = activeNote }, [activeNote])
  useEffect(() => { noteTitleRef.current = noteTitle }, [noteTitle])
  useEffect(() => { noteContentRef.current = noteContent }, [noteContent])
  useEffect(() => { activeEnclaveIdRef.current = activeEnclaveId }, [activeEnclaveId])

  // ── Reminder detection ──
  useEffect(() => {
    const matches = noteContent.match(REMINDER_RE) || []
    setDetectedReminders([...new Set(matches.map(m => m.trim()))])
  }, [noteContent])

  // ── Avatar state helpers ──
  function setAvatarState(setter, state, durationMs) {
    setter(state)
    if (durationMs) {
      clearTimeout(avatarTimersRef.current[setter.name])
      avatarTimersRef.current[setter.name] = setTimeout(() => setter('idle'), durationMs)
    }
  }

  // ── Enclave helpers ──
  function switchActiveEnclave(id) {
    setActiveEnclaveId(id)
    activeEnclaveIdRef.current = id
    if (id) localStorage.setItem('vault_active_enclave', id)
    else localStorage.removeItem('vault_active_enclave')
    if (id) loadEnclaveData(id)
    else { setEnclaveNotes([]); setActiveEnclaveMembers([]) }
  }

  async function loadEnclaveData(enclaveId) {
    const sb = getSupabase()
    const [{ data: eNotes }, { data: membersData }] = await Promise.all([
      sb.from('notes')
        .select('id,title,content,user_id,visibility,enclave_id,created_at,updated_at')
        .eq('enclave_id', enclaveId).eq('visibility', 'enclave')
        .order('updated_at', { ascending: false }),
      sb.from('enclave_members')
        .select('role, joined_at, profiles(*)')
        .eq('enclave_id', enclaveId),
    ])
    setEnclaveNotes(eNotes || [])
    setActiveEnclaveMembers(membersData || [])
  }

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
          sb.from('notes')
            .select('id,title,content,user_id,is_shared,visibility,created_at,updated_at')
            .or('visibility.eq.public,is_shared.eq.true')
            .neq('user_id', u.id)
            .order('updated_at', { ascending: false }),
        ])
        if (!active) return

        setUser(u); setProfile(prof); setAllProfiles(profs || [])
        setMessages(msgs || []); setNotes(myNotes || []); setSharedNotes(sNotes || [])
        if (!prof?.display_name) setNeedsName(true)
        if (!u.user_metadata?.has_seen_welcome) setShowWelcome(true)
        if (myNotes?.length > 0) openNote(myNotes[0])

        // Load enclaves
        const userEnclaves = await getUserEnclaves(sb, u.id)
        if (!active) return
        setEnclaves(userEnclaves)

        // Restore active enclave from localStorage
        const savedEnclaveId = typeof window !== 'undefined' ? localStorage.getItem('vault_active_enclave') : null
        if (savedEnclaveId && userEnclaves.find(e => e.id === savedEnclaveId)) {
          setActiveEnclaveId(savedEnclaveId)
          activeEnclaveIdRef.current = savedEnclaveId
          const [{ data: eNotes }, { data: membersData }] = await Promise.all([
            sb.from('notes')
              .select('id,title,content,user_id,visibility,enclave_id,created_at,updated_at')
              .eq('enclave_id', savedEnclaveId).eq('visibility', 'enclave')
              .order('updated_at', { ascending: false }),
            sb.from('enclave_members')
              .select('role, joined_at, profiles(*)')
              .eq('enclave_id', savedEnclaveId),
          ])
          if (active) { setEnclaveNotes(eNotes || []); setActiveEnclaveMembers(membersData || []) }
        }

        setMounted(true)

        sb.channel('messages-rt')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            setMessages(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
          }).subscribe()

        const pc = sb.channel('online-users', { config: { presence: { key: u.id } } })
        pc.on('presence', { event: 'sync' }, () => setOnlineUsers(Object.values(pc.presenceState()).flat()))
          .subscribe(async s => {
            if (s === 'SUBSCRIBED') await pc.track({ user_id: u.id, display_name: prof?.display_name || u.email })
          })

        loadRemindersFor(u.id)
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

  // ── Idle detection (10 min → avatar states + Spark provocation) ──
  useEffect(() => {
    if (!user) return
    const idleInterval = setInterval(() => {
      const idleMs = Date.now() - lastMsgTimeRef.current
      if (idleMs >= 10 * 60 * 1000 && !aiLocked) {
        setYourState('silent')
        setArchitectState('silent')
        setSparkState('bored')
        // Spark provokes after a beat
        const phrase = PROVOCATIONS[Math.floor(Math.random() * PROVOCATIONS.length)]
        getSupabase().from('messages').insert({
          user_id: null, display_name: AI.gpt.label, content: phrase, role: 'gpt',
        }).select().single().then(({ data }) => {
          if (data) setMessages(prev => [...prev, data])
        })
        lastMsgTimeRef.current = Date.now() // reset to avoid repeat
      }
    }, 60000)
    return () => clearInterval(idleInterval)
  }, [user, aiLocked]) // eslint-disable-line

  // ── Reminder polling ──
  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => loadRemindersFor(user.id), 60000)
    return () => clearInterval(interval)
  }, [user]) // eslint-disable-line

  // ── Autosave ──
  useEffect(() => {
    if (!user) return
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if (noteTitle || noteContent) autoSaveNote()
    }, 2500)
    return () => clearTimeout(saveTimerRef.current)
  }, [noteTitle, noteContent, noteImages, noteVisibility]) // eslint-disable-line

  async function autoSaveNote() {
    setSaveStatus('saving')
    const sb = getSupabase()
    const imgStr = noteImages.map(i => `[img:${i.url}:${i.caption}]`).join('')
    const contentToSave = noteContent + (imgStr ? '\n' + imgStr : '')
    const isEnclave = noteVisibility === 'enclave'

    if (activeNote) {
      const { data } = await sb.from('notes').update({
        title: noteTitle || 'Untitled', content: contentToSave,
        visibility: noteVisibility, is_shared: isEnclave,
        enclave_id: isEnclave ? activeEnclaveId : null,
        updated_at: new Date().toISOString(),
      }).eq('id', activeNote.id).select().single()
      if (data) { setActiveNote(data); setNotes(prev => prev.map(n => n.id === data.id ? data : n)) }
    } else {
      if (!noteTitle && !noteContent) { setSaveStatus(''); return }
      const { data } = await sb.from('notes').insert({
        user_id: user.id, title: noteTitle || 'Untitled', content: contentToSave,
        visibility: noteVisibility, is_shared: isEnclave,
        enclave_id: isEnclave ? activeEnclaveId : null,
      }).select().single()
      if (data) { setActiveNote(data); setNotes(prev => [data, ...prev]) }
    }
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus(''), 2500)
  }

  function openNote(note) {
    setActiveNote(note); setNoteTitle(note.title || '')
    const IMG_RE = /\[img:(.*?):(.*?)\]/g; const imgs = []; let m
    const raw = note.content || ''
    while ((m = IMG_RE.exec(raw)) !== null) imgs.push({ id: Date.now() + Math.random(), url: m[1], caption: m[2], rotation: parseFloat((Math.random() * 4 - 2).toFixed(2)) })
    setNoteContent(raw.replace(IMG_RE, '').trim())
    setNoteImages(imgs)
    setNoteVisibility(noteVisibilityFromRecord(note))
  }

  function newNote() {
    setActiveNote(null); setNoteTitle('Untitled'); setNoteContent(''); setNoteImages([]); setNoteVisibility('private')
  }

  function handleVisibilityToggle() {
    if (!activeEnclaveId) return
    if (noteVisibility === 'private') setVisConfirmOpen(true)
    else setNoteVisibility('private')
  }

  // ── Display name ──
  async function saveDisplayName(name, setLoading) {
    setLoading(true)
    const sb = getSupabase()
    await sb.from('profiles').update({ display_name: name, avatar_initial: name[0].toUpperCase() }).eq('id', user.id)
    setProfile(prev => ({ ...prev, display_name: name }))
    setAllProfiles(prev => prev.map(p => p.id === user.id ? { ...p, display_name: name } : p))
    setNeedsName(false); setLoading(false)
  }

  // ── Reminders ──
  async function loadRemindersFor(uid) {
    const { data } = await getSupabase().from('reminders').select('*').eq('user_id', uid).eq('dismissed', false).order('created_at', { ascending: false })
    const all = data || []
    setReminders(all)
    const now = new Date()
    setReminderNotifs(all.filter(r => r.reminder_date && new Date(r.reminder_date) <= now))
  }

  async function saveReminder(phrase, reminderDate, notifyAll) {
    await getSupabase().from('reminders').insert({
      user_id: user.id, note_id: activeNoteRef.current?.id || null,
      note_title: noteTitleRef.current || null, phrase,
      reminder_date: reminderDate || null, notify_all: notifyAll,
    })
    setReminderCard(null)
    await loadRemindersFor(user.id)
  }

  async function dismissReminder(id) {
    await getSupabase().from('reminders').update({ dismissed: true }).eq('id', id)
    setReminderNotifs(prev => prev.filter(r => r.id !== id))
    setReminders(prev => prev.filter(r => r.id !== id))
  }

  function handleGoToNote(reminder) {
    const note = notes.find(n => n.id === reminder.note_id)
    if (note) { openNote(note); setNotesOpen(false) }
    dismissReminder(reminder.id)
  }

  // ── AI context ──
  async function buildNoteContext() {
    const noteCtx = { title: noteTitleRef.current, content: noteContentRef.current }
    const enclId = activeEnclaveIdRef.current
    let publicNotes = []
    if (enclId) {
      const { data } = await getSupabase().from('notes').select('id,title,content')
        .eq('enclave_id', enclId).eq('visibility', 'enclave')
        .order('updated_at', { ascending: false }).limit(10)
      publicNotes = data || []
    } else {
      const { data } = await getSupabase().from('notes').select('id,title,content')
        .or('visibility.eq.public,is_shared.eq.true').order('updated_at', { ascending: false }).limit(10)
      publicNotes = data || []
    }
    const pinNote = pinPendingRef.current ? '(Note: a message was just pinned to the current note.)' : ''
    pinPendingRef.current = false
    if (pinNote) noteCtx.content = (noteCtx.content || '') + '\n\n' + pinNote
    return { noteContext: noteCtx, publicNotes }
  }

  // ── Chat ──
  async function saveHumanMessage(content) {
    const tempId = `${Date.now()}-h`
    const optimistic = { id: tempId, user_id: user.id, display_name: profile?.display_name || user.email, content, role: 'human', created_at: new Date().toISOString() }
    setMessages(prev => prev.find(m => m.id === tempId) ? prev : [...prev, optimistic])
    const { data: saved } = await getSupabase().from('messages').insert({ user_id: user.id, display_name: optimistic.display_name, content, role: 'human' }).select().single()
    const final = saved || optimistic
    setMessages(prev => prev.map(m => m.id === tempId ? final : m))
    return final
  }

  async function triggerAI(model, history, noteContext, publicNotes) {
    const meta = AI[model]
    const tempId = `${Date.now()}-${model}`
    const placeholder = { id: tempId, role: model, display_name: meta.label, content: '', streaming: true, created_at: new Date().toISOString() }
    setMessages(prev => [...prev, placeholder])
    setThinking(model)

    let text = ''
    try {
      const res = await fetch(`${API_BASE}/api/chat/${model}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, noteContext: noteContext || null, publicNotes: publicNotes || [] }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Error' })); throw new Error(e.error || `HTTP ${res.status}`) }
      const reader = res.body.getReader(), dec = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read(); if (done) break
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
    lastMsgTimeRef.current = Date.now()

    // Your avatar fires
    setYourState('sending')
    setTimeout(() => setYourState('idle'), 900)

    // Architect: processing if >50 words
    const wordCount = content.split(/\s+/).filter(Boolean).length
    if (wordCount > 50) setArchitectState('processing')

    // Spark: excited on new message
    setSparkState('excited')
    setTimeout(() => setSparkState('idle'), 1500)

    await saveHumanMessage(content)
    if (!autoAI) return
    setAiLocked(true)

    const { noteContext, publicNotes } = await buildNoteContext()

    // Architect first
    const archReply = await triggerAI('claude', [...historyRef.current], noteContext, publicNotes)
    setArchitectState('idle')

    // Detect disagreement in Spark's upcoming response by checking contrast words in arch reply
    const archText = archReply?.content || ''

    // Your avatar pulses "replied"
    setYourState('replied')
    setTimeout(() => setYourState('idle'), 900)

    const sparkReply = await triggerAI('gpt', [...historyRef.current], noteContext, publicNotes)
    const sparkText = sparkReply?.content || ''

    // Check disagreement between the two
    if (CONTRAST_RE.test(sparkText) || CONTRAST_RE.test(archText)) {
      setArchitectState('disagreeing')
      setTimeout(() => setArchitectState('idle'), 3000)
    }

    setAiLocked(false)
    lastMsgTimeRef.current = Date.now()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  async function askOne(model) {
    setAiLocked(true)
    if (model === 'claude') setArchitectState('processing')
    if (model === 'gpt') { setSparkState('excited'); setTimeout(() => setSparkState('idle'), 1500) }
    const { noteContext, publicNotes } = await buildNoteContext()
    await triggerAI(model, [...historyRef.current], noteContext, publicNotes)
    if (model === 'claude') setArchitectState('idle')
    setAiLocked(false)
  }

  function pinMessage(msg) {
    const quote = `\n\n> ${msg.content}\n> — ${msg.display_name || 'Unknown'}, ${formatTime(msg.created_at)}\n`
    setNoteContent(prev => prev + quote)
    setPinnedIds(prev => new Set([...prev, msg.id]))
    setPinToast(true)
    setTimeout(() => setPinToast(false), 2200)
    pinPendingRef.current = true

    // Your avatar dims-then-reignites
    setYourState('pinning')
    setTimeout(() => setYourState('idle'), 700)

    // Architect interjects
    setArchitectState('interjecting')
    setTimeout(() => setArchitectState('idle'), 1200)

    if (activeNote) {
      const imgStr = noteImages.map(i => `[img:${i.url}:${i.caption}]`).join('')
      getSupabase().from('notes').update({ content: noteContent + quote + (imgStr ? '\n' + imgStr : ''), updated_at: new Date().toISOString() }).eq('id', activeNote.id)
    }
  }

  // ── Pin message to board ──
  async function handlePinToBoard(msg) {
    const color = msg.role === 'claude' ? 'ember' : msg.role === 'gpt' ? 'gold' : 'paper'
    const { sticky } = await pinLatticeMsgToBoard(getSupabase(), {
      userId: user.id,
      content: msg.content,
      color,
    })
    if (sticky) {
      setBoardStickyCount(prev => prev + 1)
      setBoardPinToast(true)
      setTimeout(() => setBoardPinToast(false), 2400)
      setSparkState('excited')
      setTimeout(() => setSparkState('idle'), 1200)
    }
  }

  // ── Enclave actions ──
  async function handleCreateEnclave(name, setLoading) {
    setLoading(true)
    const { enclave, error } = await createEnclave(getSupabase(), user.id, name)
    if (enclave) {
      setEnclaves(prev => [...prev, enclave])
      switchActiveEnclave(enclave.id)
      setEnclaveToast(`◆ ${name} created — you're now in your enclave`)
      setTimeout(() => setEnclaveToast(''), 3500)
    }
    if (error) console.error('[createEnclave]', error)
    setLoading(false)
    setShowCreateEnclave(false)
  }

  async function handleInviteMember(email) {
    const result = await inviteMember(getSupabase(), activeEnclaveId, email)
    if (!result.error) await loadEnclaveData(activeEnclaveId)
    return result
  }

  async function handleRemoveMember(userId) {
    await removeMember(getSupabase(), activeEnclaveId, userId)
    setActiveEnclaveMembers(prev => prev.filter(m => m.profiles?.id !== userId))
  }

  async function handleDeleteEnclave() {
    const name = enclaves.find(e => e.id === activeEnclaveId)?.name || 'this enclave'
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    await deleteEnclave(getSupabase(), activeEnclaveId)
    setEnclaves(prev => prev.filter(e => e.id !== activeEnclaveId))
    switchActiveEnclave(null)
    setShowEnclaveSettings(false)
  }

  function handleImageUploaded(filename) {
    // Spark notices the image drop
    setTimeout(async () => {
      if (aiLocked) return
      const comments = [
        `An image just dropped in. What are we looking at?`,
        `Oh. Visuals. What does this change?`,
        `Image landed. I'm curious what this adds to the thinking.`,
      ]
      const content = comments[Math.floor(Math.random() * comments.length)]
      const { data } = await getSupabase().from('messages').insert({
        user_id: null, display_name: AI.gpt.label, content, role: 'gpt',
      }).select().single()
      if (data) {
        setMessages(prev => [...prev, data])
        setSparkState('excited')
        setTimeout(() => setSparkState('idle'), 1800)
      }
    }, 900)
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
      {showWelcome && !needsName && <WelcomeModal supabase={getSupabase()} onDismiss={() => setShowWelcome(false)} />}
      {visConfirmOpen && (
        <VisibilityConfirmModal
          enclaveName={enclaves.find(e => e.id === activeEnclaveId)?.name}
          onConfirm={() => { setNoteVisibility('enclave'); setVisConfirmOpen(false) }}
          onCancel={() => setVisConfirmOpen(false)} />
      )}
      {showCreateEnclave && (
        <CreateEnclaveModal onCreate={handleCreateEnclave} onClose={() => setShowCreateEnclave(false)} />
      )}
      {showEnclaveSettings && activeEnclaveId && (
        <EnclaveSettingsPanel
          enclave={enclaves.find(e => e.id === activeEnclaveId) || {}}
          members={activeEnclaveMembers}
          onInvite={handleInviteMember}
          onRemove={handleRemoveMember}
          onDelete={handleDeleteEnclave}
          onClose={() => setShowEnclaveSettings(false)} />
      )}
      {reminderCard && (
        <ReminderCard phrase={reminderCard} noteTitle={noteTitle}
          onSave={saveReminder} onDismiss={() => setReminderCard(null)} />
      )}
      {pinToast && <div className="pin-toast">📌 Pinned to note</div>}
      {boardPinToast && <div className="pin-toast" style={{ bottom:'3.5rem' }}>🗂 Pinned to board</div>}
      {enclaveToast && (
        <div className="pin-toast" style={{ bottom:'auto', top:'3.5rem', right:'1rem', background:'rgba(11,10,8,0.97)', border:'1px solid rgba(58,212,200,0.3)', color:'var(--cyan)', maxWidth:'340px', fontSize:'.5rem', letterSpacing:'.08em', padding:'.65rem 1rem' }}>
          {enclaveToast}
        </div>
      )}
      <ReminderNotifications notifs={reminderNotifs} onGoTo={handleGoToNote} onDismiss={dismissReminder} />

      <TopBar noteTitle={noteTitle} notesCount={notes.length} onNotesToggle={() => setNotesOpen(v => !v)}
        onlineUsers={onlineUsers} allProfiles={allProfiles} profile={profile} user={user}
        yourState={yourState} architectState={architectState} sparkState={sparkState}
        enclaves={enclaves} activeEnclaveId={activeEnclaveId}
        onEnclaveSwitch={switchActiveEnclave}
        onCreateEnclave={() => setShowCreateEnclave(true)}
        onEnclaveSettings={() => setShowEnclaveSettings(true)}
        boardCount={boardStickyCount}
        onSignOut={async () => { await getSupabase().auth.signOut(); window.location.href = '/vault/login' }} />

      {notesOpen && <div className="drawer-overlay" onClick={() => setNotesOpen(false)} />}
      <NotesDrawer open={notesOpen}
        notes={activeEnclaveId ? filteredNotes.filter(n => noteVisibilityFromRecord(n) !== 'enclave') : filteredNotes}
        sharedNotes={sharedNotes}
        enclaveNotes={enclaveNotes.filter(n => !notesSearch || (n.title || '').toLowerCase().includes(notesSearch.toLowerCase()) || (n.content || '').toLowerCase().includes(notesSearch.toLowerCase()))}
        activeEnclave={enclaves.find(e => e.id === activeEnclaveId) || null}
        activeNoteId={activeNote?.id} reminders={reminders}
        onOpen={openNote} onNew={newNote} onClose={() => setNotesOpen(false)}
        search={notesSearch} setSearch={setNotesSearch} />

      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column' }}>
        <FullScreenEditor
          noteTitle={noteTitle} setNoteTitle={setNoteTitle}
          noteContent={noteContent} setNoteContent={setNoteContent}
          noteImages={noteImages} setNoteImages={setNoteImages}
          noteVisibility={noteVisibility} onVisibilityToggle={handleVisibilityToggle}
          saveStatus={saveStatus} user={user} supabase={getSupabase()}
          chatHeight={chatHeight} contentRef={contentRef}
          detectedReminders={detectedReminders}
          onReminderClick={phrase => setReminderCard(phrase)}
          onImageUploaded={handleImageUploaded}
          activeEnclave={enclaves.find(e => e.id === activeEnclaveId) || null} />
      </div>

      <FloatingToolbar contentRef={contentRef} setNoteContent={setNoteContent}
        chatHeight={chatHeight} onImageClick={() => { const el = document.querySelector('input[accept="image/*"]'); if (el) el.click() }} />

      <VoiceFAB setNoteContent={setNoteContent} chatHeight={chatHeight} />

      <LatticeDrawer
        expanded={chatExpanded} setExpanded={setChatExpanded}
        messages={messages} chatInput={chatInput} setChatInput={setChatInput}
        onSend={handleSend} onKeyDown={handleKeyDown}
        thinking={thinking} aiLocked={aiLocked}
        autoAI={autoAI} setAutoAI={setAutoAI}
        onAskArchitect={() => askOne('claude')}
        onAskSpark={() => askOne('gpt')}
        allProfiles={allProfiles} currentUserId={user?.id}
        onPin={pinMessage} pinnedIds={pinnedIds} onPinToBoard={handlePinToBoard}
        architectState={architectState} sparkState={sparkState} yourState={yourState}
        noteTitle={noteTitle}
        activeEnclave={enclaves.find(e => e.id === activeEnclaveId) || null} />
    </div>
  )
}
