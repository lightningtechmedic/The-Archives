'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

const ROWS = [
  { letter: 'V', word: 'Vision of' },
  { letter: 'A', word: 'Active' },
  { letter: 'U', word: 'Unified' },
  { letter: 'L', word: 'Living' },
  { letter: 'T', word: 'Thought' },
]
const DELAYS      = [0, 420, 820, 1180, 1500]
const TAGLINE_MS  = 2200
const FADE_MS     = 4000   // tagline + hold (2200 + 1800)
const CARD_MS     = 4600   // fade + 600

export default function LoginPage() {
  const [rowsOn,     setRowsOn]     = useState([false,false,false,false,false])
  const [taglineOn,  setTaglineOn]  = useState(false)
  const [introFade,  setIntroFade]  = useState(false)
  const [cardOn,     setCardOn]     = useState(false)

  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  const timersRef = []

  const runIntro = useCallback(() => {
    setRowsOn([false,false,false,false,false])
    setTaglineOn(false)
    setIntroFade(false)
    setCardOn(false)

    DELAYS.forEach((d, i) => {
      timersRef.push(setTimeout(() => {
        setRowsOn(prev => { const n = [...prev]; n[i] = true; return n })
      }, d))
    })
    timersRef.push(setTimeout(() => setTaglineOn(true),  TAGLINE_MS))
    timersRef.push(setTimeout(() => setIntroFade(true),  FADE_MS))
    timersRef.push(setTimeout(() => setCardOn(true),     CARD_MS))
  }, []) // eslint-disable-line

  useEffect(() => {
    runIntro()
    return () => timersRef.forEach(clearTimeout)
  }, []) // eslint-disable-line

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true); setError('')
    const { error: err } = await createClient().auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) setError(err.message)
    else window.location.href = '/vault/dashboard'
  }

  // ── shared transition helper ──────────────────────────────────────────────
  const tr = (on, props) => ({
    opacity:   on ? 1 : 0,
    transform: on ? 'none' : props.from,
    transition: props.tr,
  })

  return (
    <>
      {/* ── INTRO ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
        opacity:   introFade ? 0 : 1,
        transform: introFade ? 'scale(0.97)' : 'none',
        transition: 'opacity .8s ease, transform .8s cubic-bezier(.16,1,.3,1)',
      }}>
        <div>
          <div style={{ display:'flex', flexDirection:'column', gap:0, alignItems:'flex-start' }}>
            {ROWS.map((r, i) => (
              <div key={r.letter} style={{
                display: 'flex', alignItems: 'baseline', gap: '1.2rem',
                ...tr(rowsOn[i], { from: 'translateY(12px)', tr: `opacity .6s cubic-bezier(.16,1,.3,1) ${i * 0}ms, transform .6s cubic-bezier(.16,1,.3,1)` }),
              }}>
                <span style={{
                  fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 300,
                  fontSize: 'clamp(4rem,8vw,6.5rem)', lineHeight: 1,
                  color: 'var(--ember)', width: '5.5rem', textAlign: 'center',
                  textShadow: rowsOn[i] ? '0 0 40px rgba(212,84,26,0.3)' : '0 0 40px rgba(212,84,26,0)',
                  transition: 'text-shadow .6s ease',
                }}>
                  {r.letter}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '.55rem', letterSpacing: '.15em',
                  color: 'rgba(212,84,26,0.4)', alignSelf: 'center',
                  opacity: rowsOn[i] ? 1 : 0, transition: 'opacity .4s ease .2s',
                }}>
                  —
                </span>
                <span style={{
                  fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 300,
                  fontSize: 'clamp(1.4rem,2.8vw,2rem)', color: 'rgba(240,236,228,0.55)',
                  letterSpacing: '.02em', whiteSpace: 'nowrap',
                  opacity: rowsOn[i] ? 1 : 0,
                  transform: rowsOn[i] ? 'none' : 'translateX(-6px)',
                  transition: 'opacity .5s ease .25s, transform .5s cubic-bezier(.16,1,.3,1) .25s',
                }}>
                  {r.word}
                </span>
              </div>
            ))}
          </div>

          <p style={{
            marginTop: '2rem',
            fontFamily: 'var(--font-mono)', fontSize: '.5rem',
            letterSpacing: '.25em', textTransform: 'uppercase',
            color: 'rgba(240,236,228,.2)',
            paddingLeft: '.5rem',
            ...tr(taglineOn, { from: 'translateY(4px)', tr: 'opacity .6s ease, transform .6s ease' }),
          }}>
            A private space where your team thinks together
          </p>
        </div>
      </div>

      {/* ── LOGIN CARD ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
        pointerEvents: cardOn ? 'all' : 'none',
        ...tr(cardOn, { from: 'translateY(16px)', tr: 'opacity .8s cubic-bezier(.16,1,.3,1), transform .8s cubic-bezier(.16,1,.3,1)' }),
      }}>
        <div style={{
          width: '100%', maxWidth: 420,
          background: 'rgba(13,12,10,.96)',
          border: '1px solid rgba(255,255,255,.09)',
          borderRadius: 10,
          padding: '2.5rem 2.5rem 2rem',
          backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
          boxShadow: '0 24px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.03)',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Ember glow top */}
          <div aria-hidden style={{
            position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)',
            width: 200, height: 80,
            background: 'radial-gradient(ellipse,rgba(212,84,26,.18),transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Brand */}
          <div style={{ display:'flex', alignItems:'center', gap:'.6rem', marginBottom:'2rem' }}>
            <div className="ember-pip" />
            <span style={{ fontFamily:'var(--font-serif)', fontStyle:'italic', fontWeight:300, fontSize:'1.4rem', color:'rgba(240,236,228,0.9)' }}>
              The Vault
            </span>
          </div>

          {/* VAULT acronym */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '.2rem',
            marginBottom: '2rem', padding: '.8rem 1rem',
            background: 'rgba(212,84,26,.04)',
            border: '1px solid rgba(212,84,26,.1)',
            borderRadius: 6,
          }}>
            {ROWS.map(r => (
              <div key={r.letter} style={{ display:'flex', alignItems:'baseline', gap:'.6rem' }}>
                <span style={{ fontFamily:'var(--font-serif)', fontStyle:'italic', fontWeight:400, fontSize:'1.1rem', color:'var(--ember)', width:'1rem', flexShrink:0, lineHeight:1.4 }}>
                  {r.letter}
                </span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:'.52rem', letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(240,236,228,.38)', lineHeight:1.4 }}>
                  {r.word}
                </span>
              </div>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            <div>
              <label style={{ display:'block', fontFamily:'var(--font-mono)', fontSize:'.48rem', letterSpacing:'.15em', textTransform:'uppercase', color:'rgba(240,236,228,.28)', marginBottom:'.4rem' }}>
                Email
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@yourstudio.com" required
                style={{
                  width:'100%', background:'rgba(24,21,16,1)',
                  border:'1px solid rgba(255,255,255,.055)', borderRadius:5,
                  padding:'.6rem .8rem', color:'rgba(240,236,228,.8)',
                  fontFamily:'var(--font-caveat)', fontSize:'1rem',
                  outline:'none', transition:'border-color .2s, box-shadow .2s',
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(212,84,26,.3)'; e.target.style.boxShadow = '0 0 0 3px rgba(212,84,26,.06)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,.055)'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            <div>
              <label style={{ display:'block', fontFamily:'var(--font-mono)', fontSize:'.48rem', letterSpacing:'.15em', textTransform:'uppercase', color:'rgba(240,236,228,.28)', marginBottom:'.4rem' }}>
                Password
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                style={{
                  width:'100%', background:'rgba(24,21,16,1)',
                  border:'1px solid rgba(255,255,255,.055)', borderRadius:5,
                  padding:'.6rem .8rem', color:'rgba(240,236,228,.8)',
                  fontFamily:'var(--font-caveat)', fontSize:'1rem',
                  outline:'none', transition:'border-color .2s, box-shadow .2s',
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(212,84,26,.3)'; e.target.style.boxShadow = '0 0 0 3px rgba(212,84,26,.06)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,.055)'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            {error && (
              <p style={{ fontFamily:'var(--font-mono)', fontSize:'.52rem', letterSpacing:'.06em', color:'var(--ember)', marginTop:'-.25rem' }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} style={{
              width:'100%', padding:'.65rem', borderRadius:5, marginTop:'.25rem',
              fontFamily:'var(--font-mono)', fontSize:'.55rem', letterSpacing:'.15em', textTransform:'uppercase',
              background:'var(--ember)', border:'1px solid var(--ember)', color:'white',
              boxShadow:'0 4px 16px rgba(212,84,26,.25)',
              transition:'all .2s', opacity: loading ? .6 : 1,
            }}
            onMouseEnter={e => { if (!loading) { e.target.style.background = '#c04010'; e.target.style.boxShadow = '0 4px 24px rgba(212,84,26,.4)' } }}
            onMouseLeave={e => { e.target.style.background = 'var(--ember)'; e.target.style.boxShadow = '0 4px 16px rgba(212,84,26,.25)' }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p style={{
            marginTop: '1.5rem', textAlign: 'center',
            fontFamily: 'var(--font-mono)', fontSize: '.46rem',
            letterSpacing: '.08em', color: 'rgba(240,236,228,.18)',
          }}>
            Access is by invitation only — The Vault is private
          </p>
        </div>
      </div>

      {/* ── Replay button ── */}
      <button onClick={runIntro} style={{
        position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 600,
        fontFamily: 'var(--font-mono)', fontSize: '.46rem',
        letterSpacing: '.12em', textTransform: 'uppercase',
        color: 'rgba(240,236,228,.2)', border: '1px solid rgba(255,255,255,.055)',
        background: 'transparent', padding: '.25rem .6rem', borderRadius: 3,
        transition: 'all .2s',
      }}
      onMouseEnter={e => { e.target.style.color = 'rgba(240,236,228,.8)'; e.target.style.borderColor = 'rgba(255,255,255,.09)' }}
      onMouseLeave={e => { e.target.style.color = 'rgba(240,236,228,.2)'; e.target.style.borderColor = 'rgba(255,255,255,.055)' }}>
        ↺ replay intro
      </button>
    </>
  )
}
