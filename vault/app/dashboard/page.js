'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { createEnclave, getUserEnclaves, inviteMember, removeMember, deleteEnclave } from '@/lib/enclaves'
import { pinLatticeMsgToBoard } from '@/lib/stickies'
import {
  AvatarArchitect,
  AvatarSpark,
  AvatarScribe,
  AvatarSmara,
  AvatarYou,
  AvatarSocra,
  AvatarGeneric,
  AvatarSteward,
  AvatarAdvocate,
  AvatarContrarian,
} from '@/components/Avatars'
import { getEnclaveBudget, getEnclaveSpend, getBuildHistory, logBuild } from '@/lib/steward'
import WelcomeModal from '@/components/WelcomeModal'
import { createReactionEngine } from '@/lib/reactionEngine'
import VoiceCapture from '@/components/VoiceCapture'
import AudioPlayer from '@/components/AudioPlayer'
import TheGuideWidget from '@/components/TheGuideWidget'

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
  scribe: {
    label: 'The Scribe', role: 'scribe',
    color: 'rgba(100,140,255,0.8)', dim: 'rgba(100,140,255,0.1)', border: 'rgba(100,140,255,0.35)',
    textColor: 'rgba(210,220,255,0.88)',
    thinkingLabel: 'crafting a response…',
  },
  steward: {
    label: 'The Steward', role: 'steward',
    color: 'rgba(200,180,140,0.85)', dim: 'rgba(200,180,140,0.08)', border: 'rgba(200,180,140,0.3)',
    textColor: 'rgba(230,220,200,0.88)',
    thinkingLabel: 'weighing the long view…',
  },
  advocate: {
    label: 'The Advocate', role: 'advocate',
    color: 'rgba(184,149,106,0.88)', dim: 'rgba(184,149,106,0.08)', border: 'rgba(184,149,106,0.4)',
    textColor: 'rgba(240,225,200,0.88)',
    thinkingLabel: 'considering the experience…',
  },
  contrarian: {
    label: 'The Contrarian', role: 'contrarian',
    color: 'rgba(138,154,170,0.88)', dim: 'rgba(138,154,170,0.08)', border: 'rgba(138,154,170,0.4)',
    textColor: 'rgba(210,220,230,0.88)',
    thinkingLabel: 'weighing this…',
  },
}

// Triggers Scribe when message contains build/code intent or direct address
const SCRIBE_TRIGGER_RE = /\b(build|code|implement|create|fix|ship|deploy|write|refactor|debug|push|commit|make|add|update|delete|remove|connect|integrate)\b/i

// Triggers Steward when user confirms a Scribe proposal ("shall I proceed?" → user says one of these)
const STEWARD_CONFIRM_RE = /^(go|proceed|build it|do it|ship it|yes please|let's go|go ahead|sounds good|looks good|do it|yes|yep|yup|sure)$/i

// Scribe asking for approval — sets scribePendingApprovalRef so next user msg can trigger Steward
const SCRIBE_AWAIT_RE = /\b(ready when you are|shall I proceed|should I proceed|approve to proceed|want me to proceed|proceed\?|shall I start|shall I begin)\b/i

// Direct Steward address — user is talking to The Steward specifically
const STEWARD_DIRECT_RE = /\bsteward\b|@steward/i

// ── Reminder regex ─────────────────────────────────────────────────────────────
const REMINDER_RE = /\b(remind(?:er|s)?(?:\s+me)?|remember\s+to|don'?t\s+forget|follow[\s-]?up(?:\s+(?:on|with))?|check\s+back|revisit|by\s+(?:eod|end\s+of\s+(?:day|week)|tomorrow|(?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|week|month))|deadline[:\s]|due\s+(?:date[:\s]|by[:\s]|on[:\s]|\d+)|in\s+\d+\s+(?:days?|weeks?|months?|hours?)|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|next\s+(?:monday|tuesday|wednesday|thursday|friday|week|month)|this\s+(?:friday|monday|tuesday|wednesday|thursday))\b/gi

// ── Contrast words for disagreement detection ─────────────────────────────────
const CONTRAST_RE = /\b(actually|however|but\s+i|disagree|rather|on\s+the\s+other|in\s+contrast|yet\s+i|i'd\s+argue|contrary|wait[,—]|hold\s+on|not\s+quite|i\s+see\s+it\s+differently)\b/i

// ── Spark provocations (auto-fire, guarded) ───────────────────────────────────
const PROVOCATIONS = [
  "Nothing for a while. What are we actually trying to solve here?",
  "Long silence. Either deep thought or the draft got away from you. Which is it?",
  "I have a question. What happens if none of this works?",
  "Still here. The Architect and I have been having a quiet debate. Want in?",
]

// ── Spark wake messages (fire once on return from sleep) ──────────────────────
const WAKE_MESSAGES = [
  "Back. What did we miss?",
  "Still thinking about what you left open.",
  "The thread picked back up.",
  "You're back. Good.",
  "Picking up where we left off.",
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

  useEffect(() => {
    if (!open) return
    function onDoc(e) { if (!e.target.closest('[data-enclave-switcher]')) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const isEnclave = !!activeEnclaveId

  return (
    <div style={{ position:'relative' }} data-enclave-switcher>
      <button onClick={() => setOpen(v => !v)}
        style={{
          display:'flex', alignItems:'center', gap:'.5rem',
          background: isEnclave ? 'rgba(212,84,26,0.1)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${isEnclave ? 'rgba(212,84,26,0.4)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius:'5px', padding:'.35rem .8rem',
          color: isEnclave ? 'var(--ember)' : 'var(--mid)',
          fontFamily:'var(--font-mono)', fontSize:'.55rem', letterSpacing:'.1em',
          textTransform:'uppercase', transition:'all .2s', whiteSpace:'nowrap',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = isEnclave ? 'rgba(212,84,26,0.65)' : 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = isEnclave ? 'var(--ember)' : 'var(--text)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = isEnclave ? 'rgba(212,84,26,0.4)' : 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = isEnclave ? 'var(--ember)' : 'var(--mid)' }}>
        {isEnclave
          ? <><span style={{ fontSize:'.65rem' }}>◆</span>{active?.name}</>
          : <>Personal</>
        }
        <span style={{ fontSize:'.5rem', opacity:.5 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 8px)', left:0, zIndex:4000,
          background:'rgba(11,10,8,0.98)', border:'1px solid rgba(255,255,255,0.09)',
          borderRadius:'6px', minWidth:'210px', overflow:'hidden',
          boxShadow:'0 12px 48px rgba(0,0,0,0.75)', backdropFilter:'blur(20px)',
        }}>
          {/* Personal */}
          <button onClick={() => { onSwitch(null); setOpen(false) }}
            style={{
              width:'100%', padding:'.65rem .9rem', background:'transparent',
              color: !activeEnclaveId ? 'var(--text)' : 'var(--muted)',
              fontFamily:'var(--font-mono)', fontSize:'.55rem', letterSpacing:'.1em',
              textTransform:'uppercase', textAlign:'left', display:'flex', alignItems:'center',
              justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,0.055)', transition:'background .12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <span style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background: !activeEnclaveId ? 'var(--text)' : 'rgba(255,255,255,0.2)', flexShrink:0 }} />
              Personal
            </span>
            {!activeEnclaveId && <span style={{ color:'var(--ember)', fontSize:'.7rem' }}>✓</span>}
          </button>

          {/* Enclave list */}
          {enclaves.map(e => (
            <button key={e.id} onClick={() => { onSwitch(e.id); setOpen(false) }}
              style={{
                width:'100%', padding:'.65rem .9rem',
                background: activeEnclaveId === e.id ? 'rgba(212,84,26,0.08)' : 'transparent',
                color: activeEnclaveId === e.id ? 'var(--ember)' : 'var(--muted)',
                fontFamily:'var(--font-mono)', fontSize:'.55rem', letterSpacing:'.1em',
                textTransform:'uppercase', textAlign:'left', display:'flex',
                alignItems:'center', justifyContent:'space-between', transition:'background .12s',
              }}
              onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(212,84,26,0.06)'}
              onMouseLeave={ev => ev.currentTarget.style.background = activeEnclaveId === e.id ? 'rgba(212,84,26,0.08)' : 'transparent'}>
              <span style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
                <span style={{ fontSize:'.6rem', color: activeEnclaveId === e.id ? 'var(--ember)' : 'rgba(212,84,26,0.45)' }}>◆</span>
                {e.name}
              </span>
              <span style={{ display:'flex', alignItems:'center', gap:'.45rem' }}>
                {activeEnclaveId === e.id && <span style={{ color:'var(--ember)', fontSize:'.7rem' }}>✓</span>}
                <span onClick={ev => { ev.stopPropagation(); setOpen(false); onSettings() }}
                  title="Manage enclave"
                  style={{ fontSize:'.65rem', opacity:.35, transition:'opacity .15s', lineHeight:1 }}
                  onMouseEnter={ev => ev.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={ev => ev.currentTarget.style.opacity = '0.35'}>⚙</span>
              </span>
            </button>
          ))}

          {/* Footer actions */}
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.055)' }}>
            <button onClick={() => { setOpen(false); onCreateNew() }}
              style={{
                width:'100%', padding:'.65rem .9rem', background:'transparent',
                color:'var(--ember)', fontFamily:'var(--font-mono)', fontSize:'.55rem',
                letterSpacing:'.1em', textTransform:'uppercase', textAlign:'left',
                display:'flex', alignItems:'center', gap:'.45rem', transition:'background .12s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--ember-glow)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              + Create Enclave
            </button>
            {activeEnclaveId && (
              <button onClick={() => { setOpen(false); onSettings() }}
                style={{
                  width:'100%', padding:'.65rem .9rem', background:'transparent',
                  color:'var(--muted)', fontFamily:'var(--font-mono)', fontSize:'.55rem',
                  letterSpacing:'.1em', textTransform:'uppercase', textAlign:'left',
                  display:'flex', alignItems:'center', gap:'.45rem',
                  borderTop:'1px solid rgba(255,255,255,0.055)', transition:'background .12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                ⚙ Manage Enclave
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
  const [error, setError] = useState('')
  function submit() {
    if (!name.trim() || loading) return
    setError('')
    onCreate(name.trim(), setLoading, setError)
  }
  return (
    <div style={{ position:'fixed', inset:0, zIndex:8000, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:'380px', background:'rgba(11,10,8,0.97)', border:'1px solid rgba(212,84,26,0.25)', borderRadius:'4px', padding:'2rem' }}>
        <p className="panel-label" style={{ marginBottom:'.5rem' }}>New Enclave</p>
        <h2 style={{ fontFamily:'var(--font-caveat)', fontSize:'2rem', color:'var(--text)', fontWeight:600, marginBottom:'1.25rem', lineHeight:1 }}>
          Name your <span style={{ color:'var(--ember)', fontStyle:'italic' }}>group</span>
        </h2>
        <input type="text" value={name} onChange={e => { setName(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="e.g. Core Team" autoFocus maxLength={48}
          className="vault-input w-full" style={{ marginBottom: error ? '.5rem' : '1rem' }} />
        {error && (
          <p style={{ fontFamily:'var(--font-mono)', fontSize:'.52rem', color:'var(--ember)', marginBottom:'.75rem', letterSpacing:'.06em' }}>{error}</p>
        )}
        <div style={{ display:'flex', gap:'.5rem' }}>
          <button onClick={onClose} className="vault-btn-ghost" style={{ flex:1, padding:'.65rem', fontSize:'.55rem' }}>Cancel</button>
          <button onClick={submit}
            disabled={!name.trim() || loading} className="vault-btn"
            style={{ flex:2, padding:'.65rem', fontSize:'.55rem' }}>
            {loading ? 'Creating…' : 'Create Enclave →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Enclave Settings Panel ────────────────────────────────────────────────────
function EnclaveSettingsPanel({ enclave, onInvite, onRemove, onDelete, onClose }) {
  const [tab, setTab] = useState('members') // 'members' | 'ledger'
  const [members, setMembers] = useState([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [builds, setBuilds] = useState([])
  const [loadingBuilds, setLoadingBuilds] = useState(false)
  const [enclaveBudget, setEnclaveBudget] = useState(null)

  async function fetchMembers() {
    if (!enclave?.id) return
    setLoadingMembers(true)
    const sb = createClient()
    const { data: membersData } = await sb.from('enclave_members')
      .select('role, joined_at, user_id')
      .eq('enclave_id', enclave.id)
    const userIds = membersData?.map(m => m.user_id).filter(Boolean) || []
    const { data: profilesData } = userIds.length
      ? await sb.from('profiles').select('id, display_name, email').in('id', userIds)
      : { data: [] }
    const profileMap = Object.fromEntries((profilesData || []).map(p => [p.id, p]))
    setMembers((membersData || []).map(m => ({ ...m, profiles: profileMap[m.user_id] || null })))
    setLoadingMembers(false)
  }

  useEffect(() => { fetchMembers() }, [enclave?.id]) // eslint-disable-line

  useEffect(() => {
    if (tab !== 'ledger' || !enclave?.id) return
    setLoadingBuilds(true)
    Promise.all([
      getBuildHistory(enclave.id),
      getEnclaveBudget(enclave.id),
      getEnclaveSpend(enclave.id),
    ]).then(([history, budget, spent]) => {
      setBuilds(history)
      setEnclaveBudget({ ...budget, spent_cents: spent })
      setLoadingBuilds(false)
    })
  }, [tab, enclave?.id]) // eslint-disable-line

  async function handleInvite() {
    setInviting(true)
    const r = await onInvite(inviteEmail)
    if (r?.error) setInviteError(r.error)
    else { setInviteEmail(''); fetchMembers() }
    setInviting(false)
  }

  async function handleRemove(userId) {
    await onRemove(userId)
    fetchMembers()
  }

  const isOwner = members.find(m => m.profiles?.id && m.role === 'owner') // any owner can remove

  return (
    <div style={{ position:'fixed', inset:0, zIndex:8000, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:'420px', background:'rgba(11,10,8,0.97)', border:'1px solid rgba(58,212,200,0.2)', borderRadius:'4px', padding:'2rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
          <div>
            <p className="panel-label" style={{ marginBottom:'.25rem', color:'var(--cyan)' }}>Enclave</p>
            <h2 style={{ fontFamily:'var(--font-caveat)', fontSize:'1.8rem', color:'var(--text)', fontWeight:600, lineHeight:1 }}>{enclave.name}</h2>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:'1.2rem', padding:'.25rem', lineHeight:1 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:2, marginBottom:'1.25rem', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'3px' }}>
          {[{ id:'members', label:'Members' }, { id:'ledger', label:'Steward Ledger' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex:1, padding:'.35rem', borderRadius:'2px', background: tab === t.id ? (t.id === 'ledger' ? 'rgba(200,180,140,0.12)' : 'rgba(255,255,255,0.07)') : 'transparent', border:'none', color: tab === t.id ? (t.id === 'ledger' ? 'rgba(200,180,140,0.85)' : 'var(--text)') : 'var(--muted)', fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.12em', textTransform:'uppercase', transition:'all .15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'ledger' && (
          <div>
            {/* Budget summary */}
            {enclaveBudget && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'.6rem .75rem', background:'rgba(200,180,140,0.05)', border:'1px solid rgba(200,180,140,0.15)', borderRadius:'3px', marginBottom:'1rem' }}>
                <div>
                  <p style={{ fontFamily:'var(--font-mono)', fontSize:'.44rem', letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(200,180,140,0.5)', marginBottom:'.2rem' }}>Budget</p>
                  <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1.15rem', color:'rgba(200,180,140,0.85)', fontWeight:600 }}>
                    {enclaveBudget.budget_cents != null ? `$${(enclaveBudget.budget_cents / 100).toFixed(2)}` : 'Unlimited'}
                    {enclaveBudget.budget_period && enclaveBudget.budget_cents != null && <span style={{ fontSize:'.75rem', fontWeight:400, color:'rgba(200,180,140,0.45)', marginLeft:'.35rem' }}>/ {enclaveBudget.budget_period}</span>}
                  </p>
                </div>
                {enclaveBudget.budget_cents != null && (
                  <div style={{ textAlign:'right' }}>
                    <p style={{ fontFamily:'var(--font-mono)', fontSize:'.44rem', letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(200,180,140,0.5)', marginBottom:'.2rem' }}>Spent</p>
                    <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1.15rem', color: enclaveBudget.spent_cents > enclaveBudget.budget_cents ? 'var(--ember)' : 'rgba(200,180,140,0.85)', fontWeight:600 }}>
                      ${(enclaveBudget.spent_cents / 100).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            )}
            {/* Build history */}
            {loadingBuilds && <p style={{ fontFamily:'var(--font-mono)', fontSize:'.5rem', color:'var(--muted)', letterSpacing:'.1em' }}>Loading…</p>}
            {!loadingBuilds && builds.length === 0 && (
              <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1rem', color:'var(--muted)', fontStyle:'italic', textAlign:'center', padding:'1.5rem 0' }}>No builds logged yet.</p>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:'.4rem', maxHeight:'260px', overflowY:'auto' }}>
              {builds.map(b => (
                <div key={b.id} style={{ padding:'.5rem .65rem', background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)', borderRadius:'3px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.25rem' }}>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:'.44rem', letterSpacing:'.1em', textTransform:'uppercase', color: b.status === 'approved' || b.status === 'completed' ? 'rgba(80,160,80,0.8)' : b.status === 'rejected' ? 'rgba(212,84,26,0.7)' : 'rgba(200,180,140,0.5)' }}>
                      {b.status}
                    </span>
                    {b.estimated_cost_cents != null && (
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:'.5rem', color:'rgba(200,180,140,0.65)' }}>
                        ${(b.estimated_cost_cents / 100).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <p style={{ fontFamily:'var(--font-caveat)', fontSize:'.9rem', color:'var(--text)', lineHeight:1.4, marginBottom:'.2rem', overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                    {b.description}
                  </p>
                  <p className="msg-timestamp">{new Date(b.created_at).toLocaleDateString([], { month:'short', day:'numeric' })}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'members' && (<>
        <p className="panel-label" style={{ marginBottom:'.6rem' }}>Members</p>
        <div style={{ display:'flex', flexDirection:'column', gap:'.35rem', marginBottom:'1.25rem' }}>
          {loadingMembers && (
            <p style={{ fontFamily:'var(--font-mono)', fontSize:'.5rem', color:'var(--muted)', letterSpacing:'.1em' }}>Loading…</p>
          )}
          {!loadingMembers && members.length === 0 && (
            <p style={{ fontFamily:'var(--font-mono)', fontSize:'.5rem', color:'var(--muted)', letterSpacing:'.1em' }}>No members found</p>
          )}
          {members.map(m => {
            const name = m.profiles?.display_name || m.profiles?.email || 'Unknown'
            const initial = name[0]?.toUpperCase() || '?'
            return (
              <div key={m.user_id}
                style={{ display:'flex', alignItems:'center', gap:'.65rem', padding:'.45rem .6rem', background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)', borderRadius:'3px' }}>
                {/* Initial circle */}
                <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(212,84,26,0.15)', border:'1px solid rgba(212,84,26,0.3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontFamily:'var(--font-caveat)', fontSize:'.85rem', color:'var(--ember)', lineHeight:1 }}>{initial}</span>
                </div>
                {/* Name + role */}
                <div style={{ flex:1, minWidth:0 }}>
                  <span style={{ fontFamily:'var(--font-caveat)', fontSize:'1rem', color:'var(--text)', display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {name}
                  </span>
                </div>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:'.44rem', letterSpacing:'.1em', textTransform:'uppercase', color: m.role === 'owner' ? 'var(--ember)' : 'var(--muted)', flexShrink:0 }}>
                  {m.role}
                </span>
                {m.role !== 'owner' && (
                  <button onClick={() => handleRemove(m.user_id)}
                    style={{ background:'none', border:'none', color:'var(--muted)', fontSize:'.9rem', padding:'0 .15rem', lineHeight:1, transition:'color .15s', flexShrink:0 }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--ember)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}>×</button>
                )}
              </div>
            )
          })}
        </div>

        <p className="panel-label" style={{ marginBottom:'.4rem' }}>Invite by email</p>
        <div style={{ display:'flex', gap:'.5rem', marginBottom:'.5rem' }}>
          <input type="email" value={inviteEmail}
            onChange={e => { setInviteEmail(e.target.value); setInviteError('') }}
            onKeyDown={e => e.key === 'Enter' && inviteEmail.trim() && handleInvite()}
            placeholder="teammate@studio.com" className="vault-input"
            style={{ flex:1, fontSize:'.75rem' }} />
          <button onClick={handleInvite}
            disabled={!inviteEmail.trim() || inviting} className="vault-btn"
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
        </>)}
      </div>
    </div>
  )
}

// ── Steward Estimate Card ─────────────────────────────────────────────────────
function StewardEstimateCard({ estimate, stewardState, onApprove, onReject, onAskSteward }) {
  const isGood = estimate.recommendation === 'approve'
  const isBad = estimate.recommendation === 'reject'
  const accentColor = isGood ? 'rgba(80,160,80,0.9)' : isBad ? 'var(--ember)' : 'rgba(200,180,140,0.8)'
  const headline = isGood ? 'Approved.' : isBad ? 'Not this one.' : 'Worth resolving first.'
  return (
    <div style={{ position:'fixed', inset:0, zIndex:9000, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'flex-end', justifyContent:'center', padding:'0 1rem 72px' }}>
      <div style={{ width:'100%', maxWidth:'460px', background:'rgba(18,15,12,0.99)', border:'1px solid rgba(200,180,140,0.22)', borderRadius:'8px', padding:'1.5rem', boxShadow:'0 -8px 48px rgba(0,0,0,0.6)', animation:'fadeUp .3s ease' }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:'.65rem', marginBottom:'1rem' }}>
          <AvatarSteward size={36} state={stewardState} />
          <div>
            <p style={{ fontFamily:'var(--font-mono)', fontSize:'.44rem', letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(200,180,140,0.5)', marginBottom:'.2rem' }}>The Steward — Budget &amp; Priority Review</p>
            <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1.25rem', color:'var(--text)', fontWeight:600, lineHeight:1 }}>{headline}</p>
          </div>
        </div>

        {/* Cost + effort row */}
        <div style={{ display:'flex', alignItems:'stretch', gap:'.5rem', marginBottom:'.75rem' }}>
          <div style={{ flex:2, padding:'.65rem .85rem', background:'rgba(255,255,255,0.025)', borderRadius:'4px', border:'1px solid rgba(200,180,140,0.1)' }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:'.5rem' }}>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:'1.35rem', letterSpacing:'-.01em', color:accentColor, fontWeight:700 }}>
                ${(estimate.estimate_cents / 100).toFixed(2)}
              </span>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:'.44rem', letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(200,180,140,0.4)' }}>
                {estimate.confidence} confidence
              </span>
            </div>
          </div>
          {estimate.effort && (
            <div style={{ flex:1, padding:'.65rem .75rem', background:'rgba(255,255,255,0.015)', borderRadius:'4px', border:'1px solid rgba(200,180,140,0.08)', display:'flex', flexDirection:'column', justifyContent:'center' }}>
              <p style={{ fontFamily:'var(--font-mono)', fontSize:'.44rem', letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(200,180,140,0.38)', marginBottom:'.15rem' }}>Effort</p>
              <p style={{ fontFamily:'var(--font-caveat)', fontSize:'.95rem', color:'rgba(200,180,140,0.75)', fontWeight:600, lineHeight:1 }}>{estimate.effort}</p>
              {estimate.effort_time && <p style={{ fontFamily:'var(--font-mono)', fontSize:'.42rem', color:'rgba(200,180,140,0.35)', marginTop:'.1rem' }}>{estimate.effort_time}</p>}
            </div>
          )}
        </div>

        {/* Touches */}
        {estimate.touches?.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:'.3rem', marginBottom:'.65rem' }}>
            {estimate.touches.map((t, i) => (
              <span key={i} style={{ fontFamily:'var(--font-mono)', fontSize:'.42rem', letterSpacing:'.06em', color:'rgba(200,180,140,0.5)', background:'rgba(200,180,140,0.06)', border:'1px solid rgba(200,180,140,0.12)', borderRadius:'2px', padding:'.15rem .4rem' }}>{t}</span>
            ))}
          </div>
        )}

        {/* Reasoning */}
        <p style={{ fontFamily:'var(--font-caveat)', fontSize:'.95rem', color:'rgba(255,255,255,0.68)', lineHeight:1.5, marginBottom:'.5rem' }}>
          {estimate.reasoning}
        </p>

        {/* Flags */}
        {estimate.risks && (
          <p style={{ fontFamily:'var(--font-mono)', fontSize:'.46rem', letterSpacing:'.06em', color:'rgba(200,140,80,0.7)', marginBottom:'.4rem', lineHeight:1.5 }}>
            ⚠ {estimate.risks}
          </p>
        )}
        {estimate.priority_flag && (
          <p style={{ fontFamily:'var(--font-mono)', fontSize:'.46rem', letterSpacing:'.06em', color:'rgba(100,160,255,0.7)', marginBottom:'.4rem', lineHeight:1.5 }}>
            ↑ {estimate.priority_flag}
          </p>
        )}
        {estimate.contradiction_flag && (
          <p style={{ fontFamily:'var(--font-mono)', fontSize:'.46rem', letterSpacing:'.06em', color:'rgba(212,84,26,0.65)', marginBottom:'.4rem', lineHeight:1.5 }}>
            ↺ {estimate.contradiction_flag}
          </p>
        )}

        {/* Actions */}
        <div style={{ display:'flex', gap:'.5rem', marginTop:'1rem' }}>
          <button onClick={onReject} style={{ flex:1, padding:'.6rem', background:'transparent', border:'1px solid rgba(212,84,26,0.28)', borderRadius:'3px', color:'rgba(212,84,26,0.6)', fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.1em', textTransform:'uppercase', transition:'all .15s', cursor:'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(212,84,26,0.6)'; e.currentTarget.style.color='var(--ember)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(212,84,26,0.28)'; e.currentTarget.style.color='rgba(212,84,26,0.6)' }}>
            Reject
          </button>
          <button onClick={onAskSteward} style={{ flex:1, padding:'.6rem', background:'transparent', border:'1px solid rgba(200,180,140,0.18)', borderRadius:'3px', color:'rgba(200,180,140,0.5)', fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.1em', textTransform:'uppercase', transition:'all .15s', cursor:'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(200,180,140,0.45)'; e.currentTarget.style.color='rgba(200,180,140,0.85)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(200,180,140,0.18)'; e.currentTarget.style.color='rgba(200,180,140,0.5)' }}>
            Ask Steward
          </button>
          <button onClick={onApprove} style={{ flex:2, padding:'.6rem', background: isGood ? 'rgba(80,160,80,0.1)' : 'rgba(255,255,255,0.025)', border:`1px solid ${isGood ? 'rgba(80,160,80,0.4)' : 'rgba(200,180,140,0.22)'}`, borderRadius:'3px', color: isGood ? 'rgba(80,160,80,0.9)' : 'rgba(200,180,140,0.65)', fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.1em', textTransform:'uppercase', transition:'all .15s', cursor:'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(80,160,80,0.65)'; e.currentTarget.style.color='rgba(100,200,100,0.95)' }}
            onMouseLeave={e => {}}>
            Approve → Ship it
          </button>
        </div>
      </div>
    </div>
  )
}

// ── TopBar ────────────────────────────────────────────────────────────────────
// ── Mobile components ─────────────────────────────────────────────────────────
function MobileBottomNav({ mobileMode, onModeChange, boardCount, onMenuOpen }) {
  const active = mobileMode === 'voice' ? 'voice' : 'home'
  const items = [
    { id: 'home',  icon: '🏠', label: 'Home',  action: () => onModeChange('dashboard') },
    { id: 'board', icon: '📋', label: 'Board', action: () => { window.location.href = '/vault/board' } },
    { id: 'voice', icon: '🎙', label: 'Voice', action: () => onModeChange('voice') },
    { id: 'menu',  icon: '⚙',  label: 'Menu',  action: onMenuOpen },
  ]
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000,
      display: 'flex', alignItems: 'stretch',
      background: 'rgba(11,10,8,0.96)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid var(--border)',
      height: 'calc(56px + env(safe-area-inset-bottom, 0px))',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {items.map(item => (
        <button key={item.id} onClick={item.action} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', gap: 4, padding: '8px 0',
          color: active === item.id ? 'var(--ember)' : 'var(--muted)',
        }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>{item.icon}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.42rem', letterSpacing: '.1em', textTransform: 'uppercase' }}>
            {item.id === 'board' && boardCount > 0 ? `Board (${boardCount})` : item.label}
          </span>
        </button>
      ))}
    </div>
  )
}

function MobileMenuSheet({ open, onClose, user, enclaves, activeEnclaveId, onEnclaveSwitch, onCreateEnclave, onSignOut }) {
  if (!open) return null
  const pill = (active) => ({
    width: '100%', height: 48, display: 'flex', alignItems: 'center', gap: '.6rem',
    padding: '0 .85rem', borderRadius: 6, marginBottom: 6,
    background: active ? 'rgba(212,84,26,0.1)' : 'rgba(255,255,255,0.03)',
    border: `1px solid ${active ? 'rgba(212,84,26,0.4)' : 'rgba(255,255,255,0.07)'}`,
    color: active ? 'var(--ember)' : 'var(--muted)',
    fontFamily: 'var(--font-mono)', fontSize: '.58rem', letterSpacing: '.1em',
    textTransform: 'uppercase', textAlign: 'left',
  })
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1998, background: 'rgba(0,0,0,0.55)' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1999,
        height: '62vh',
        background: 'rgba(11,10,8,0.98)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '14px 14px 0 0',
        paddingBottom: 'env(safe-area-inset-bottom, 20px)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideUp .25s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.25rem 1.25rem' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '.5rem', color: 'var(--muted)', letterSpacing: '.08em', marginBottom: '1.25rem', paddingTop: '.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email}
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '.46rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: '.65rem' }}>Space</p>
          <button onClick={() => { onEnclaveSwitch(null); onClose() }} style={pill(!activeEnclaveId)}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: !activeEnclaveId ? 'var(--ember)' : 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
            Personal
            {!activeEnclaveId && <span style={{ marginLeft: 'auto' }}>✓</span>}
          </button>
          {enclaves.map(e => (
            <button key={e.id} onClick={() => { onEnclaveSwitch(e.id); onClose() }} style={pill(activeEnclaveId === e.id)}>
              <span style={{ fontSize: '.65rem', color: activeEnclaveId === e.id ? 'var(--ember)' : 'rgba(212,84,26,0.5)' }}>◆</span>
              {e.name}
              {activeEnclaveId === e.id && <span style={{ marginLeft: 'auto' }}>✓</span>}
            </button>
          ))}
          <button onClick={() => { onCreateEnclave(); onClose() }} style={{
            width: '100%', height: 44, display: 'flex', alignItems: 'center', gap: '.5rem',
            padding: '0 .85rem', borderRadius: 6, marginBottom: '1.5rem',
            background: 'transparent', border: '1px dashed rgba(212,84,26,0.3)',
            color: 'var(--ember)', fontFamily: 'var(--font-mono)', fontSize: '.56rem',
            letterSpacing: '.1em', textTransform: 'uppercase', textAlign: 'left',
          }}>+ Create Enclave</button>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: '1.25rem' }} />
          <button onClick={onSignOut} style={{
            width: '100%', height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 6, background: 'rgba(180,30,30,0.08)', border: '1px solid rgba(180,30,30,0.3)',
            color: 'rgba(255,100,100,0.8)', fontFamily: 'var(--font-mono)',
            fontSize: '.58rem', letterSpacing: '.14em', textTransform: 'uppercase',
          }}>Sign Out</button>
        </div>
      </div>
    </>
  )
}

function TopBar({ noteTitle, notesCount, onNotesToggle, onlineUsers, allProfiles, profile, user, onSignOut, yourState, architectState, sparkState, enclaves, activeEnclaveId, onEnclaveSwitch, onCreateEnclave, onEnclaveSettings, boardCount, scribeActive, scribeAvailable, scribeState, onScribeSummon, stewardActive, stewardAvatarState, advocateAvatarState, contrarianAvatarState, isMobile, mobileMode, onMobileModeChange }) {
  // ── Mobile topbar: clean brand + mode toggle only ──
  if (isMobile) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 500,
        height: 'calc(52px + env(safe-area-inset-top, 0px))',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: '1rem', paddingRight: '1rem',
        boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(11,10,8,0.92)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.45rem' }}>
          <div className="ember-pip" />
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '.9rem', fontWeight: 300, fontStyle: 'italic', color: 'var(--text)' }}>
            The <em style={{ color: 'var(--ember)' }}>Vault</em>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ id: 'dashboard', label: 'Dashboard' }, { id: 'voice', label: '🎙 Voice' }].map(opt => (
            <button key={opt.id} onClick={() => onMobileModeChange(opt.id)} style={{
              minWidth: 80, height: 34, padding: '0 10px', borderRadius: 6,
              fontFamily: 'var(--font-mono)', fontSize: '.7rem', letterSpacing: '.06em', textTransform: 'uppercase',
              background: mobileMode === opt.id ? 'var(--ember)' : 'transparent',
              color: mobileMode === opt.id ? '#fff' : 'rgba(212,84,26,0.7)',
              border: mobileMode === opt.id ? '1px solid transparent' : '1px solid rgba(212,84,26,0.45)',
              transition: 'all .2s', cursor: 'pointer',
            }}>{opt.label}</button>
          ))}
        </div>
      </div>
    )
  }

  // ── Desktop topbar ──
  const tbBtn = {
    display:'flex', alignItems:'center', gap:'.4rem',
    background:'transparent', border:'1px solid var(--border)', borderRadius:'4px',
    padding:'.38rem .75rem', color:'var(--muted)',
    fontFamily:'var(--font-mono)', fontSize:'.52rem', letterSpacing:'.18em',
    textTransform:'uppercase', transition:'all .2s', whiteSpace:'nowrap',
  }
  return (
    <div className="topbar">
      {/* Left: brand + switcher */}
      <div style={{ display:'flex', alignItems:'center', gap:'.75rem', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'.55rem' }}>
          <div className="ember-pip" />
          <span style={{ fontFamily:'var(--font-serif)', fontSize:'1.1rem', fontWeight:300, fontStyle:'italic', color:'var(--text)', whiteSpace:'nowrap' }}>
            The <em style={{ color:'var(--ember)' }}>Vault</em>
          </span>
        </div>
        <div style={{ width:1, height:18, background:'rgba(255,255,255,0.08)', flexShrink:0 }} />
        <EnclaveSwitcher enclaves={enclaves} activeEnclaveId={activeEnclaveId}
          onSwitch={onEnclaveSwitch} onCreateNew={onCreateEnclave} onSettings={onEnclaveSettings} />
      </div>

      {/* Center: note title (desktop) or mode toggle (mobile) */}
      <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', pointerEvents: isMobile ? 'auto' : 'none' }}>
        {isMobile ? (
          <div style={{ display:'flex', gap:3 }}>
            {[{ id:'dashboard', label:'Dashboard' }, { id:'voice', label:'🎙 Voice' }].map(opt => (
              <button key={opt.id} onClick={() => onMobileModeChange(opt.id)} style={{
                padding:'.28rem .65rem', borderRadius:'3px',
                fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.12em', textTransform:'uppercase',
                background: mobileMode === opt.id ? 'var(--ember)' : 'transparent',
                color: mobileMode === opt.id ? '#fff' : 'var(--muted)',
                border: mobileMode === opt.id ? '1px solid transparent' : '1px solid rgba(212,84,26,0.4)',
                transition:'all .2s', cursor:'pointer',
              }}>{opt.label}</button>
            ))}
          </div>
        ) : (
          <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1.1rem', color:'var(--muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', textAlign:'center', maxWidth:'280px' }}>
            {noteTitle || 'Untitled'}
          </p>
        )}
      </div>

      {/* Right: actions */}
      <div style={{ display:'flex', alignItems:'center', gap:'.55rem', flexShrink:0 }}>
        <button onClick={onNotesToggle} data-hover style={tbBtn}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-h)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
          Notes
          {notesCount > 0 && <span style={{ background:'var(--ember)', color:'#0b0a08', borderRadius:'3px', padding:'0 .3rem', fontSize:'.52rem', fontWeight:700, lineHeight:'1.35' }}>{notesCount}</span>}
        </button>
        <button onClick={() => { window.location.href = '/vault/board' }} data-hover style={tbBtn}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-h)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
          Board
          {boardCount > 0 && <span style={{ background:'rgba(212,84,26,0.2)', color:'var(--ember)', borderRadius:'3px', padding:'0 .3rem', fontSize:'.52rem', fontWeight:700, lineHeight:'1.35' }}>{boardCount}</span>}
        </button>

        <div style={{ display:'flex', alignItems:'center', gap:3, padding:'0 .3rem', borderLeft:'1px solid var(--border)', borderRight:'1px solid var(--border)' }}>
          <AvatarArchitect size={28} state={architectState} />
          <AvatarSpark size={28} state={sparkState} />
          <div
            title={scribeActive ? 'The Scribe — active' : scribeAvailable ? 'The Scribe — summon with /scribe' : 'The Scribe — needs enclave notes to summon'}
            onClick={scribeAvailable ? onScribeSummon : undefined}
            style={{ opacity: scribeActive ? 1 : scribeAvailable ? 0.55 : 0.22, cursor: scribeAvailable ? 'none' : 'default', transition:'opacity .3s', boxShadow: scribeActive ? '0 0 10px rgba(100,140,255,0.5)' : 'none', borderRadius:'4px' }}>
            <AvatarScribe size={28} state={scribeActive ? scribeState : 'idle'} />
          </div>
          <div
            title={stewardActive ? 'The Steward — reviewing' : activeEnclaveId ? 'The Steward — budget gatekeeper' : 'The Steward — active in enclaves'}
            style={{ opacity: stewardActive ? 1 : activeEnclaveId ? 0.5 : 0.2, transition:'opacity .3s', borderRadius:'4px', boxShadow: stewardActive ? '0 0 10px rgba(200,180,140,0.4)' : 'none' }}>
            <AvatarSteward size={28} state={stewardAvatarState} />
          </div>
          <div
            title="The Advocate — speaks for the person on the other side"
            style={{ opacity: advocateAvatarState !== 'idle' ? 1 : 0.28, transition:'opacity .4s', borderRadius:'4px', boxShadow: advocateAvatarState !== 'idle' ? '0 0 10px rgba(184,149,106,0.4)' : 'none' }}>
            <AvatarAdvocate size={28} state={advocateAvatarState} />
          </div>
          <div
            title="The Contrarian — tests the reasoning"
            style={{ opacity: contrarianAvatarState !== 'idle' ? 1 : 0.18, transition:'opacity .4s', borderRadius:'4px', boxShadow: contrarianAvatarState !== 'idle' ? '0 0 10px rgba(138,154,170,0.35)' : 'none' }}>
            <AvatarContrarian size={28} state={contrarianAvatarState} />
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center' }}>
          {onlineUsers.slice(0, 4).map((u, i) => {
            const prof = allProfiles.find(p => p.id === u.user_id)
            const isMe = prof?.id === user?.id
            return (
              <div key={u.user_id || i} style={{ marginLeft: i > 0 ? '-6px' : 0, zIndex: 10 - i }}>
                {getAvatar(prof, isMe, 28, isMe ? yourState : 'idle')}
              </div>
            )
          })}
        </div>

        <button className="vault-btn-ghost" onClick={onSignOut} style={{ padding:'.3rem .7rem', fontSize:'.5rem' }}>Out</button>
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
        <p style={{ fontFamily:'var(--font-caveat)', fontSize:'.85rem', color: active ? 'var(--text)' : 'var(--mid)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{note.title || 'Untitled'}</p>
        {isEnclave && (
          <span style={{ fontFamily:'var(--font-mono)', fontSize:'.48rem', letterSpacing:'.06em', color:'var(--ember)', flexShrink:0, display:'flex', alignItems:'center', gap:'.2rem' }}>
            <span style={{ fontSize:'.55rem' }}>◆</span>
          </span>
        )}
      </div>
      <p style={{ fontFamily:'var(--font-caveat)', fontSize:'.75rem', color:'var(--muted)', lineHeight:1.3, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical' }}>
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
        <h2 style={{ fontFamily:'var(--font-caveat)', fontSize:'2rem', color:'var(--text)', fontWeight:600, marginBottom:'.65rem', lineHeight:1 }}>notes</h2>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="vault-input w-full" style={{ fontSize:'.8rem', padding:'.45rem .75rem' }} />
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
      style={{ position:'relative', flex:1, display:'flex', flexDirection:'column', alignItems:'center', paddingTop:'56px', paddingBottom: chatHeight + 64 + 'px', overflow:'hidden' }}
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
            <div style={{ display:'flex', alignItems:'center', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'6px', padding:'3px', gap:'2px' }}>
              <button onClick={() => isEnclave && onVisibilityToggle()} data-hover
                style={{ display:'flex', alignItems:'center', gap:'.4rem', padding:'.38rem .8rem', borderRadius:'4px', background: !isEnclave ? 'rgba(255,255,255,0.09)' : 'transparent', border:'none', color: !isEnclave ? 'var(--text)' : 'var(--muted)', fontFamily:'var(--font-mono)', fontSize:'.58rem', letterSpacing:'.08em', textTransform:'uppercase', transition:'all .18s', whiteSpace:'nowrap' }}
                onMouseEnter={e => { if (isEnclave) e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { if (isEnclave) e.currentTarget.style.color = 'var(--muted)' }}>
                🔒 Private
              </button>
              <button onClick={() => !isEnclave && onVisibilityToggle()} data-hover
                style={{ display:'flex', alignItems:'center', gap:'.4rem', padding:'.38rem .8rem', borderRadius:'4px', background: isEnclave ? 'rgba(212,84,26,0.14)' : 'transparent', border:'none', color: isEnclave ? 'var(--ember)' : 'var(--muted)', fontFamily:'var(--font-mono)', fontSize:'.58rem', letterSpacing:'.08em', textTransform:'uppercase', transition:'all .18s', whiteSpace:'nowrap' }}
                onMouseEnter={e => { if (!isEnclave) e.currentTarget.style.color = 'var(--ember)' }}
                onMouseLeave={e => { if (!isEnclave) e.currentTarget.style.color = 'var(--muted)' }}>
                <span style={{ fontSize:'.62rem', lineHeight:1 }}>◆</span> Share to {activeEnclave.name}
              </button>
            </div>
          ) : (
            <span style={{ display:'flex', alignItems:'center', gap:'.4rem', padding:'.38rem .8rem', border:'1px solid var(--border)', borderRadius:'6px', color:'var(--muted)', fontFamily:'var(--font-mono)', fontSize:'.58rem', letterSpacing:'.08em', textTransform:'uppercase', opacity:.6 }}>
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
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'.54rem', letterSpacing:'.1em', color: saveStatus === 'saving' ? 'var(--muted)' : 'var(--green)', display:'flex', alignItems:'center', gap:'.35rem' }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background: saveStatus === 'saving' ? 'var(--muted)' : 'var(--green)', animation: saveStatus === 'saving' ? 'pulseSlow 1s ease-in-out infinite' : 'none' }} />
              {saveStatus === 'saving' ? 'Saving…' : 'Saved just now'}
            </span>
          )}
        </div>

        {/* Title */}
        <textarea value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="Note title…" rows={1}
          style={{ background:'transparent', border:'none', outline:'none', resize:'none', width:'100%', fontFamily:'var(--font-caveat)', fontSize:'2.8rem', fontWeight:700, color:'var(--text)', lineHeight:1.1, padding:0, marginBottom:'1.5rem', flexShrink:0, overflow:'hidden' }}
          onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }} />

        {/* Voice recording player — shown when note contains a voice recording */}
        {(() => {
          const m = noteContent.match(/\[voice-recording\]:\s*(https?:\/\/[^\s\n]+)/)
          return m ? <AudioPlayer url={m[1]} /> : null
        })()}

        {/* Body */}
        <textarea ref={contentRef} value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Start writing…" className="ruled-editor"
          style={{ flex:1, backgroundColor:'transparent', border:'none', outline:'none', resize:'none', width:'100%', fontFamily:'var(--font-caveat)', fontSize:'1.15rem', color:'var(--text)', lineHeight:'2.3rem', padding:0, minHeight:'200px' }} />

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
const COLOR_HEX = { ember:'#d4541a', gold:'#c8973a', cyan:'#3ad4c8', paper:'rgba(240,236,228,0.9)', charcoal:'#2a2825' }

function FloatingToolbar({ contentRef, setNoteContent, chatHeight, onImageClick, onDropToBoard }) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [stickyText, setStickyText] = useState('')
  const [stickyColor, setStickyColor] = useState('paper')

  function apply(tag) {
    const ta = contentRef.current; if (!ta) return
    const s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e)
    const map = { bold:`**${sel}**`, italic:`*${sel}*`, underline:`__${sel}__`, h1:`# ${sel}`, quote:`> ${sel}`, code:`\`${sel}\`` }
    const rep = map[tag] || sel
    setNoteContent(ta.value.slice(0, s) + rep + ta.value.slice(e))
    setTimeout(() => { ta.focus(); ta.selectionStart = s; ta.selectionEnd = s + rep.length }, 0)
  }

  function openPopover() {
    const ta = contentRef.current
    const sel = ta ? ta.value.slice(ta.selectionStart, ta.selectionEnd).trim() : ''
    setStickyText(sel)
    setStickyColor('paper')
    setPopoverOpen(true)
  }

  async function dropToBoard() {
    if (!stickyText.trim()) return
    await onDropToBoard(stickyText.trim(), stickyColor)
    setPopoverOpen(false)
    setStickyText('')
  }

  const btns = [
    { tag:'bold', label:'B', style:{ fontWeight:700 } }, { tag:'italic', label:'I', style:{ fontStyle:'italic' } },
    { tag:'underline', label:'U', style:{ textDecoration:'underline' } }, { sep:true },
    { tag:'h1', label:'H₁', style:{} }, { tag:'quote', label:'❝', style:{} }, { sep:true },
    { tag:'image', label:'🖼', cls:'ember', onClick: onImageClick }, { tag:'code', label:'#', style:{} },
  ]

  return (
    <div style={{ position:'fixed', left:'50%', transform:'translateX(-50%)', bottom: chatHeight + 16, zIndex:150, display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
      {popoverOpen && (
        <div style={{ background:'rgba(11,10,8,0.97)', border:'1px solid var(--border)', borderRadius:'8px', padding:'1rem', width:'244px', boxShadow:'0 8px 32px rgba(0,0,0,0.5)', backdropFilter:'blur(16px)', display:'flex', flexDirection:'column', gap:'.7rem' }}>
          <p style={{ fontFamily:'var(--font-mono)', fontSize:'.46rem', letterSpacing:'.18em', textTransform:'uppercase', color:'var(--muted)' }}>Drop to Board</p>
          <div style={{ display:'flex', gap:'.45rem', alignItems:'center' }}>
            {Object.entries(COLOR_HEX).map(([id, hex]) => (
              <button key={id} onClick={() => setStickyColor(id)}
                style={{ width:18, height:18, borderRadius:'50%', background:hex, border: stickyColor === id ? '2px solid rgba(255,255,255,0.8)' : '2px solid transparent', transition:'border .15s', cursor:'none', flexShrink:0 }} />
            ))}
          </div>
          <textarea value={stickyText} onChange={e => setStickyText(e.target.value)} rows={3}
            placeholder="capture a thought…"
            style={{ background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)', borderRadius:'4px', color:'var(--text)', fontFamily:'var(--font-caveat)', fontSize:'1.05rem', lineHeight:1.4, padding:'.4rem .55rem', resize:'none', outline:'none' }}
            onFocus={e => e.target.style.borderColor = 'var(--ember-dim)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'} />
          <div style={{ display:'flex', gap:'.5rem' }}>
            <button className="vault-btn" onClick={dropToBoard} disabled={!stickyText.trim()} style={{ flex:1, padding:'.45rem', fontSize:'.5rem', justifyContent:'center' }}>Drop to Board</button>
            <button className="vault-btn-ghost" onClick={() => setPopoverOpen(false)} style={{ padding:'.45rem .8rem', fontSize:'.5rem' }}>Cancel</button>
          </div>
        </div>
      )}
      <div className="floating-toolbar" style={{ position:'relative', transform:'none', left:'auto', bottom:'auto' }}>
        {btns.map((b, i) => b.sep ? <div key={i} className="tb-sep" /> : (
          <button key={i} className={`tb-btn${b.cls ? ' '+b.cls : ''}`} style={b.style}
            onClick={() => b.onClick ? b.onClick() : apply(b.tag)} title={b.tag}>{b.label}</button>
        ))}
        <div className="tb-sep" />
        <button className="tb-btn ember" onClick={openPopover} title="drop to board" style={{ fontSize:'.85rem' }}>📌</button>
      </div>
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
function ChatMessage({ msg, allProfiles, currentUserId, onPin, isPinned, onPinToBoard, architectState, sparkState, yourState, scribeState, stewardState, advocateState, contrarianState }) {
  const role = msg.role === 'user' ? 'human' : msg.role
  const isArchitect  = role === 'claude'
  const isSpark      = role === 'gpt'
  const isScribe     = role === 'scribe'
  const isSteward    = role === 'steward'
  const isAdvocate   = role === 'advocate'
  const isContrarian = role === 'contrarian'
  const isAI = isArchitect || isSpark || isScribe || isSteward || isAdvocate || isContrarian
  const isReaction = !!msg.isReaction
  const aiMeta = isArchitect ? AI.claude : isSpark ? AI.gpt : isScribe ? AI.scribe : isSteward ? AI.steward : isAdvocate ? AI.advocate : isContrarian ? AI.contrarian : null
  const prof = allProfiles?.find(p => p.id === msg.user_id)
  const isMe = msg.user_id === currentUserId
  const baseLabel = isArchitect ? AI.claude.label : isSpark ? AI.gpt.label : isScribe ? AI.scribe.label : isSteward ? AI.steward.label : isAdvocate ? AI.advocate.label : isContrarian ? AI.contrarian.label : (msg.display_name || prof?.display_name || 'Team')
  const label = isReaction ? `${baseLabel} ↩` : baseLabel

  let avatar
  if (isArchitect)         avatar = <AvatarArchitect size={isReaction ? 22 : 26} state={architectState} />
  else if (isSpark)        avatar = <AvatarSpark size={isReaction ? 22 : 26} state={sparkState} />
  else if (isScribe)       avatar = <AvatarScribe size={26} state={scribeState} />
  else if (isSteward)      avatar = <AvatarSteward size={26} state={stewardState || 'idle'} />
  else if (isAdvocate)     avatar = <AvatarAdvocate size={26} state={advocateState || 'idle'} />
  else if (isContrarian)   avatar = <AvatarContrarian size={26} state={contrarianState || 'idle'} />
  else if (isSmara(prof))  avatar = <AvatarSmara size={26} />
  else if (isMe)           avatar = <AvatarYou size={26} state={yourState} />
  else                     avatar = <AvatarGeneric initial={(label || '?')[0]?.toUpperCase()} size={26} />

  return (
    <div className="msg-row" style={{
      borderLeft: isAI ? `2px solid ${aiMeta.border}` : `2px solid rgba(58,212,200,0.15)`,
      paddingLeft: isReaction ? '1rem' : '.5rem',
      marginLeft: isReaction ? '.75rem' : '-.5rem',
      background: isScribe ? 'rgba(10,12,20,0.6)' : isReaction ? 'rgba(255,255,255,0.01)' : 'transparent',
      borderRadius: isScribe || isReaction ? '2px' : 0,
      opacity: isReaction ? 0.82 : 1,
    }}>
      {avatar}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:'.5rem', marginBottom:'.1rem' }}>
          <span style={{ fontFamily:'var(--font-mono)', fontSize: isReaction ? '.48rem' : '.52rem', letterSpacing:'.12em', textTransform:'uppercase', color: isReaction ? (aiMeta?.color ? aiMeta.color.replace(')', ', 0.7)').replace('rgb', 'rgba') : 'rgba(255,255,255,0.45)') : (aiMeta?.color || (isSmara(prof) ? 'var(--cyan)' : 'rgba(255,255,255,0.6)')) }}>{label}</span>
          <span className="msg-timestamp">{formatTime(msg.created_at)}</span>
        </div>
        <p style={{ fontFamily:'var(--font-caveat)', fontSize: isReaction ? '0.9rem' : '1rem', color: aiMeta?.textColor || 'var(--text)', lineHeight:1.55, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
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

function ThinkingDot({ model, architectState, sparkState, scribeState, stewardState }) {
  const meta = AI[model]
  const avatarEl = model === 'claude'
    ? <AvatarArchitect size={26} state={architectState} />
    : model === 'scribe'
    ? <AvatarScribe size={26} state={scribeState || 'thinking'} />
    : model === 'steward'
    ? <AvatarSteward size={26} state={stewardState || 'thinking'} />
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
function LatticeDrawer({ expanded, setExpanded, messages, chatInput, setChatInput, onSend, onKeyDown, thinking, aiLocked, autoAI, setAutoAI, onAskArchitect, onAskSpark, onAskSteward, allProfiles, currentUserId, onPin, pinnedIds, onPinToBoard, architectState, sparkState, yourState, noteTitle, activeEnclave, sleeping, scribeActive, scribeState, stewardActive, stewardState, advocateState, contrarianState, focusMode, onFocusToggle, isMobile = false }) {
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
    <div className="lattice-drawer" style={{ height, ...(isMobile ? { bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' } : {}) }}>
      {/* Handle */}
      <div className="lattice-handle" onClick={() => setExpanded(v => !v)} data-hover>
        <div className="drawer-pill" />
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'.55rem', letterSpacing:'.16em', textTransform:'uppercase', color:'var(--mid)' }}>Lattice</span>
        {activeEnclave && (
          <span style={{ fontFamily:'var(--font-mono)', fontSize:'.52rem', letterSpacing:'.1em', textTransform:'uppercase', color:'var(--ember)', opacity:.8 }}>
            ◆ {activeEnclave.name}
          </span>
        )}
        {[AI.claude, AI.gpt].map(ai => (
          <span key={ai.role} style={{ padding:'.18rem .45rem', border:`1px solid ${ai.border}`, borderRadius:'2px', fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.1em', textTransform:'uppercase', color:ai.color, background:ai.dim }}>
            {ai.label}
          </span>
        ))}
        {scribeActive && (
          <span style={{ padding:'.18rem .45rem', border:`1px solid ${AI.scribe.border}`, borderRadius:'2px', fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.1em', textTransform:'uppercase', color:AI.scribe.color, background:AI.scribe.dim }}>
            {AI.scribe.label}
          </span>
        )}
        <span style={{ display:'flex', alignItems:'center', gap:'.35rem', padding:'.18rem .45rem', border:`1px solid ${AI.steward.border}`, borderRadius:'2px', fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.1em', textTransform:'uppercase', color:AI.steward.color, background:AI.steward.dim, opacity: stewardActive ? 1 : 0.35, transition:'opacity .3s' }}>
          <AvatarSteward size={16} state={stewardState} />
          {stewardActive ? 'The Steward — reviewing' : 'The Steward'}
        </span>
        {advocateState !== 'idle' && (
          <span style={{ display:'flex', alignItems:'center', gap:'.35rem', padding:'.18rem .45rem', border:`1px solid ${AI.advocate.border}`, borderRadius:'2px', fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.1em', textTransform:'uppercase', color:AI.advocate.color, background:AI.advocate.dim }}>
            <AvatarAdvocate size={16} state={advocateState} />
            The Advocate
          </span>
        )}
        {contrarianState !== 'idle' && (
          <span style={{ display:'flex', alignItems:'center', gap:'.35rem', padding:'.18rem .45rem', border:`1px solid ${AI.contrarian.border}`, borderRadius:'2px', fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.1em', textTransform:'uppercase', color:AI.contrarian.color, background:AI.contrarian.dim }}>
            <AvatarContrarian size={16} state={contrarianState} />
            The Contrarian
          </span>
        )}
        <div style={{ flex:1 }} />
        {focusMode && (
          <span style={{ fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(100,140,255,0.7)' }}>◉ Focus</span>
        )}
        <button onClick={e => { e.stopPropagation(); onFocusToggle() }}
          style={{ background:'transparent', border:'none', padding:'.18rem .3rem', fontFamily:'var(--font-mono)', fontSize:'.48rem', letterSpacing:'.1em', textTransform:'uppercase', color: focusMode ? 'rgba(100,140,255,0.6)' : 'var(--muted)', cursor:'none', opacity: focusMode ? 1 : 0.55, transition:'all .2s' }}>
          Focus
        </button>
        <button onClick={e => { e.stopPropagation(); setAutoAI(v => !v) }}
          style={{ display:'flex', alignItems:'center', gap:'.3rem', padding:'.22rem .55rem', background:'transparent', border:`1px solid ${autoAI ? 'rgba(80,200,100,0.4)' : 'var(--border)'}`, borderRadius:'2px', color: autoAI ? 'var(--green)' : 'var(--muted)', fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.1em', textTransform:'uppercase', transition:'all .2s' }}>
          <span style={{ width:5, height:5, borderRadius:'50%', background: autoAI ? 'var(--green)' : 'var(--muted)', animation: autoAI ? 'pulseSlow 2s ease-in-out infinite' : 'none' }} />
          Auto {autoAI ? 'ON' : 'OFF'}
        </button>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.1em', textTransform:'uppercase', color:'var(--green)' }}>◆ Live</span>
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
                architectState={architectState} sparkState={sparkState} yourState={yourState} scribeState={scribeState} stewardState={stewardState} advocateState={advocateState} contrarianState={contrarianState} />
            ))}
            {thinking && <ThinkingDot model={thinking} architectState={architectState} sparkState={sparkState} scribeState={scribeState} stewardState={stewardState} />}
            <div ref={messagesEndRef} />
          </div>

          {!autoAI && (
            <div style={{ display:'flex', gap:'.5rem', padding:'.4rem 1rem 0', flexShrink:0 }}>
              {[{ fn: onAskArchitect, meta: AI.claude }, { fn: onAskSpark, meta: AI.gpt }, { fn: onAskSteward, meta: AI.steward }].map(({ fn, meta }) => (
                <button key={meta.role} onClick={fn} disabled={aiLocked}
                  style={{ flex:1, padding:'.35rem', border:`1px solid ${meta.border}`, borderRadius:'2px', background: aiLocked ? 'transparent' : meta.dim, color: aiLocked ? 'var(--muted)' : meta.color, fontFamily:'var(--font-mono)', fontSize:'.48rem', letterSpacing:'.1em', textTransform:'uppercase', transition:'all .15s', opacity: aiLocked ? .4 : 1 }}>
                  Ask {meta.label}
                </button>
              ))}
            </div>
          )}

          {/* Context indicator */}
          <div style={{ padding:'0 1rem .2rem' }}>
            {activeEnclave ? (
              <span style={{ fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.14em', textTransform:'uppercase', color:'var(--ember)' }}>
                <span style={{ marginRight:'.35rem' }}>◆</span>{activeEnclave.name} — AI has access to shared notes
              </span>
            ) : (
              <span style={{ fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.14em', textTransform:'uppercase', color:'var(--muted)', opacity:.6 }}>
                Personal — AI context is this note only
              </span>
            )}
          </div>

          {/* Dormancy indicator */}
          {sleeping && (
            <div style={{ padding:'0 1rem .35rem', textAlign:'center' }}>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:'.46rem', letterSpacing:'.14em', textTransform:'uppercase', color:'var(--muted)', opacity:.5 }}>
                ● The Architect and The Spark are resting — start typing to wake them
              </span>
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
  const [boardDropToast, setBoardDropToast] = useState(false)
  const [boardStickyCount, setBoardStickyCount] = useState(0)

  // Avatar states
  const [architectState, setArchitectState] = useState('idle')
  const [sparkState, setSparkState] = useState('idle')
  const [yourState, setYourState] = useState('idle')
  const [sleeping, setSleeping] = useState(false)
  const [scribeActive, setScribeActive] = useState(false)
  const [scribeState, setScribeState] = useState('idle')
  const [stewardAvatarState, setStewardAvatarState] = useState('idle')
  const [advocateAvatarState, setAdvocateAvatarState] = useState('idle')
  const [contrarianAvatarState, setContrarianAvatarState] = useState('idle')
  const [focusMode, setFocusMode] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileMode, setMobileMode] = useState('dashboard')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Steward
  const [awaitingStewardEstimate, setAwaitingStewardEstimate] = useState(false)
  const [stewardEstimate, setStewardEstimate] = useState(null)
  const pendingBuildRef = useRef(null)

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
  const lastActivityRef = useRef(Date.now())
  const lastKeystrokeRef = useRef(0)
  const sleepModeRef = useRef(false)
  const lastProvocationRef = useRef(0)
  const sleepStartRef = useRef(0)
  const scribeActiveRef = useRef(false)
  const aiLockedRef = useRef(false)
  const focusModeRef = useRef(false)
  const focusTimerRef = useRef(null)
  const reactionEngineRef = useRef(null)
  const triggerReactionRef = useRef(null)
  const userRef = useRef(null)
  const scribePendingApprovalRef = useRef(false)

  useEffect(() => { historyRef.current = messages }, [messages])
  useEffect(() => { aiLockedRef.current = aiLocked }, [aiLocked])
  useEffect(() => { activeNoteRef.current = activeNote }, [activeNote])
  useEffect(() => { noteTitleRef.current = noteTitle }, [noteTitle])
  useEffect(() => { noteContentRef.current = noteContent }, [noteContent])
  useEffect(() => { activeEnclaveIdRef.current = activeEnclaveId }, [activeEnclaveId])
  useEffect(() => { userRef.current = user }, [user])

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
  async function switchActiveEnclave(id) {
    setActiveEnclaveId(id)
    activeEnclaveIdRef.current = id
    if (id) localStorage.setItem('vault_active_enclave', id)
    else localStorage.removeItem('vault_active_enclave')
    setMessages([])
    const sb = getSupabase()
    const uid = userRef.current?.id
    if (id) {
      const [{ data: msgs }] = await Promise.all([
        sb.from('messages').select('*').eq('enclave_id', id).order('created_at', { ascending: true }).limit(100),
        loadEnclaveData(id),
      ])
      setMessages(msgs || [])
    } else {
      setEnclaveNotes([])
      setActiveEnclaveMembers([])
      if (uid) {
        const { data: msgs } = await sb.from('messages').select('*')
          .is('enclave_id', null).eq('user_id', uid)
          .order('created_at', { ascending: true }).limit(100)
        setMessages(msgs || [])
      }
    }
  }

  async function loadEnclaveData(enclaveId) {
    const sb = getSupabase()
    // No relational joins — fetch each table independently to avoid cross-table policy chain
    const [{ data: eNotes }, { data: membersData }] = await Promise.all([
      sb.from('notes')
        .select('id,title,content,user_id,visibility,enclave_id,created_at,updated_at')
        .eq('enclave_id', enclaveId).eq('visibility', 'enclave')
        .order('updated_at', { ascending: false }),
      sb.from('enclave_members')
        .select('role, joined_at, user_id')
        .eq('enclave_id', enclaveId),
    ])
    // Fetch profiles separately to avoid cross-table RLS chain
    const userIds = membersData?.map(m => m.user_id).filter(Boolean) || []
    const { data: memberProfiles } = userIds.length
      ? await sb.from('profiles').select('id, display_name, email').in('id', userIds)
      : { data: [] }
    const profileMap = Object.fromEntries((memberProfiles || []).map(p => [p.id, p]))
    const membersWithProfiles = (membersData || []).map(m => ({ ...m, profiles: profileMap[m.user_id] || null }))
    setEnclaveNotes(eNotes || [])
    setActiveEnclaveMembers(membersWithProfiles)
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
          sb.from('messages').select('*').is('enclave_id', null).eq('user_id', u.id).order('created_at', { ascending: true }).limit(100),
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

        // Sync email to profiles (required for enclave invite-by-email)
        if (u.email) sb.from('profiles').update({ email: u.email }).eq('id', u.id).then(() => {})

        // Load enclaves
        const userEnclaves = await getUserEnclaves(sb, u.id)
        if (!active) return
        setEnclaves(userEnclaves)

        // Restore active enclave from localStorage
        const savedEnclaveId = typeof window !== 'undefined' ? localStorage.getItem('vault_active_enclave') : null
        if (savedEnclaveId && userEnclaves.find(e => e.id === savedEnclaveId)) {
          setActiveEnclaveId(savedEnclaveId)
          activeEnclaveIdRef.current = savedEnclaveId
          if (active) {
            await loadEnclaveData(savedEnclaveId)
            const { data: eMsgs } = await sb.from('messages').select('*')
              .eq('enclave_id', savedEnclaveId)
              .order('created_at', { ascending: true }).limit(100)
            if (active) setMessages(eMsgs || [])
          }
        }

        // Restore scribe active state from localStorage
        const savedScribe = typeof window !== 'undefined' ? localStorage.getItem('vault_scribe_active') : null
        if (savedScribe === 'true') { scribeActiveRef.current = true; setScribeActive(true) }

        // Mobile detection + mode restore
        const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768
        setIsMobile(mobile)
        if (mobile) {
          const savedMode = localStorage.getItem('vault_mobile_mode') || 'dashboard'
          setMobileMode(savedMode)
        }

        setMounted(true)

        sb.channel('messages-rt')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            const msg = payload.new
            const enclaveId = activeEnclaveIdRef.current
            const uid = userRef.current?.id
            if (enclaveId) {
              if (msg.enclave_id !== enclaveId) return
            } else {
              if (msg.enclave_id !== null || msg.user_id !== uid) return
            }
            setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
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

  // ── Activity tracking — keystrokes and clicks tracked separately ──
  // Keystroke gate: prevents reactions while user is actively typing (5s window)
  // Click/general activity: updates lastActivity for sleep/wake, does NOT clear reaction timers
  useEffect(() => {
    if (!user) return
    function onKeydown() {
      lastActivityRef.current = Date.now()
      lastKeystrokeRef.current = Date.now()
      if (!sleepModeRef.current) return
      // Wake up
      sleepModeRef.current = false
      setSleeping(false)
      const sleptMs = Date.now() - sleepStartRef.current
      if (sleptMs >= 8 * 60 * 1000) {
        // Fire a single wake message after 3s delay
        setTimeout(() => {
          if (aiLocked) return
          const phrase = WAKE_MESSAGES[Math.floor(Math.random() * WAKE_MESSAGES.length)]
          getSupabase().from('messages').insert({
            user_id: user.id, display_name: AI.gpt.label, content: phrase, role: 'gpt',
            enclave_id: activeEnclaveIdRef.current,
          }).select().single().then(({ data }) => {
            if (data) setMessages(prev => [...prev, data])
          })
        }, 3000)
      }
      setYourState('idle')
      setArchitectState('idle')
      setSparkState('idle')
    }
    function onAnyActivity() {
      lastActivityRef.current = Date.now()
      // Does NOT call clearAll — reaction timers survive clicks and reads
      if (!sleepModeRef.current) return
      sleepModeRef.current = false
      setSleeping(false)
    }
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('click', onAnyActivity)
    return () => {
      window.removeEventListener('keydown', onKeydown)
      window.removeEventListener('click', onAnyActivity)
    }
  }, [user, aiLocked]) // eslint-disable-line

  // ── Sleep / wake cycle + provocation guard ────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const sleepInterval = setInterval(() => {
      const now = Date.now()
      const inactiveMs = now - lastActivityRef.current

      // ── Enter sleep after 8 min inactivity ──
      if (inactiveMs >= 8 * 60 * 1000 && !sleepModeRef.current) {
        sleepModeRef.current = true
        sleepStartRef.current = now
        setSleeping(true)
        setYourState('silent')
        setArchitectState('silent')
        setSparkState('bored')
        return // skip provocation check while entering sleep
      }

      // ── Idle provocation — only when awake and user recently active ──
      if (sleepModeRef.current) return
      const userRecentlyActive = inactiveMs < 3 * 60 * 1000
      if (!userRecentlyActive) return
      if (aiLocked) return
      const sinceLastProvocation = now - lastProvocationRef.current
      if (sinceLastProvocation < 15 * 60 * 1000) return

      // Fire one provocation
      lastProvocationRef.current = now
      const phrase = PROVOCATIONS[Math.floor(Math.random() * PROVOCATIONS.length)]
      getSupabase().from('messages').insert({
        user_id: user.id, display_name: AI.gpt.label, content: phrase, role: 'gpt',
        enclave_id: activeEnclaveIdRef.current,
      }).select().single().then(({ data }) => {
        if (data) setMessages(prev => [...prev, data])
      })
    }, 60000)
    return () => clearInterval(sleepInterval)
  }, [user, aiLocked]) // eslint-disable-line

  // ── Reaction engine ──
  useEffect(() => {
    if (!user) return
    const engine = createReactionEngine({
      isSleeping:       () => sleepModeRef.current,
      isScribeActive:   () => scribeActiveRef.current,
      isAiLocked:       () => aiLockedRef.current || focusModeRef.current,
      getLastActivity:  () => lastActivityRef.current,
      getLastKeystroke: () => lastKeystrokeRef.current,
      getHistory:       () => historyRef.current,
      triggerReaction:  (model, prompt, isCross) => triggerReactionRef.current?.(model, prompt, isCross),
    })
    reactionEngineRef.current = engine
    return () => { engine.destroy(); reactionEngineRef.current = null }
  }, [user]) // eslint-disable-line

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

  // ── Mobile mode ──
  function setMobileModePersist(mode) {
    setMobileMode(mode)
    localStorage.setItem('vault_mobile_mode', mode)
  }

  // ── Focus mode ──
  function toggleFocusMode() {
    const next = !focusModeRef.current
    focusModeRef.current = next
    setFocusMode(next)
    if (next) {
      reactionEngineRef.current?.onUserActivity()
      clearTimeout(focusTimerRef.current)
      focusTimerRef.current = setTimeout(() => {
        focusModeRef.current = false
        setFocusMode(false)
      }, 10 * 60 * 1000)
    } else {
      clearTimeout(focusTimerRef.current)
    }
  }

  // ── Reaction trigger (called by reaction engine) ──
  async function triggerReaction(model, reactionPrompt, isCrossReaction = false) {
    if (focusModeRef.current) return null
    const meta = AI[model]
    const tempId = `${Date.now()}-react-${model}`
    let text = ''
    let placeholderAdded = false

    if (model === 'claude')          setArchitectState('processing')
    else if (model === 'gpt')        setSparkState('excited')
    else if (model === 'advocate')   setAdvocateAvatarState('thinking')
    else if (model === 'contrarian') setContrarianAvatarState('thinking')
    else if (model === 'steward')    setStewardAvatarState('thinking')

    try {
      const { noteContext, publicNotes } = await buildNoteContext()
      const history = historyRef.current.slice(-8)
      const res = await fetch(`${API_BASE}/api/chat/${model}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, noteContext, publicNotes, reactionPrompt }),
      })
      if (!res.ok) return null
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = dec.decode(value, { stream: true })
        text += chunk
        if (text.trim() && !placeholderAdded) {
          placeholderAdded = true
          setMessages(prev => [...prev, { id: tempId, role: model, display_name: meta.label, content: text, streaming: true, isReaction: true, isCrossReaction, created_at: new Date().toISOString() }])
        } else if (placeholderAdded) {
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: text } : m))
        }
      }
    } catch {
      return null
    }

    if (model === 'claude')      setArchitectState('idle')
    if (model === 'gpt')         setTimeout(() => setSparkState('idle'), 1200)
    if (model === 'advocate')    setTimeout(() => setAdvocateAvatarState('idle'), 3000)
    if (model === 'contrarian')  setTimeout(() => setContrarianAvatarState('idle'), 3500)
    if (model === 'steward')     setTimeout(() => setStewardAvatarState('idle'), 2500)

    if (!text.trim()) return null

    const { data: saved } = await getSupabase().from('messages').insert({
      user_id: userRef.current?.id, display_name: meta.label, content: text, role: model,
      enclave_id: activeEnclaveIdRef.current,
    }).select().single()
    const final = saved || { id: tempId, role: model, display_name: meta.label, content: text }
    setMessages(prev => prev.map(m => m.id === tempId ? { ...final, streaming: false, isReaction: true, isCrossReaction } : m))
    return { ...final, isReaction: true, isCrossReaction }
  }
  triggerReactionRef.current = triggerReaction

  // ── Chat ──
  async function saveHumanMessage(content) {
    const tempId = `${Date.now()}-h`
    const optimistic = { id: tempId, user_id: user.id, display_name: profile?.display_name || user.email, content, role: 'human', created_at: new Date().toISOString() }
    setMessages(prev => prev.find(m => m.id === tempId) ? prev : [...prev, optimistic])
    const { data: saved } = await getSupabase().from('messages').insert({ user_id: user.id, display_name: optimistic.display_name, content, role: 'human', enclave_id: activeEnclaveIdRef.current }).select().single()
    const final = saved || optimistic
    setMessages(prev => prev.map(m => m.id === tempId ? final : m))
    return final
  }

  async function triggerAI(model, history, noteContext, publicNotes, extraBody = {}) {
    const meta = AI[model]
    const tempId = `${Date.now()}-${model}`
    const placeholder = { id: tempId, role: model, display_name: meta.label, content: '', streaming: true, created_at: new Date().toISOString() }
    setMessages(prev => [...prev, placeholder])
    setThinking(model)
    if (model === 'scribe')  setScribeState('thinking')
    if (model === 'steward') setStewardAvatarState('thinking')

    let text = '', firstToken = true
    try {
      const res = await fetch(`${API_BASE}/api/chat/${model}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, noteContext: noteContext || null, publicNotes: publicNotes || [], ...extraBody }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Error' })); throw new Error(e.error || `HTTP ${res.status}`) }
      const reader = res.body.getReader(), dec = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        if (firstToken && model === 'scribe') { setScribeState('writing'); firstToken = false }
        text += dec.decode(value, { stream: true })
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: text } : m))
      }
    } catch (err) {
      text = `[${meta.label} error: ${err.message}]`
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: text } : m))
    }

    setThinking(null)
    if (model === 'scribe')  { setScribeState('done'); setTimeout(() => setScribeState('idle'), 850) }
    if (model === 'steward') setTimeout(() => setStewardAvatarState('idle'), 1500)
    const { data: saved } = await getSupabase().from('messages').insert({ user_id: userRef.current?.id, display_name: meta.label, content: text, role: model, enclave_id: activeEnclaveIdRef.current }).select().single()
    const final = saved || { ...placeholder, content: text, streaming: false }
    setMessages(prev => prev.map(m => m.id === tempId ? { ...final, streaming: false } : m))
    return final
  }

  // ── Roll call: "who is here" ──────────────────────────────────────────────
  const WHO_IS_HERE_RE = /\b(who('?s| is) (here|present|around|in the room)|roll.?call)\b/i

  async function handleRollCall() {
    const sb = getSupabase()
    const enclaveId = activeEnclaveIdRef.current

    // Fetch enclave members if in an enclave
    let memberLines = []
    if (enclaveId) {
      const { data: membersData } = await sb.from('enclave_members').select('user_id').eq('enclave_id', enclaveId)
      const userIds = (membersData || []).map(m => m.user_id).filter(Boolean)
      if (userIds.length) {
        const { data: profilesData } = await sb.from('profiles').select('id, display_name, email').in('id', userIds)
        memberLines = (profilesData || []).map(p => p.display_name || p.email || 'Unknown member')
      }
    }

    const enclaveName = enclaves.find(e => e.id === enclaveId)?.name
    const scribeOnline = scribeActiveRef.current

    // Steward delivers the room summary — he holds the full picture
    const stewardSummary = [
      `Everyone is here.`,
      ``,
      `Permanent residents: The Architect, The Spark, The Steward, The Advocate, The Contrarian, Socra.`,
      scribeOnline ? `Active this session: The Scribe.` : `The Scribe is standing by — /scribe to summon.`,
      ...(enclaveName && memberLines.length
        ? [``, `${enclaveName} — ${memberLines.length} member${memberLines.length !== 1 ? 's' : ''}:`, ...memberLines.map(n => `  ${n}`)]
        : []),
    ].filter(l => l !== null).join('\n')

    // Roll call — each agent checks in, staggered
    const ROLL_CALL = [
      { delay: 600,  role: 'steward',    label: AI.steward.label,    line: stewardSummary },
      { delay: 2200, role: 'claude',     label: AI.claude.label,     line: `...Present. The structure of this room concerns me slightly less than the structure of whatever you're about to build.` },
      { delay: 3800, role: 'gpt',        label: AI.gpt.label,        line: `HERE. Okay — everyone's in, the room's alive. What are we making?` },
      { delay: 5200, role: 'advocate',   label: AI.advocate.label,   line: `Here. I'll be watching for the person on the outside of everything you build today.` },
      { delay: 6800, role: 'contrarian', label: AI.contrarian.label, line: `Present. I'll speak when something needs to be said.` },
    ]

    if (scribeOnline) {
      ROLL_CALL.push({ delay: 8200, role: 'scribe', label: AI.scribe.label, line: `Here. Ready to build when you are.` })
    }

    for (const agent of ROLL_CALL) {
      setTimeout(async () => {
        const { data: saved } = await sb.from('messages').insert({
          user_id: userRef.current?.id,
          display_name: agent.label,
          content: agent.line,
          role: agent.role,
          enclave_id: activeEnclaveIdRef.current,
        }).select().single()
        const msg = saved || { id: `${Date.now()}-rc-${agent.role}`, role: agent.role, display_name: agent.label, content: agent.line, created_at: new Date().toISOString() }
        setMessages(prev => [...prev, msg])
      }, agent.delay)
    }
  }

  async function handleSend() {
    if (!chatInput.trim() || aiLocked) return
    const content = chatInput.trim(); setChatInput('')
    lastMsgTimeRef.current = Date.now()
    lastActivityRef.current = Date.now()

    // /scribe command — toggle summon/dismiss
    if (content === '/scribe') {
      if (scribeActiveRef.current) dismissScribe()
      else summonScribe()
      return
    }

    // Your avatar fires
    setYourState('sending')
    setTimeout(() => setYourState('idle'), 900)

    // Architect: processing if >50 words
    const wordCount = content.split(/\s+/).filter(Boolean).length
    if (wordCount > 50) setArchitectState('processing')

    // Spark: excited on new message
    setSparkState('excited')
    setTimeout(() => setSparkState('idle'), 1500)

    const humanMsg = await saveHumanMessage(content)
    // Cancel pending reactions from previous turn — new message starts a fresh turn
    reactionEngineRef.current?.onNewMessage()

    // ── Roll call ─────────────────────────────────────────────────────────────
    if (WHO_IS_HERE_RE.test(content)) {
      handleRollCall()
      return
    }

    if (!autoAI) return
    setAiLocked(true)

    const { noteContext, publicNotes } = await buildNoteContext()

    // ── Advocate/Contrarian on user message (no Scribe required) ─────────────
    reactionEngineRef.current?.onUserMessage(humanMsg, historyRef.current.length)

    // ── Steward interception ──────────────────────────────────────────────────
    // Fires when: (a) build intent in any active context (enclave or Scribe session)
    //             (b) user confirms a Scribe proposal ("go", "proceed", etc.)
    const isBuildIntent = SCRIBE_TRIGGER_RE.test(content)
    const isConfirmation = scribePendingApprovalRef.current && scribeActiveRef.current && STEWARD_CONFIRM_RE.test(content.trim())
    const stewardShouldFire = (isBuildIntent && (activeEnclaveIdRef.current || scribeActiveRef.current)) || isConfirmation

    if (stewardShouldFire) {
      scribePendingApprovalRef.current = false
      setStewardAvatarState('thinking')
      try {
        const enclaveId = activeEnclaveIdRef.current
        const { budget_cents } = enclaveId ? await getEnclaveBudget(enclaveId) : { budget_cents: null }
        const spentCents = (budget_cents != null && enclaveId) ? await getEnclaveSpend(enclaveId) : 0
        const res = await fetch(`${API_BASE}/api/chat/steward`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ request: content, budgetCents: budget_cents, spentCents }),
        })
        const estimate = await res.json()
        setStewardEstimate(estimate)
        setStewardAvatarState(estimate.recommendation === 'approve' ? 'done' : estimate.recommendation === 'reject' ? 'rejected' : 'concern')
        pendingBuildRef.current = { content, noteContext, publicNotes, isConfirmation }
        setAwaitingStewardEstimate(true)
        setAiLocked(false)
        return
      } catch {
        setStewardAvatarState('idle')
        // fall through to normal AI call
      }
    }

    // ── Direct Steward address ────────────────────────────────────────────────
    // User is talking to The Steward directly ("Steward, what's our budget?")
    const isStewardDirect = STEWARD_DIRECT_RE.test(content) && !stewardShouldFire
    if (isStewardDirect) {
      const enclaveId = activeEnclaveIdRef.current
      const { budget_cents } = enclaveId ? await getEnclaveBudget(enclaveId) : { budget_cents: null }
      const spentCents = (budget_cents != null && enclaveId) ? await getEnclaveSpend(enclaveId) : 0
      await triggerAI('steward', [...historyRef.current], noteContext, publicNotes, { budgetCents: budget_cents, spentCents })
      setAiLocked(false)
      return
    }

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

    // Route to Scribe if active and message has build intent or direct address
    if (scribeActiveRef.current) {
      const directAddress = /\bscribe\b/i.test(content)
      const buildIntent = SCRIBE_TRIGGER_RE.test(content)
      if (directAddress || buildIntent) {
        const scribeReply = await triggerAI('scribe', [...historyRef.current], noteContext, publicNotes)
        if (scribeReply) {
          reactionEngineRef.current?.onScribeMessage(scribeReply, historyRef.current.length)
          // If Scribe is asking for confirmation, flag it so next user message can trigger Steward
          if (SCRIBE_AWAIT_RE.test(scribeReply.content || '')) {
            scribePendingApprovalRef.current = true
          }
        }
      }
    }

    setAiLocked(false)
    lastMsgTimeRef.current = Date.now()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  async function handleStewardApprove() {
    const pending = pendingBuildRef.current
    if (!pending) return
    setAwaitingStewardEstimate(false)
    const currentEstimate = stewardEstimate
    setStewardEstimate(null)
    setStewardAvatarState('idle')
    pendingBuildRef.current = null

    // Log the build
    if (currentEstimate && activeEnclaveId) {
      await logBuild(activeEnclaveId, user.id, pending.content, currentEstimate.estimate_cents, currentEstimate.reasoning)
    }

    // Continue AI flow
    setAiLocked(true)
    const archReply = await triggerAI('claude', [...historyRef.current], pending.noteContext, pending.publicNotes)
    setArchitectState('idle')
    setYourState('replied')
    setTimeout(() => setYourState('idle'), 900)
    const sparkReply = await triggerAI('gpt', [...historyRef.current], pending.noteContext, pending.publicNotes)
    if (CONTRAST_RE.test(sparkReply?.content || '') || CONTRAST_RE.test(archReply?.content || '')) {
      setArchitectState('disagreeing')
      setTimeout(() => setArchitectState('idle'), 3000)
    }
    // Run Scribe if active and this was a build request or a confirmation of a Scribe proposal
    if (scribeActiveRef.current && (
      SCRIBE_TRIGGER_RE.test(pending.content) ||
      /\bscribe\b/i.test(pending.content) ||
      pending.isConfirmation
    )) {
      const scribeReply = await triggerAI('scribe', [...historyRef.current], pending.noteContext, pending.publicNotes)
      if (scribeReply) {
        reactionEngineRef.current?.onScribeMessage(scribeReply, historyRef.current.length)
        if (SCRIBE_AWAIT_RE.test(scribeReply.content || '')) {
          scribePendingApprovalRef.current = true
        }
      }
    }
    setAiLocked(false)
  }

  async function handleStewardReject() {
    setAwaitingStewardEstimate(false)
    setStewardEstimate(null)
    setStewardAvatarState('idle')
    pendingBuildRef.current = null
    scribePendingApprovalRef.current = false
    const rejectionMsg = "Rejected. The numbers don't support it — or the timing doesn't. Come back when one of those changes."
    const { data } = await getSupabase().from('messages').insert({
      user_id: userRef.current?.id, display_name: 'The Steward', content: rejectionMsg, role: 'steward',
      enclave_id: activeEnclaveIdRef.current,
    }).select().single()
    if (data) setMessages(prev => [...prev, data])
  }

  function handleAskSteward() {
    setAwaitingStewardEstimate(false)
    setStewardEstimate(null)
    setStewardAvatarState('idle')
    pendingBuildRef.current = null
    scribePendingApprovalRef.current = false
    setChatInput('Steward, ')
    setChatExpanded(true)
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

  // ── Summon / dismiss The Scribe ──
  async function summonScribe() {
    scribeActiveRef.current = true
    setScribeActive(true)
    localStorage.setItem('vault_scribe_active', 'true')
    setEnclaveToast('The Scribe has joined the Lattice')
    setTimeout(() => setEnclaveToast(''), 2800)

    const { noteContext, publicNotes } = await buildNoteContext()
    const entranceHistory = [
      ...historyRef.current.slice(-12),
      { role: 'human', content: 'You have been summoned to the Lattice. Introduce yourself in 2 sentences maximum, referencing what you have been reading. End with: Ready when you are.', display_name: 'System' },
    ]
    await new Promise(r => setTimeout(r, 1500))
    setAiLocked(true)
    await triggerAI('scribe', entranceHistory, noteContext, publicNotes)
    setAiLocked(false)
  }

  function dismissScribe() {
    scribeActiveRef.current = false
    setScribeActive(false)
    localStorage.removeItem('vault_scribe_active')
    const exitMsg = "Stepping back. The work is done — or I'm here when you're ready."
    getSupabase().from('messages').insert({
      user_id: userRef.current?.id, display_name: AI.scribe.label, content: exitMsg, role: 'scribe',
      enclave_id: activeEnclaveIdRef.current,
    }).select().single().then(({ data }) => {
      if (data) setMessages(prev => [...prev, data])
    })
  }

  // ── Drop note text to board ──
  async function handleDropToBoard(content, color) {
    const sb = getSupabase()
    const { data: cols } = await sb.from('sticky_columns')
      .select('id').eq('user_id', user.id).order('position').limit(1)
    const columnId = cols?.[0]?.id || null
    await sb.from('stickies').insert({
      user_id: user.id,
      column_id: columnId,
      content: content.slice(0, 280),
      color: color || 'paper',
      rotation: parseFloat((Math.random() * 6 - 3).toFixed(2)),
      source_type: 'note',
      source_note_id: activeNote?.id || null,
      position: 0,
    })
    setBoardStickyCount(prev => prev + 1)
    setBoardDropToast(true)
    setTimeout(() => setBoardDropToast(false), 2400)
  }

  // ── Enclave actions ──
  async function handleCreateEnclave(name, setLoading, setError) {
    setLoading(true)
    const { data: { user: currentUser } } = await getSupabase().auth.getUser()
    const { data: enclave, error } = await createEnclave(getSupabase(), { name, userId: currentUser.id })
    if (error) {
      console.error('[createEnclave]', error)
      setError('Failed to create enclave: ' + (error.message || error))
      setLoading(false)
      return // Keep modal open so user can retry or see the error
    }
    setLoading(false)
    setShowCreateEnclave(false)
    // Delay state refresh to avoid triggering RLS policy chain in the same tick
    setTimeout(() => {
      setEnclaves(prev => [...prev, enclave])
      switchActiveEnclave(enclave.id)
      setEnclaveToast(`◆ ${name} created — you're now in your enclave`)
      setTimeout(() => setEnclaveToast(''), 3500)
    }, 100)
  }

  async function handleInviteMember(email) {
    const result = await inviteMember(getSupabase(), activeEnclaveId, email)
    if (!result.error) await loadEnclaveData(activeEnclaveId)
    return result
  }

  async function handleRemoveMember(userId) {
    await removeMember(getSupabase(), activeEnclaveId, userId)
    setActiveEnclaveMembers(prev => prev.filter(m => m.user_id !== userId))
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
        user_id: userRef.current?.id, display_name: AI.gpt.label, content, role: 'gpt',
        enclave_id: activeEnclaveIdRef.current,
      }).select().single()
      if (data) {
        setMessages(prev => [...prev, data])
        setSparkState('excited')
        setTimeout(() => setSparkState('idle'), 1800)
      }
    }, 900)
  }

  async function handleSignOut() {
    reactionEngineRef.current?.destroy()
    clearTimeout(focusTimerRef.current)
    localStorage.removeItem('vault_scribe_active')
    setScribeActive(false)
    await getSupabase().auth.signOut()
    window.location.href = '/vault/login'
  }

  if (!mounted) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <p className="panel-label animate-pulse-slow">Initializing…</p>
    </div>
  )

  const chatHeight = chatExpanded ? 400 : 44
  // On mobile, add bottom nav height to editor bottom padding so content isn't obscured
  const editorChatHeight = chatHeight + (isMobile ? 72 : 0)
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
          onInvite={handleInviteMember}
          onRemove={handleRemoveMember}
          onDelete={handleDeleteEnclave}
          onClose={() => setShowEnclaveSettings(false)} />
      )}
      {reminderCard && (
        <ReminderCard phrase={reminderCard} noteTitle={noteTitle}
          onSave={saveReminder} onDismiss={() => setReminderCard(null)} />
      )}
      {awaitingStewardEstimate && stewardEstimate && (
        <StewardEstimateCard estimate={stewardEstimate} stewardState={stewardAvatarState}
          onApprove={handleStewardApprove} onReject={handleStewardReject} onAskSteward={handleAskSteward} />
      )}
      {pinToast && <div className="pin-toast">📌 Pinned to note</div>}
      {boardPinToast && <div className="pin-toast" style={{ bottom:'3.5rem' }}>🗂 Pinned to board</div>}
      {boardDropToast && <div className="pin-toast" style={{ bottom:'6rem' }}>📌 Dropped to board</div>}
      {enclaveToast && (
        <div className="pin-toast" style={{ bottom:'auto', top:'3.5rem', right:'1rem', background:'rgba(11,10,8,0.97)', border:'1px solid rgba(212,84,26,0.35)', color:'var(--ember)', maxWidth:'340px', fontSize:'.55rem', letterSpacing:'.08em', padding:'.65rem 1rem' }}>
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
        scribeActive={scribeActive}
        scribeAvailable={enclaveNotes.length > 0 && messages.length >= 3}
        scribeState={scribeState}
        onScribeSummon={summonScribe}
        stewardActive={awaitingStewardEstimate}
        stewardAvatarState={stewardAvatarState}
        advocateAvatarState={advocateAvatarState}
        contrarianAvatarState={contrarianAvatarState}
        isMobile={isMobile} mobileMode={mobileMode} onMobileModeChange={setMobileModePersist}
        onSignOut={handleSignOut} />

      {isMobile && mobileMode === 'voice' ? (
        <VoiceCapture
          user={user}
          enclaves={enclaves}
          onOpenNote={note => { setMobileModePersist('dashboard'); openNote(note) }} />
      ) : (
        <>
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
              chatHeight={editorChatHeight} contentRef={contentRef}
              detectedReminders={detectedReminders}
              onReminderClick={phrase => setReminderCard(phrase)}
              onImageUploaded={handleImageUploaded}
              activeEnclave={enclaves.find(e => e.id === activeEnclaveId) || null} />
          </div>

          <FloatingToolbar contentRef={contentRef} setNoteContent={setNoteContent}
            chatHeight={chatHeight} onImageClick={() => { const el = document.querySelector('input[accept="image/*"]'); if (el) el.click() }}
            onDropToBoard={handleDropToBoard} />

          {!isMobile && <VoiceFAB setNoteContent={setNoteContent} chatHeight={chatHeight} />}

          <LatticeDrawer
            expanded={chatExpanded} setExpanded={setChatExpanded}
            messages={messages} chatInput={chatInput} setChatInput={setChatInput}
            onSend={handleSend} onKeyDown={handleKeyDown}
            thinking={thinking} aiLocked={aiLocked}
            autoAI={autoAI} setAutoAI={setAutoAI}
            onAskArchitect={() => askOne('claude')}
            onAskSpark={() => askOne('gpt')}
            onAskSteward={handleAskSteward}
            allProfiles={allProfiles} currentUserId={user?.id}
            onPin={pinMessage} pinnedIds={pinnedIds} onPinToBoard={handlePinToBoard}
            architectState={architectState} sparkState={sparkState} yourState={yourState}
            noteTitle={noteTitle}
            activeEnclave={enclaves.find(e => e.id === activeEnclaveId) || null}
            sleeping={sleeping}
            scribeActive={scribeActive} scribeState={scribeState}
            stewardActive={awaitingStewardEstimate} stewardState={stewardAvatarState}
            advocateState={advocateAvatarState} contrarianState={contrarianAvatarState}
            focusMode={focusMode} onFocusToggle={toggleFocusMode}
            isMobile={isMobile} />
        </>
      )}

      {isMobile && (
        <>
          <MobileBottomNav
            mobileMode={mobileMode}
            onModeChange={setMobileModePersist}
            boardCount={boardStickyCount}
            onMenuOpen={() => setMobileMenuOpen(true)} />
          <MobileMenuSheet
            open={mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
            user={user} enclaves={enclaves}
            activeEnclaveId={activeEnclaveId}
            onEnclaveSwitch={switchActiveEnclave}
            onCreateEnclave={() => { setMobileMenuOpen(false); setShowCreateEnclave(true) }}
            onSignOut={handleSignOut} />
        </>
      )}
      <TheGuideWidget />
    </div>
  )
}
