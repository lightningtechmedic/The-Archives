'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [magicLoading, setMagicLoading] = useState(false)
  const [magicError, setMagicError] = useState('')

  const [pwEmail, setPwEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')

  async function handleMagicLink(e) {
    e.preventDefault()
    if (!email) return
    setMagicLoading(true); setMagicError('')
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/vault/auth/callback` },
    })
    setMagicLoading(false)
    if (error) setMagicError(error.message)
    else setSent(true)
  }

  async function handlePassword(e) {
    e.preventDefault()
    if (!pwEmail || !password) return
    setPwLoading(true); setPwError('')
    const { error } = await createClient().auth.signInWithPassword({ email: pwEmail, password })
    setPwLoading(false)
    if (error) setPwError(error.message)
    else window.location.href = '/vault/dashboard'
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem 1.5rem', position:'relative' }}>
      {/* Ambient glow */}
      <div aria-hidden style={{ position:'fixed', top:'30%', left:'50%', transform:'translate(-50%,-50%)', width:600, height:400, background:'radial-gradient(ellipse,rgba(212,84,26,0.07) 0%,transparent 70%)', pointerEvents:'none' }} />

      <div style={{ width:'100%', maxWidth:360 }}>
        {/* Brand */}
        <div style={{ textAlign:'center', marginBottom:'3rem' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'.5rem', marginBottom:'1rem' }}>
            <div className="ember-pip" />
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'.52rem', letterSpacing:'.25em', textTransform:'uppercase', color:'var(--muted)' }}>Restricted Access</span>
          </div>
          <h1 style={{ fontFamily:'var(--font-serif)', fontSize:'clamp(3.5rem,10vw,5.5rem)', fontWeight:300, lineHeight:.9, letterSpacing:'-.02em', color:'rgba(255,255,255,0.92)' }}>
            The{' '}
            <em style={{ fontStyle:'italic', color:'var(--ember)' }}>Vault</em>
          </h1>
          <div style={{ width:40, height:1, background:'var(--ember)', opacity:.4, margin:'1.5rem auto 0' }} />
        </div>

        {!sent ? (
          <>
            {/* Magic link */}
            <form onSubmit={handleMagicLink} style={{ display:'flex', flexDirection:'column', gap:'.85rem' }}>
              <div>
                <label htmlFor="email" style={{ display:'block', fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.18em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'.5rem' }}>
                  Email Address
                </label>
                <input
                  id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" required className="vault-input w-full"
                  style={{ fontSize:'.88rem' }}
                />
              </div>
              {magicError && <p style={{ fontFamily:'var(--font-mono)', fontSize:'.55rem', color:'var(--ember)', letterSpacing:'.06em' }}>{magicError}</p>}
              <button type="submit" disabled={magicLoading} className="vault-btn w-full justify-center" style={{ padding:'1rem', marginTop:'.25rem' }}>
                {magicLoading ? <span style={{ opacity:.6 }}>Sending…</span> : <>Send Access Link <span style={{ fontSize:'.9rem' }}>→</span></>}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display:'flex', alignItems:'center', gap:'1rem', margin:'2rem 0' }}>
              <div style={{ flex:1, height:1, background:'var(--border)' }} />
              <span style={{ fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.18em', color:'var(--muted)', textTransform:'uppercase' }}>or</span>
              <div style={{ flex:1, height:1, background:'var(--border)' }} />
            </div>

            {/* Password */}
            <form onSubmit={handlePassword} style={{ display:'flex', flexDirection:'column', gap:'.85rem' }}>
              <div>
                <label htmlFor="pw-email" style={{ display:'block', fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.18em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'.5rem' }}>
                  Email Address
                </label>
                <input
                  id="pw-email" type="email" value={pwEmail} onChange={e => setPwEmail(e.target.value)}
                  placeholder="you@example.com" required className="vault-input w-full"
                  style={{ fontSize:'.88rem' }}
                />
              </div>
              <div>
                <label htmlFor="password" style={{ display:'block', fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.18em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'.5rem' }}>
                  Password
                </label>
                <input
                  id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required className="vault-input w-full"
                  style={{ fontSize:'.88rem' }}
                />
              </div>
              {pwError && <p style={{ fontFamily:'var(--font-mono)', fontSize:'.55rem', color:'var(--ember)', letterSpacing:'.06em' }}>{pwError}</p>}
              <button type="submit" disabled={pwLoading} className="vault-btn w-full justify-center" style={{ padding:'1rem', marginTop:'.25rem' }}>
                {pwLoading ? <span style={{ opacity:.6 }}>Signing in…</span> : <>Sign In <span style={{ fontSize:'.9rem' }}>→</span></>}
              </button>
            </form>
          </>
        ) : (
          <div style={{ border:'1px solid var(--ember-dim)', borderRadius:'3px', padding:'1.5rem', textAlign:'center' }}>
            <div className="online-dot" style={{ margin:'0 auto .75rem' }} />
            <p className="panel-label" style={{ color:'var(--ember)', marginBottom:'.5rem' }}>Link Sent</p>
            <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1.2rem', color:'var(--mid)', lineHeight:1.6 }}>
              Check your inbox. The link expires in 10 minutes.
            </p>
            <button onClick={() => setSent(false)} className="vault-btn-ghost" style={{ marginTop:'1.25rem' }}>
              Try a different email
            </button>
          </div>
        )}

        <p style={{ textAlign:'center', marginTop:'2rem', fontFamily:'var(--font-mono)', fontSize:'.48rem', letterSpacing:'.18em', color:'var(--muted)', opacity:.45, textTransform:'uppercase' }}>
          Trusted team only
        </p>
      </div>
    </div>
  )
}
