'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true); setError('')
    const { error: err } = await createClient().auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) setError(err.message)
    else window.location.href = '/vault/dashboard'
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
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
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'.6rem', marginBottom:'.4rem' }}>
            <div className="ember-pip" />
            <span style={{
              fontFamily: "'Cabinet Grotesk', sans-serif",
              fontWeight: 800, fontSize: '1.4rem',
              color: 'rgba(240,236,228,0.9)', letterSpacing: '-.02em',
            }}>
              Carbon OS
            </span>
          </div>
          <p style={{
            fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400,
            fontSize: '.9rem', color: 'rgba(240,236,228,0.3)',
            margin: 0, paddingLeft: 'calc(8px + .6rem)',
          }}>
            Coming Soon
          </p>
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
          Access is by invitation only — Carbon OS is private
        </p>
      </div>
    </div>
  )
}
