'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()

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
    setMagicLoading(true)
    setMagicError('')

    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setMagicLoading(false)
    if (err) setMagicError(err.message)
    else setSent(true)
  }

  async function handlePassword(e) {
    e.preventDefault()
    if (!pwEmail || !password) return
    setPwLoading(true)
    setPwError('')

    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({
      email: pwEmail,
      password,
    })

    setPwLoading(false)
    if (err) setPwError(err.message)
    else router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: '#0a0a0a' }}>
      {/* Ambient glow */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '400px',
          background: 'radial-gradient(ellipse, rgba(212,84,26,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div className="w-full max-w-sm animate-fade-up" style={{ animationFillMode: 'forwards' }}>
        {/* Logo */}
        <div className="text-center mb-12">
          <p className="panel-label mb-4" style={{ letterSpacing: '0.3em' }}>
            Restricted Access
          </p>
          <h1
            className="font-serif"
            style={{
              fontSize: 'clamp(3.5rem, 10vw, 6rem)',
              fontWeight: 300,
              lineHeight: 0.9,
              letterSpacing: '-0.02em',
              color: 'rgba(255,255,255,0.92)',
            }}
          >
            The{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--ember)' }}>Vault</em>
          </h1>
          <div
            style={{
              width: '40px',
              height: '1px',
              background: 'var(--ember)',
              opacity: 0.4,
              margin: '1.5rem auto 0',
            }}
          />
        </div>

        {!sent ? (
          <>
            {/* Magic link */}
            <form onSubmit={handleMagicLink} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="email"
                  className="panel-label block mb-2"
                  style={{ color: 'var(--muted)' }}
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="vault-input w-full px-4 py-3"
                  style={{ fontSize: '0.9rem' }}
                />
              </div>

              {magicError && (
                <p className="font-mono text-xs" style={{ color: 'var(--ember)', letterSpacing: '0.05em' }}>
                  {magicError}
                </p>
              )}

              <button
                type="submit"
                disabled={magicLoading}
                className="vault-btn w-full justify-center mt-2"
                style={{ padding: '1rem' }}
              >
                {magicLoading ? (
                  <span style={{ opacity: 0.6 }}>Sending&hellip;</span>
                ) : (
                  <>Send Access Link <span style={{ fontSize: '0.9rem' }}>→</span></>
                )}
              </button>
            </form>

            {/* Divider */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                margin: '2rem 0',
              }}
            >
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <span
                className="font-mono"
                style={{ fontSize: '0.55rem', letterSpacing: '0.2em', color: 'var(--muted)', textTransform: 'uppercase' }}
              >
                or
              </span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>

            {/* Password */}
            <form onSubmit={handlePassword} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="pw-email"
                  className="panel-label block mb-2"
                  style={{ color: 'var(--muted)' }}
                >
                  Email Address
                </label>
                <input
                  id="pw-email"
                  type="email"
                  value={pwEmail}
                  onChange={e => setPwEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="vault-input w-full px-4 py-3"
                  style={{ fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="panel-label block mb-2"
                  style={{ color: 'var(--muted)' }}
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="vault-input w-full px-4 py-3"
                  style={{ fontSize: '0.9rem' }}
                />
              </div>

              {pwError && (
                <p className="font-mono text-xs" style={{ color: 'var(--ember)', letterSpacing: '0.05em' }}>
                  {pwError}
                </p>
              )}

              <button
                type="submit"
                disabled={pwLoading}
                className="vault-btn w-full justify-center mt-2"
                style={{ padding: '1rem' }}
              >
                {pwLoading ? (
                  <span style={{ opacity: 0.6 }}>Signing in&hellip;</span>
                ) : (
                  <>Sign In <span style={{ fontSize: '0.9rem' }}>→</span></>
                )}
              </button>
            </form>
          </>
        ) : (
          <div
            className="vault-panel p-6 text-center"
            style={{ borderColor: 'var(--ember-dim)' }}
          >
            <div
              className="online-dot mx-auto mb-4"
              style={{ width: '8px', height: '8px' }}
            />
            <p className="panel-label mb-2" style={{ color: 'var(--ember)' }}>
              Link Sent
            </p>
            <p
              className="font-serif"
              style={{ color: 'var(--mid)', fontSize: '0.95rem', fontWeight: 300, lineHeight: 1.7 }}
            >
              Check your inbox. The link expires in 10 minutes.
            </p>
            <button
              onClick={() => setSent(false)}
              className="vault-btn-ghost mt-6"
            >
              Try a different email
            </button>
          </div>
        )}

        <p
          className="text-center mt-8 font-mono"
          style={{ fontSize: '0.5rem', letterSpacing: '0.2em', color: 'var(--muted)', opacity: 0.5, textTransform: 'uppercase' }}
        >
          Trusted team only
        </p>
      </div>
    </div>
  )
}
